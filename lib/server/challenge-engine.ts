/**
 * CHALLENGE (CHELENG) DVIGATELI - sof funksiyalar.
 *
 * Turlar (kind):
 *  - self_report            : ma'lumot manbai yo'q ("6:00 da turish", "2L suv"). Foydalanuvchi o'zi
 *                             belgilaydi; server har kalendar kuni uchun FAQAT BIR marta, oyna ichida
 *                             qabul qiladi. Bu o'z-o'zini tasdiqlash - haqiqiy faollikdan tekshirib bo'lmaydi.
 *  - pomodoro_total         : oyna ichidagi serverda yozilgan pomodorolar yig'indisi >= maqsad.
 *  - habit_days             : oyna ichida har kuni kamida bitta odat "completed" (stats xizmatidan).
 *  - habit_and_pomodoro_days: har kuni odat "completed" VA kamida bitta pomodoro.
 *
 * Qoidalar:
 *  - Oyna = boshlangan kalendar kunidan durationDays kun (foydalanuvchi vaqt zonasida).
 *  - Progress maqsaddan oshmaydi. Muddat o'tgan yoki maqsadga erishib bo'lmaydigan bo'lsa -> "expired".
 *  - Mukofot faqat BIR marta (completedChallenges/challengeRewards bo'yicha tekshiriladi).
 *  - Odat asosidagi kunlar faqat kun TUGAGANDAN keyin (bugundan oldingi) hisobga olinadi: bugungi
 *    belgini bekor qilib, mukofotni saqlab qolish mumkin emas. Mukofot oxirgi kundan keyingi
 *    kun beriladi. Hisoblangan kunlar saqlanadi, shuning uchun odat o'chirilsa, avvalgi progress yo'qolmaydi.
 */
import type { User, ActiveChallenge, Challenge } from "../../types/user"
import { CHALLENGES } from "../../types/user"
import { addDays, dateKeyFromTimestamp, diffDays, type DateKey } from "../dates"
import { dayResult, type HabitLike } from "../stats/habit-stats"

export type ChallengeKind = "self_report" | "pomodoro_total" | "habit_days" | "habit_and_pomodoro_days"
export interface ChallengeRule { kind: ChallengeKind; target: number }

const OVERRIDES: Record<number, ChallengeRule | undefined> = {
  7: { kind: "pomodoro_total", target: 50 },
  12: { kind: "pomodoro_total", target: 200 },
  13: { kind: "habit_days", target: 60 },
  16: { kind: "habit_days", target: 90 },
  17: { kind: "habit_and_pomodoro_days", target: 120 },
  18: { kind: "habit_days", target: 365 },
}

export function ruleFor(def: Challenge): ChallengeRule {
  return OVERRIDES[def.id] ?? { kind: "self_report", target: def.durationDays }
}

export const findChallenge = (id: number) => CHALLENGES.find((c) => c.id === id)

export type ChallengeStatus = "active" | "completed" | "expired"

export interface ChallengeView {
  challengeId: number
  kind: ChallengeKind
  status: ChallengeStatus
  progress: number
  target: number
  startDateKey: DateKey
  endDateKey: DateKey
  todayIndex: number
  todayDone: boolean
  canCheckIn: boolean
  daysLeft: number
}

function pomodoroByDate(user: User): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of user.pomodoroData?.sessions || []) m.set(s.date, (m.get(s.date) || 0) + (s.count || 0))
  return m
}

/** Eski (v1) yozuvni yangi shaklga keltiradi; mavjud kunlar saqlanadi, takrorlar olib tashlanadi. */
export function normalizeActive(a: ActiveChallenge, def: Challenge, tz: string, now: number): ActiveChallenge {
  const rule = ruleFor(def)
  const startDateKey = a.startDateKey ?? dateKeyFromTimestamp(a.startedAt, tz)
  const days = Array.from(new Set((a.completedDays || []).filter((d) => Number.isInteger(d) && d >= 0 && d < def.durationDays))).sort((x, y) => x - y)
  let endDateKey = a.endDateKey
  if (!endDateKey) {
    // Eski, davom etayotgan chelenglar jimgina muddatsiz qolmasin, lekin birdan "expired" ham bo'lmasin:
    // tabiiy oxirgi kun yoki qolgan kunlarni bajarishga yetadigan sana - qaysi biri keyin bo'lsa.
    const natural = addDays(startDateKey, def.durationDays - 1)
    const today = dateKeyFromTimestamp(now, tz)
    const remaining = Math.max(0, (rule.kind === "self_report" ? rule.target : def.durationDays) - days.length)
    const grace = remaining > 0 ? addDays(today, remaining - 1) : natural
    endDateKey = a.isCompleted ? natural : grace > natural ? grace : natural
  }
  return { ...a, startDateKey, endDateKey, completedDays: days, attempt: a.attempt ?? 1 }
}

