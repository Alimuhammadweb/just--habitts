import type { NextRequest } from "next/server"
import { z } from "zod"
import { fail, json, readJson, requireSession, dbErrorResponse } from "@/lib/server/api"
import { mutateUser, sanitizeUser, userTimezone } from "@/lib/server/user-store"
import { todayKey } from "@/lib/dates"
import { checkAndUnlockTasks } from "@/lib/task-unlock"
import { advanceChallenges } from "@/lib/server/challenge-engine"

const MAX_PER_REQUEST = 4
const MAX_PER_DAY = 30
const Body = z.object({ session: z.object({ count: z.number().int().min(1).max(MAX_PER_REQUEST).default(1) }).passthrough() })

// POST - pomodoro yakunlandi. Sana serverda (foydalanuvchi vaqt zonasida) aniqlanadi,
// mijoz yuborgan sana/ID e'tiborga olinmaydi. Taymerning haqiqiy ishlaganini server tekshira olmaydi;
// shuning uchun bir so'rov va bir kun uchun chegaralar qo'yilgan.
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, "So'rov noto'g'ri", "VALIDATION")
  const { count } = parsed.data.session

  try {
    const now = Date.now()
    let capped = false
    const out = await mutateUser(auth.session.id, (doc) => {
      const tz = userTimezone(doc)
      const date = todayKey(tz, now)
      const sessions = [...(doc.pomodoroData?.sessions || [])]
      const i = sessions.findIndex((s) => s.date === date)
      const todayCount = i >= 0 ? sessions[i].count : 0
      const add = Math.min(count, MAX_PER_DAY - todayCount)
      if (add <= 0) { capped = true; return null }
      if (i >= 0) sessions[i] = { ...sessions[i], count: todayCount + add }
      else sessions.push({ id: now, date, count: add })
      let next = { ...doc, pomodoroData: { sessions, totalPomodoros: (doc.pomodoroData?.totalPomodoros || 0) + add } }
      next = { ...next, ...checkAndUnlockTasks(next) }
      next = { ...next, ...advanceChallenges(next, tz, now) }
      return { user: next, result: { added: add } }
    })
    if (!out.found) return fail(404, "Foydalanuvchi topilmadi")
    if (capped) return fail(429, "Kunlik pomodoro chegarasiga yetdingiz", "DAILY_LIMIT")
    return json({ success: true, pomodoroData: out.user.pomodoroData, user: sanitizeUser(out.user) })
  } catch (err) {
    return dbErrorResponse(err, "Pomodoro")
  }
}
