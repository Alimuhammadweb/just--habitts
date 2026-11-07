/**
 * SERVER TOMONIDAGI ODAT/XP DVIGATELI (sof funksiyalar, testlanadi).
 * Mijoz faqat "nima qilmoqchi" ekanini yuboradi (habitId, dayIndex, status);
 * XP, qulflar va sanalar faqat shu yerda, server vaqti va foydalanuvchi vaqt zonasi
 * bo'yicha hisoblanadi. Amallar idempotent: bir xil so'rovni qayta yuborish XPni
 * o'zgartirmaydi, chunki XP "kun uchun berilgan jami" (dayLock.xpAwarded) bilan
 * farq (delta) sifatida hisoblanadi.
 */
import type { User, Habit, DayStatus, DayLock } from "../../types/user"
import { XP_REWARDS } from "../../types/user"
import { addDays, dateKeyFromTimestamp, weekStart, monthStart, type DateKey } from "../dates"
import { dateForDayIndex, dayIndexForDate } from "../stats/habit-stats"

export type StatusInput = DayStatus | "none"
export const PENALTY_XP = XP_REWARDS.missed // -15

export type EngineResult =
  | { ok: true; user: User; xpChange: number; unchanged: boolean }
  | { ok: false; code: "HABIT_NOT_FOUND" | "INVALID_DAY" | "FUTURE_DAY" | "DAY_LOCKED" | "INVALID_STATUS"; message: string }

export const levelFromXP = (xp: number) => Math.floor(xp / 100) + 1

const xpFor = (s: string): number => (s === "frozen" ? 0 : (XP_REWARDS as Record<string, number>)[s] ?? 0)

function sumLockXP(habits: Habit[], from: DateKey, to: DateKey): number {
  let sum = 0
  for (const h of habits) {
    for (const lock of Object.values(h.dayLocks || {})) {
      if (lock?.dateString && lock.dateString >= from && lock.dateString <= to) sum += lock.xpAwarded || 0
    }
  }
  return sum
}

/** Haftalik/oylik XP: kalendar davri bo'yicha dayLock yozuvlaridan (manfiy bo'lmaydi). */
export function periodXP(habits: Habit[], today: DateKey) {
  const ws = weekStart(today)
  return {
    weeklyXP: Math.max(0, sumLockXP(habits, ws, addDays(ws, 6))),
    monthlyXP: Math.max(0, sumLockXP(habits, monthStart(today), today)),
  }
}

function withXP(user: User, delta: number, today: DateKey, now: number, habits: Habit[], history: User["xpData"]["xpHistory"]): User {
  const totalXP = Math.max(0, user.xpData.totalXP + delta)
  const { weeklyXP, monthlyXP } = periodXP(habits, today)
  return {
    ...user,
    habits,
    xpData: {
      ...user.xpData,
      totalXP,
      currentXP: Math.max(0, (user.xpData.currentXP || 0) + delta),
      level: levelFromXP(totalXP),
      weeklyXP,
      monthlyXP,
      weekKey: weekStart(today),
      xpHistory: history,
      lastUpdated: now,
    },
  }
}

export function applyHabitStatus(
  user: User,
  habitId: number,
  dayIndex: number,
  status: StatusInput,
  tz: string,
  now: number,
  missReason?: string,
): EngineResult {
  if (!["completed", "partial", "missed", "none"].includes(status)) {
    return { ok: false, code: "INVALID_STATUS", message: "Noto'g'ri holat" }
  }
  const idx = (user.habits || []).findIndex((h) => h.id === habitId)
  if (idx === -1) return { ok: false, code: "HABIT_NOT_FOUND", message: "Odat topilmadi" }
  const habit = user.habits[idx]
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= habit.duration) {
    return { ok: false, code: "INVALID_DAY", message: "Noto'g'ri kun" }
  }

  const today = dateKeyFromTimestamp(now, tz)
  const dayDate = dateForDayIndex(habit, dayIndex, tz)
  if (dayDate > today) return { ok: false, code: "FUTURE_DAY", message: `Bu kun ${dayDate} sanasida ochiladi` }

  const lock = habit.dayLocks?.[dayIndex]
  // O'zgartirish faqat belgilangan KUNNING O'ZIDA mumkin; o'tgan kunlar qulflangan.
  const editable = dayDate === today && (!lock || lock.dateString === today)
  if (!editable) return { ok: false, code: "DAY_LOCKED", message: "Bu kun qulflangan, uni o'zgartirib bo'lmaydi" }

  const current = habit.days?.[dayIndex]
  const sameStatus = status === "none" ? current === undefined : current === status
  if (sameStatus) return { ok: true, user, xpChange: 0, unchanged: true }

  const oldXP = lock?.xpAwarded || 0
  const newXP = status === "none" ? 0 : xpFor(status)
  const delta = newXP - oldXP

  const days = { ...(habit.days || {}) }
  const dayLocks = { ...(habit.dayLocks || {}) }
  const missReasons = { ...(habit.missReasons || {}) }
  if (status === "none") {
    delete days[dayIndex]; delete dayLocks[dayIndex]; delete missReasons[dayIndex]
  } else {
    days[dayIndex] = status
    const newLock: DayLock = { status, markedAt: now, dateString: today, xpAwarded: newXP, locked: false }
    dayLocks[dayIndex] = newLock
    if (status === "missed" && missReason) missReasons[dayIndex] = String(missReason).slice(0, 200)
    else delete missReasons[dayIndex]
  }
  const habits = user.habits.map((h, i) => (i === idx ? { ...habit, days, dayLocks, missReasons } : h))

  // Tarix: har (odat, kun) uchun BITTA yozuv, kun uchun berilgan JAMI XP bilan (idempotent).
  const history = (user.xpData.xpHistory || []).filter((e) => !(e.habitId === habitId && e.dayIndex === dayIndex))
  if (status !== "none") history.push({ date: today, xpEarned: newXP, habitId, dayIndex, status, timestamp: now })

  return { ok: true, user: withXP(user, delta, today, now, habits, history), xpChange: delta, unchanged: false }
}