export function describe(user: User, a: ActiveChallenge, tz: string, now: number): ChallengeView | null {
  const def = findChallenge(a.challengeId)
  if (!def) return null
  const n = normalizeActive(a, def, tz, now)
  const rule = ruleFor(def)
  const today = dateKeyFromTimestamp(now, tz)
  const start = n.startDateKey as DateKey, end = n.endDateKey as DateKey
  const todayIndex = diffDays(start, today)
  const inWindow = today >= start && today <= end

  let progress = n.completedDays.length
  let todayCounted = n.completedDays.includes(todayIndex)
  if (rule.kind === "pomodoro_total") {
    progress = 0
    const by = pomodoroByDate(user)
    for (const [date, c] of by) if (date >= start && date <= end) progress += c
  } else if (rule.kind !== "self_report" && inWindow) {
    // Jonli ko'rsatkich: bugungi kun ham (hali saqlanmaydi)
    const live = qualifiesToday(user, today, tz, now, rule.kind)
    if (live && !n.completedDays.includes(todayIndex) && todayIndex < def.durationDays) { progress += 1; todayCounted = true }
  }
  progress = Math.min(progress, rule.target)

  const daysLeft = Math.max(0, diffDays(today, end) + 1)
  let status: ChallengeStatus = n.isCompleted ? "completed" : "active"
  if (status === "active") {
    const available = daysLeft - (todayCounted && rule.kind !== "pomodoro_total" ? 1 : 0)
    const stillPossible = rule.kind === "pomodoro_total" ? today <= end : today <= end && rule.target - progress <= available
    if (!stillPossible) status = "expired"
  }
  const todayDone = n.completedDays.includes(todayIndex)
  return {
    challengeId: a.challengeId, kind: rule.kind, status, progress, target: rule.target,
    startDateKey: start, endDateKey: end, todayIndex, todayDone,
    canCheckIn: rule.kind === "self_report" && status === "active" && inWindow && !todayDone,
    daysLeft,
  }
}

function qualifiesToday(user: User, date: DateKey, tz: string, now: number, kind: ChallengeKind, pomo?: Map<string, number>): boolean {
  const today = dateKeyFromTimestamp(now, tz)
  const habitDone = (user.habits || []).some((h) => dayResult(h as HabitLike, date, today, tz).state === "completed")
  if (kind === "habit_days") return habitDone
  return habitDone && ((pomo ?? pomodoroByDate(user)).get(date) || 0) >= 1
}

export function startChallenge(user: User, challengeId: number, tz: string, now: number):
  { ok: true; user: User } | { ok: false; code: string; message: string } {
  const def = findChallenge(challengeId)
  if (!def) return { ok: false, code: "NOT_FOUND", message: "Chelenj topilmadi" }
  if ((user.completedChallenges || []).includes(challengeId)) return { ok: false, code: "ALREADY_COMPLETED", message: "Bu chelenj allaqachon bajarilgan" }
  const list = user.activeChallenges || []
  const existing = list.find((a) => a.challengeId === challengeId)
  if (existing) {
    const v = describe(user, existing, tz, now)
    if (v && v.status === "active") return { ok: false, code: "ALREADY_ACTIVE", message: "Bu chelenj allaqachon boshlangan" }
  }
  const start = dateKeyFromTimestamp(now, tz)
  const entry: ActiveChallenge = {
    challengeId, startedAt: now, completedDays: [], isCompleted: false,
    startDateKey: start, endDateKey: addDays(start, def.durationDays - 1), attempt: (existing?.attempt ?? 0) + 1,
  }
  return { ok: true, user: { ...user, activeChallenges: [...list.filter((a) => a.challengeId !== challengeId), entry] } }
}

