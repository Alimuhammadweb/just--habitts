import type { NextRequest } from "next/server"
import { z } from "zod"
import { fail, json, readJson, requireSession, dbErrorResponse } from "@/lib/server/api"
import { mutateUser, sanitizeUser, userTimezone } from "@/lib/server/user-store"
import { advanceChallenges, checkInChallenge, startChallenge, viewAll } from "@/lib/server/challenge-engine"

const Body = z.object({ action: z.enum(["start", "checkin"]), challengeId: z.number().int().positive() })

// GET - joriy holat (progress serverda hisoblanadi)
export async function GET(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  try {
    const out = await mutateUser(auth.session.id, (doc) => {
      const tz = userTimezone(doc)
      const next = advanceChallenges(doc, tz, Date.now())
      return { user: next as typeof doc, result: null }
    })
    if (!out.found) return fail(404, "Foydalanuvchi topilmadi")
    const tz = userTimezone(out.user)
    return json({ user: sanitizeUser(out.user), views: viewAll(out.user, tz, Date.now()) })
  } catch (err) {
    return dbErrorResponse(err, "Challenges.GET")
  }
}

// POST - boshlash yoki bugungi kunni belgilash (faqat self_report turlari uchun)
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, "So'rov noto'g'ri", "VALIDATION")
  const { action, challengeId } = parsed.data

  try {
    const now = Date.now()
    let failure: { code: string; message: string } | null = null
    const out = await mutateUser(auth.session.id, (doc) => {
      const tz = userTimezone(doc)
      const r = action === "start" ? startChallenge(doc, challengeId, tz, now) : checkInChallenge(doc, challengeId, tz, now)
      if (!r.ok) { failure = { code: r.code, message: r.message }; return null }
      const before = new Set(doc.completedChallenges || [])
      const next = advanceChallenges(r.user, tz, now)
      const justCompleted = (next.completedChallenges || []).filter((id) => !before.has(id))
      return { user: next as typeof doc, result: { justCompleted } }
    })
    if (failure) { const f = failure as { code: string; message: string }; return fail(409, f.message, f.code) }
    if (!out.found) return fail(404, "Foydalanuvchi topilmadi")
    const tz = userTimezone(out.user)
    return json({ user: sanitizeUser(out.user), views: viewAll(out.user, tz, now), justCompleted: out.result?.justCompleted ?? [] })
  } catch (err) {
    return dbErrorResponse(err, "Challenges.POST")
  }
}
