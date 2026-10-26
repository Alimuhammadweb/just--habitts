/**
 * ODATLAR STATISTIKASI - YAGONA HISOBLASH MANBAI
 * ------------------------------------------------------------------------
 * Dashboard, statistika sahifasi, profil, do'stlar, email hisobotlari va
 * vazifa/challenge tekshiruvlari statistikani FAQAT shu moduldan olishi kerak.
 *
 * MA'LUMOT MODELI (mavjud sxema saqlangan):
 *   habit.startDate.timestamp  - odat boshlangan vaqt (ms)
 *   habit.duration             - odat necha kun davom etadi
 *   habit.days[dayIndex]       - "completed" | "partial" | "missed" | "frozen"
 *   dayIndex 0 = boshlanish kuni; dayIndex i = boshlanish kuni + i kalendar kuni
 *
 * Hozirgi mahsulotda odatlar HAR KUNI bajariladi (haftalik jadval yo'q), shuning
 * uchun "belgilangan kun" = odat oynasi ichidagi har bir kalendar kuni. Agar
 * kelajakda jadval qo'shilsa, faqat `isDueOn` o'zgaradi.
 *
 * ANIQLAMALAR
 *  - Kun holati (dayState):
 *      "notDue"   : odat hali boshlanmagan, tugagan yoki kun kelajakda
 *      "pending"  : bugun, hali belgilanmagan (kun tugamagan - "o'tkazib yuborilgan" EMAS)
 *      "completed" / "partial" / "frozen" : yozilgan natija
 *      "missed"   : yozilgan "missed" YOKI kun tugagan, lekin hech narsa yozilmagan
 *                   (`inferred: true` bilan ajratiladi; yozuvlar o'zgartirilmaydi)
 *  - Frozen (muzlatilgan) kun uzrli: maxrajga kirmaydi va streakni uzmaydi, lekin
 *    streakni oshirmaydi ham.
 *  - Bugungi belgilanmagan kun maxrajga kirmaydi (jazolanmaydi).
 *  - Foiz = completed / (completed + partial + missed). Partial alohida ko'rsatiladi
 *    va 0 hisoblanadi (qisman bajarish to'liq bajarish emas).
 *  - Odat streaki: oxirgi belgilangan kundan orqaga ketma-ket "completed"/"frozen".
 *    "partial" va "missed" streakni uzadi. Bugun belgilanmagan bo'lsa, kechadan
 *    boshlab sanaladi (kun hali tugamagan).
 *  - Foydalanuvchi streaki: ketma-ket kunlar, har birida kamida bitta odat
 *    "completed" (yoki frozen) bo'lgan va "completed" bor.
 */
import { addDays, dateKeyFromTimestamp, diffDays, monthEnd, monthStart, rangeKeys, weekDays, weekStart, DEFAULT_TIMEZONE, type DateKey } from "../dates"

export type RawStatus = "completed" | "partial" | "missed" | "frozen"

export interface HabitLike {
  id: number
  name?: string
  duration: number
  startDate: { timestamp: number }
  days?: Record<number | string, string | undefined> | null
}

export type DayState = "notDue" | "pending" | RawStatus

export interface DayResult {
  state: DayState
  /** Kun tugagan, lekin yozuv yo'q bo'lgani uchun "missed" deb hisoblangan */
  inferred: boolean
}

export interface Tally {
  due: number // completed + partial + missed (frozen va pending kirmaydi)
  completed: number
  partial: number
  missed: number
  frozen: number
  pending: number
}

export const emptyTally = (): Tally => ({ due: 0, completed: 0, partial: 0, missed: 0, frozen: 0, pending: 0 })

export function habitStartKey(h: HabitLike, tz: string): DateKey {
  return dateKeyFromTimestamp(h.startDate.timestamp, tz)
}

export function habitEndKey(h: HabitLike, tz: string): DateKey {
  return addDays(habitStartKey(h, tz), Math.max(0, h.duration - 1))
}

export function dateForDayIndex(h: HabitLike, dayIndex: number, tz: string): DateKey {
  return addDays(habitStartKey(h, tz), dayIndex)
}

export function dayIndexForDate(h: HabitLike, date: DateKey, tz: string): number {
  return diffDays(habitStartKey(h, tz), date)
}

function normalizeStatus(s: unknown): RawStatus | null {
  return s === "completed" || s === "partial" || s === "missed" || s === "frozen" ? s : null
}