export function checkInChallenge(user: User, challengeId: number, tz: string, now: number):
  { ok: true; user: User; unchanged: boolean } | { ok: false; code: string; message: string } {
  const def = findChallenge(challengeId)
  const a = (user.activeChallenges || []).find((x) => x.challengeId === challengeId)
  if (!def || !a) return { ok: false, code: "NOT_ACTIVE", message: "Chelenj faol emas" }
  if (ruleFor(def).kind !== "self_report") return { ok: false, code: "AUTO_TRACKED", message: "Bu chelenj progressi avtomatik hisoblanadi" }
  const v = describe(user, a, tz, now)
  if (!v || v.status !== "active") return { ok: false, code: "NOT_ACTIVE", message: "Chelenj faol emas yoki muddati o'tgan" }
  if (v.todayIndex < 0 || v.todayIndex >= def.durationDays || dateKeyFromTimestamp(now, tz) > v.endDateKey) return { ok: false, code: "OUT_OF_WINDOW", message: "Bugun chelenj oynasidan tashqarida" }
  const n = normalizeActive(a, def, tz, now)
  if (n.completedDays.includes(v.todayIndex)) return { ok: true, user, unchanged: true }
  const next = { ...n, completedDays: [...n.completedDays, v.todayIndex].sort((x, y) => x - y) }
  return { ok: true, user: replaceActive(user, next), unchanged: false }
}

const replaceActive = (user: User, entry: ActiveChallenge): User => ({
  ...user, activeChallenges: (user.activeChallenges || []).map((a) => (a.challengeId === entry.challengeId ? entry : a)),
})

function grantReward(user: User, def: Challenge, now: number): User {
  if ((user.completedChallenges || []).includes(def.id)) return user // mukofot faqat bir marta
  const rewards = user.challengeRewards || []
  const hasReward = rewards.some((r) => r.value === def.reward.value && r.type === def.reward.type)
  const sel: Partial<User> =
    def.reward.type === "frame" ? { selectedFrame: def.reward.value }
    : def.reward.type === "border" ? { selectedBorder: def.reward.value }
    : { selectedBackground: def.reward.value }
  return {
    ...user, ...sel,
    completedChallenges: [...(user.completedChallenges || []), def.id],
    challengeRewards: hasReward ? rewards : [...rewards, def.reward],
  }
}

/**
 * Faol chelenglarni haqiqiy faollikka qarab yangilaydi va maqsadga erishilganlarini yakunlaydi.
 * Idempotent: qayta chaqirish natijani o'zgartirmaydi.
 */
export function advanceChallenges(user: User, tz: string, now: number): User {
  const list = user.activeChallenges
  if (!list || list.length === 0) return user
  const today = dateKeyFromTimestamp(now, tz)
  const pomo = pomodoroByDate(user)
  let next = user

  const updated = list.map((a) => {
    const def = findChallenge(a.challengeId)
    if (!def) return a
    let n = normalizeActive(a, def, tz, now)
    if (n.isCompleted) return n
    const rule = ruleFor(def)
    const start = n.startDateKey as DateKey, end = n.endDateKey as DateKey

    if (rule.kind === "pomodoro_total") {
      let total = 0
      for (const [date, c] of pomo) if (date >= start && date <= end) total += c
      if (total >= rule.target) n = { ...n, isCompleted: true, completedAt: now }
    } else if (rule.kind !== "self_report") {
      // Faqat tugagan kunlar (bugundan oldin) saqlanadi
      const days = new Set(n.completedDays)
      const lastPast = addDays(today, -1) < end ? addDays(today, -1) : end
      for (let d = start; d <= lastPast; d = addDays(d, 1)) {
        const idx = diffDays(start, d)
        if (idx >= 0 && idx < def.durationDays && qualifiesToday(next, d, tz, now, rule.kind, pomo)) days.add(idx)
      }
      n = { ...n, completedDays: Array.from(days).sort((x, y) => x - y) }
      if (n.completedDays.length >= rule.target) n = { ...n, isCompleted: true, completedAt: now }
    } else if (n.completedDays.length >= rule.target) {
      n = { ...n, isCompleted: true, completedAt: now }
    }
    return n
  })

  next = { ...user, activeChallenges: updated }
  for (const a of updated) {
    if (a.isCompleted) {
      const def = findChallenge(a.challengeId)
      if (def) next = grantReward(next, def, now)
    }
  }
  return next
}

/** Mijozga ko'rsatish uchun: har bir faol chelenj holati (serverda hisoblangan). */
export function viewAll(user: User, tz: string, now: number): ChallengeView[] {
  return (user.activeChallenges || []).map((a) => describe(user, a, tz, now)).filter((v): v is ChallengeView => v !== null)
}