/**
 * O'tgan, belgilanmagan kunlarni yopadi: "missed" (-15 XP) yoki mavjud bo'lsa
 * streak-freeze ishlatiladi. Faqat YOZUVSIZ o'tgan kunlarga tegadi va qayta chaqirilsa
 * hech narsa o'zgarmaydi (idempotent). Mavjud yozuvlar qayta yozilmaydi.
 */
export function settleOldDays(user: User, tz: string, now: number): { user: User; changed: boolean } {
  const today = dateKeyFromTimestamp(now, tz)
  let freezes = user.streakFreezes || 0
  let used = 0
  let delta = 0
  let changed = false
  const history = [...(user.xpData.xpHistory || [])]

  const habits = (user.habits || []).map((habit) => {
    const startKey = dateKeyFromTimestamp(habit.startDate.timestamp, tz)
    const lastIdx = Math.min(habit.duration - 1, dayIndexForDate(habit, addDays(today, -1), tz))
    let days = habit.days || {}, locks = habit.dayLocks || {}, reasons = habit.missReasons || {}
    let touched = false
    for (let i = 0; i <= lastIdx; i++) {
      const dayDate = addDays(startKey, i)
      const existing = days[i] as string | undefined
      if (existing) {
        const lk = locks[i]
        if (!lk || !lk.locked) {
          if (!touched) { days = { ...days }; locks = { ...locks }; reasons = { ...reasons }; touched = true }
          locks[i] = lk ? { ...lk, locked: true } : { status: existing as DayStatus, markedAt: now, dateString: dayDate, xpAwarded: xpFor(existing), locked: true }
        }
        continue
      }
      if (!touched) { days = { ...days }; locks = { ...locks }; reasons = { ...reasons }; touched = true }
      if (freezes > 0) {
        freezes--; used++
        ;(days as Record<number, string>)[i] = "frozen"
        locks[i] = { status: "frozen" as DayStatus, markedAt: now, dateString: dayDate, xpAwarded: 0, locked: true }
        reasons[i] = "streak-freeze"
      } else {
        days[i] = "missed"
        locks[i] = { status: "missed", markedAt: now, dateString: dayDate, xpAwarded: PENALTY_XP, locked: true }
        reasons[i] = "auto-missed"
        delta += PENALTY_XP
        history.push({ date: dayDate, xpEarned: PENALTY_XP, habitId: habit.id, dayIndex: i, status: "missed", timestamp: now })
      }
    }
    if (!touched) return habit
    changed = true
    return { ...habit, days, dayLocks: locks, missReasons: reasons }
  })

  if (!changed) return { user, changed: false }
  const next = withXP({ ...user, streakFreezes: freezes, totalFreezesUsed: (user.totalFreezesUsed || 0) + used }, delta, today, now, habits, history)
  return { user: next, changed: true }
}

/** Faqat audit uchun: saqlangan totalXP va dayLock yig'indisi orasidagi farq. Hech narsani o'zgartirmaydi. */
export function auditXP(user: User) {
  const fromLocks = (user.habits || []).reduce((s, h) => s + Object.values(h.dayLocks || {}).reduce((a, l) => a + (l?.xpAwarded || 0), 0), 0)
  return { stored: user.xpData.totalXP, fromDayLocks: fromLocks, difference: user.xpData.totalXP - fromLocks }
}
