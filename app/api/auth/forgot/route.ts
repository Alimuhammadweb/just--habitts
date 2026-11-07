import type { NextRequest } from "next/server"
import { createHash, randomBytes } from "crypto"
import { z } from "zod"
import { fail, json, readJson } from "@/lib/server/api"
import { db, big } from "@/lib/prisma"
import { hit, clientIp } from "@/lib/server/rate-limit"

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254) })
const GENERIC = { success: true, message: "Agar bu email ro'yxatdan o'tgan bo'lsa, tiklash havolasi yuborildi." }

// Foydalanuvchi mavjudligini oshkor qilmaslik uchun har doim bir xil javob qaytariladi.
export async function POST(request: NextRequest) {
  const { RESEND_API_KEY, RESEND_FROM, APP_URL } = process.env
  if (!RESEND_API_KEY || !RESEND_FROM || !APP_URL) return fail(501, "Parolni tiklash bu serverda sozlanmagan", "NOT_CONFIGURED")
  const parsed = Body.safeParse(await readJson(request))
  if (!parsed.success) return json(GENERIC)
  const { email } = parsed.data
  try {
    const rl = await hit(`forgot:${clientIp(request.headers)}`, 5, 60 * 60)
    const rlEmail = await hit(`forgot-email:${email}`, 3, 60 * 60)
    if (!rl.allowed || !rlEmail.allowed) return json(GENERIC)

    const user = await db().user.findFirst({ where: { email, isActive: true }, select: { id: true } })
    if (!user) return json(GENERIC)

    const token = randomBytes(32).toString("hex")
    await db().$transaction([
      db().passwordReset.deleteMany({ where: { userId: user.id } }),
      db().passwordReset.create({
        data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 30 * 60_000) },
      }),
    ])
    db().passwordReset.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {})

    const link = `${APP_URL.replace(/\/$/, "")}/?reset=${token}`
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: RESEND_FROM, to: [email], subject: "Just Habits: parolni tiklash",
        html: `<p>Parolni tiklash uchun havola (30 daqiqa amal qiladi):</p><p><a href="${link}">${link}</a></p><p>Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.</p>`,
      }),
    }).catch((e) => console.error("[Forgot] email yuborilmadi:", e))
    return json(GENERIC)
  } catch (err) {
    console.error("[Forgot]", err)
    return json(GENERIC)
  }
}
