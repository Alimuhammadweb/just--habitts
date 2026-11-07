import type { NextRequest } from "next/server"
import { z } from "zod"
import { fail, json, readJson, requireSession, dbErrorResponse } from "@/lib/server/api"
import { mutateUser, sanitizeUser, userTimezone } from "@/lib/server/user-store"
import { settleOldDays, periodXP } from "@/lib/server/habit-engine"
import { dateKeyFromTimestamp, isValidTimezone, weekStart } from "@/lib/dates"
import { earnStreakFreeze } from "@/lib/xp-system"
import { checkAndUnlockTasks } from "@/lib/task-unlock"
import { advanceChallenges } from "@/lib/server/challenge-engine"

const Body = z.object({ timezone: z.string().max(64).optional() }).optional()

// POST /api/habits/sync - ilova ochilganda: o'tgan kunlarni yopish, vaqt zonasini saqlash.
// Idempotent: qayta chaqirilganda hech narsa o'zgarmaydi.
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse((await readJson(request)) ?? undefined)
  if (!parsed.success) return fail(400, "So'rov noto'g'ri", "VALIDATION")
  const requestedTz = parsed.data?.timezone

  try {
    const now = Date.now()
    const out = await mutateUser(auth.session.id, (doc) => {
      // Vaqt zonasi faqat hali o'rnatilmagan bo'lsa avtomatik o'rnatiladi (foydalanuvchi keyin o'zgartira oladi).
      const tz = doc.timezone ? userTimezone(doc) : isValidTimezone(requestedTz) ? requestedTz : userTimezone(doc)
      let next = { ...doc, ...(doc.timezone ? {} : { timezone: tz }) }
      next = { ...next, ...settleOldDays(next, tz, now).user }
      // Davr XP sini kalendar bo'yicha qayta hisoblaymiz (haftalik reset = sana oralig'i, lifetime XP tegilmaydi)
      const p = periodXP(next.habits || [], dateKeyFromTimestamp(now, tz))
      next = { ...next, xpData: { ...next.xpData, ...p, weekKey: weekStart(dateKeyFromTimestamp(now, tz)) } }
      next = { ...next, ...earnStreakFreeze(next).user }
      next = { ...next, ...checkAndUnlockTasks(next) }
      next = { ...next, ...advanceChallenges(next, tz, now) }
      return { user: next, result: null }
    })
    if (!out.found) return fail(404, "Foydalanuvchi topilmadi")
    return json({ user: sanitizeUser(out.user) })
  } catch (err) {
    return dbErrorResponse(err, "HabitSync")
  }
}
