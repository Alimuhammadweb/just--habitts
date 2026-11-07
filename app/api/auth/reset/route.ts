import type { NextRequest } from "next/server"
import { createHash } from "crypto"
import { z } from "zod"
import { fail, json, readJson, dbErrorResponse } from "@/lib/server/api"
import { db } from "@/lib/prisma"
import { hashPassword } from "@/lib/server/password"
import { passwordProblems } from "@/lib/password-rules"
import { revokeAllRefreshTokensForUser } from "@/lib/refresh-tokens"
import { hit, clientIp } from "@/lib/server/rate-limit"

const Body = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().max(128) })

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, "Havola yoki parol noto'g'ri", "VALIDATION")
  const problems = passwordProblems(parsed.data.password)
  if (problems.length) return fail(400, `Parol talablari: ${problems.join(", ")}`, "WEAK_PASSWORD")
  try {
    const rl = await hit(`reset:${clientIp(request.headers)}`, 10, 60 * 60)
    if (!rl.allowed) return fail(429, "Juda ko'p urinish", "RATE_LIMITED")
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex")
    const rec = await db().passwordReset.findUnique({ where: { tokenHash } })
    if (!rec || rec.used || rec.expiresAt.getTime() <= Date.now()) return fail(400, "Havola eskirgan yoki allaqachon ishlatilgan", "INVALID_TOKEN")
    // Bir martalik: used=false bo'lgan yozuvni atomik ravishda band qilamiz (parallel so'rovlardan faqat bittasi o'tadi)
    const claimed = await db().passwordReset.updateMany({ where: { id: rec.id, used: false }, data: { used: true } })
    if (claimed.count !== 1) return fail(400, "Havola eskirgan yoki allaqachon ishlatilgan", "INVALID_TOKEN")
    await db().user.update({ where: { id: rec.userId }, data: { password: hashPassword(parsed.data.password), salt: null } })
    await revokeAllRefreshTokensForUser(Number(rec.userId)) // barcha qurilmalardan chiqarish
    return json({ success: true })
  } catch (err) {
    return dbErrorResponse(err, "Reset")
  }
}