/** Bitta odatning bitta kalendar kunidagi holati. */
export function dayResult(h: HabitLike, date: DateKey, today: DateKey, tz: string): DayResult {
  const idx = dayIndexForDate(h, date, tz)
  if (idx < 0 || idx >= h.duration || date > today) return { state: "notDue", inferred: false }
  const recorded = normalizeStatus(h.days?.[idx])
  if (recorded) return { state: recorded, inferred: false }
  if (date === today) return { state: "pending", inferred: false }
  return { state: "missed", inferred: true }
}

function addToTally(t: Tally, state: DayState) {
  switch (state) {
    case "completed": t.completed++; t.due++; break
    case "partial": t.partial++; t.due++; break
    case "missed": t.missed++; t.due++; break
    case "frozen": t.frozen++; break
    case "pending": t.pending++; break
  }
}

/** Sana oralig'i bo'yicha jamlama (barcha odatlar, har bir kun uchun). */
export function tallyRange(habits: HabitLike[], from: DateKey, to: DateKey, today: DateKey, tz: string): Tally {
  const t = emptyTally()
  const end = to > today ? today : to
  if (from > end) return t
  for (const date of rangeKeys(from, end)) {
    for (const h of habits) addToTally(t, dayResult(h, date, today, tz).state)
  }
  return t
}

/** completed / due, due == 0 bo'lsa null (ma'lumot yo'q - 0% emas). */
export function rate(t: Tally): number | null {
  return t.due === 0 ? null : Math.round((t.completed / t.due) * 1000) / 10
}

// ───────────────────────── Streak ─────────────────────────

export interface HabitStreak { current: number; longest: number }

export function habitStreak(h: HabitLike, today: DateKey, tz: string): HabitStreak {
  const start = habitStartKey(h, tz)
  const last = addDays(start, Math.max(0, h.duration - 1))
  const stop = last < today ? last : today
  if (stop < start) return { current: 0, longest: 0 }

  let longest = 0
  let run = 0
  const perDay: DayState[] = []
  for (const date of rangeKeys(start, stop)) {
    const { state } = dayResult(h, date, today, tz)
    perDay.push(state)
    if (state === "completed") { run++; longest = Math.max(longest, run) }
    else if (state === "frozen" || state === "pending") { /* uzmaydi, oshirmaydi */ }
    else run = 0
  }

  // Joriy streak: oxirgidan orqaga. Bugun "pending" bo'lsa, o'tkazib yuboramiz.
  let current = 0
  for (let i = perDay.length - 1; i >= 0; i--) {
    const s = perDay[i]
    if (s === "completed") current++
    else if (s === "frozen" || s === "pending") continue
    else break
  }
  return { current, longest }
}

export interface UserStreak { current: number; longest: number }

/** Foydalanuvchi darajasidagi streak: kamida bitta odat bajarilgan ketma-ket kunlar. */
export function userStreak(habits: HabitLike[], today: DateKey, tz: string): UserStreak {
  if (habits.length === 0) return { current: 0, longest: 0 }
  const first = habits.map((h) => habitStartKey(h, tz)).sort()[0]
  if (first > today) return { current: 0, longest: 0 }

  const dayOk = new Map<DateKey, "ok" | "neutral" | "bad">()
  for (const date of rangeKeys(first, today)) {
    let anyDue = false, anyCompleted = false, anyFrozen = false
    for (const h of habits) {
      const { state } = dayResult(h, date, today, tz)
      if (state === "notDue") continue
      anyDue = true
      if (state === "completed") anyCompleted = true
      if (state === "frozen") anyFrozen = true
    }
    // Hech qaysi odat belgilanmagan kun uzmaydi (odat yo'q) - faqat bugun kutilmoqda bo'lishi mumkin
    if (anyCompleted) dayOk.set(date, "ok")
    else if (!anyDue || anyFrozen) dayOk.set(date, "neutral")
    else dayOk.set(date, date === today ? "neutral" : "bad")
  }

  let longest = 0, run = 0
  for (const date of rangeKeys(first, today)) {
    const v = dayOk.get(date)!
    if (v === "ok") { run++; longest = Math.max(longest, run) } else if (v === "bad") run = 0
  }
  let current = 0
  for (let d = today; d >= first; d = addDays(d, -1)) {
    const v = dayOk.get(d)!
    if (v === "ok") current++
    else if (v === "neutral") continue
    else break
  }
  return { current, longest }
}

