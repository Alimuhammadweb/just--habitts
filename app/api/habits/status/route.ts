import type { NextRequest } from "next/server"
import { z } from "zod"
import { fail, json, readJson, requireSession, dbErrorResponse } from "@/lib/server/api"
import { mutateUser, sanitizeUser, userTimezone } from "@/lib/server/user-store"
import { applyHabitStatus, settleOldDays } from "@/lib/server/habit-engine"
import { checkAndUnlockTasks } from "@/lib/task-unlock"
import { advanceChallenges } from "@/lib/server/challenge-engine"

const Body = z.object({
  habitId: z.number().int(),
  dayIndex: z.number().int().min(0).max(3650),
  status: z.enum(["completed", "partial", "missed", "none"]),
  missReason: z.string().max(200).optional(),
})

// POST /api/habits/status - kunni belgilash. XP, qulflar va sana tekshiruvi serverda.
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, "So'rov noto'g'ri", "VALIDATION")
  const { habitId, dayIndex, status, missReason } = parsed.data

  try {
    const now = Date.now()
    let failure: { status: number; message: string; code: string } | null = null
    const out = await mutateUser(auth.session.id, (doc) => {
      const tz = userTimezone(doc)
      // Avval o'tgan kunlarni yopamiz (idempotent), keyin bugungi amalni qo'llaymiz.
      const settled = settleOldDays(doc, tz, now).user
      const r = applyHabitStatus(settled, habitId, dayIndex, status, tz, now, missReason)
      if (!r.ok) {
        failure = { status: r.code === "HABIT_NOT_FOUND" ? 404 : 409, message: r.message, code: r.code }
        return null
      }
      const beforeTasks = new Set(doc.completedTasks || [])
      let next = checkAndUnlockTasks(r.user)
      next = advanceChallenges(next, tz, now)
      const newTasks = (next.completedTasks || []).filter((id) => !beforeTasks.has(id))
      return { user: { ...doc, ...next }, result: { xpChange: r.xpChange, unchanged: r.unchanged, newTasks } }
    })
    if (failure) { const f = failure as { status: number; message: string; code: string }; return fail(f.status, f.message, f.code) }
    if (!out.found) return fail(404, "Foydalanuvchi topilmadi")
    return json({ user: sanitizeUser(out.user), ...(out.result ?? { xpChange: 0, unchanged: true, newTasks: [] }) })
  } catch (err) {
    return dbErrorResponse(err, "HabitStatus")
  }
}