// ───────────────────────── Yig'ma statistika ─────────────────────────

export interface HabitOverview {
  totalHabits: number
  activeHabits: number
  upcomingHabits: number
  finishedHabits: number
  today: Tally & { rate: number | null }
  week: Tally & { rate: number | null }
  month: Tally & { rate: number | null }
  overall: Tally & { rate: number | null }
  streak: UserStreak
}

export function computeOverview(habits: HabitLike[], tz: string = DEFAULT_TIMEZONE, now: number = Date.now()): HabitOverview {
  const today = dateKeyFromTimestamp(now, tz)
  let active = 0, upcoming = 0, finished = 0
  for (const h of habits) {
    const s = habitStartKey(h, tz), e = habitEndKey(h, tz)
    if (s > today) upcoming++
    else if (e < today) finished++
    else active++
  }
  const withRate = (t: Tally) => ({ ...t, rate: rate(t) })
  const first = habits.length ? habits.map((h) => habitStartKey(h, tz)).sort()[0] : today
  return {
    totalHabits: habits.length,
    activeHabits: active,
    upcomingHabits: upcoming,
    finishedHabits: finished,
    today: withRate(tallyRange(habits, today, today, today, tz)),
    week: withRate(tallyRange(habits, weekStart(today), addDays(weekStart(today), 6), today, tz)),
    month: withRate(tallyRange(habits, monthStart(today), monthEnd(today), today, tz)),
    overall: withRate(tallyRange(habits, first, today, today, tz)),
    streak: userStreak(habits, today, tz),
  }
}

export interface DailyPoint extends Tally { date: DateKey; rate: number | null; hasData: boolean }

export function dailySeries(habits: HabitLike[], from: DateKey, to: DateKey, tz: string = DEFAULT_TIMEZONE, now: number = Date.now()): DailyPoint[] {
  const today = dateKeyFromTimestamp(now, tz)
  return rangeKeys(from, to).map((date) => {
    const t = tallyRange(habits, date, date, today, tz)
    return { date, ...t, rate: rate(t), hasData: t.due + t.frozen + t.pending > 0 && date <= today }
  })
}

export interface PeriodPoint extends Tally { label: DateKey; rate: number | null }

export function weeklySeries(habits: HabitLike[], weeks: number, tz: string = DEFAULT_TIMEZONE, now: number = Date.now()): PeriodPoint[] {
  const today = dateKeyFromTimestamp(now, tz)
  const out: PeriodPoint[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(weekStart(today), -7 * i)
    const t = tallyRange(habits, start, addDays(start, 6), today, tz)
    out.push({ label: start, ...t, rate: rate(t) })
  }
  return out
}

export function monthlySeries(habits: HabitLike[], months: number, tz: string = DEFAULT_TIMEZONE, now: number = Date.now()): PeriodPoint[] {
  const today = dateKeyFromTimestamp(now, tz)
  const [y, m] = today.split("-").map(Number)
  const out: PeriodPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    const start = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`
    const t = tallyRange(habits, start, monthEnd(start), today, tz)
    out.push({ label: start, ...t, rate: rate(t) })
  }
  return out
}

export interface HabitProgress extends Tally {
  habitId: number
  name?: string
  rate: number | null
  streak: HabitStreak
  daysElapsed: number // bugungacha o'tgan kunlar (boshlanish kunidan)
  duration: number
  status: "upcoming" | "active" | "finished"
}

export function habitProgress(h: HabitLike, tz: string = DEFAULT_TIMEZONE, now: number = Date.now()): HabitProgress {
  const today = dateKeyFromTimestamp(now, tz)
  const s = habitStartKey(h, tz), e = habitEndKey(h, tz)
  const t = tallyRange([h], s, e, today, tz)
  return {
    habitId: h.id, name: h.name, ...t, rate: rate(t),
    streak: habitStreak(h, today, tz),
    daysElapsed: Math.max(0, Math.min(h.duration, diffDays(s, today) + 1)),
    duration: h.duration,
    status: s > today ? "upcoming" : e < today ? "finished" : "active",
  }
}

/** Haftaning 7 kuni uchun ixcham ko'rinish (dashboard). */
export function currentWeekSeries(habits: HabitLike[], tz: string = DEFAULT_TIMEZONE, now: number = Date.now()): DailyPoint[] {
  const today = dateKeyFromTimestamp(now, tz)
  const days = weekDays(today)
  return dailySeries(habits, days[0], days[6], tz, now)
}
