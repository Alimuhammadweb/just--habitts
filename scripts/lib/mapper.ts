/**
 * MongoDB hujjatlari → PostgreSQL qatorlari (sof funksiyalar, hech qanday I/O yo'q).
 * Yomon/yetishmayotgan ma'lumot bo'lsa, xavfsiz qiymat qo'yiladi yoki yozuv `skipped` sifatida hisobotga tushadi.
 */
export type Doc = Record<string, any>

export const MAX_I32 = 2147483647
export const i32 = (v: unknown, d = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(-2147483648, Math.min(MAX_I32, Math.trunc(n))) : d
}
export const i64 = (v: unknown, d = BigInt(0)): bigint => {
  const n = Number(v)
  return Number.isFinite(n) ? BigInt(Math.trunc(n)) : d
}
export const i64n = (v: unknown): bigint | null => (v == null || !Number.isFinite(Number(v)) ? null : BigInt(Math.trunc(Number(v))))
export const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : v == null ? d : String(v))
export const optStr = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null)
export const intArr = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter(Number.isFinite).map(Math.trunc) : [])
export const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : [])
export const bool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d)

export function toDate(v: unknown, fallback: Date): Date {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d
  }
  return fallback
}

export interface MappedHabit {
  habit: {
    id: bigint; userId: bigint; position: number; name: string; duration: number
    timeHour: number | null; timeMinute: number | null; notifications: boolean
    startDay: number; startMonth: number; startYear: number; startTimestamp: bigint
    scheduledStartTime: bigint | null; why: string
  }
  days: {
    habitId: bigint; dayIndex: number; status: string | null; lockStatus: string | null; markedAt: bigint | null
    dateString: string | null; xpAwarded: number | null; locked: boolean | null; missReason: string | null
  }[]
}

export interface MappedUser {
  id: number
  email: string
  data: Record<string, unknown> // User jadvali ustunlari (id'siz)
  habits: MappedHabit[]
  xpHistory: { userId: bigint; date: string; xpEarned: number; habitId: bigint; dayIndex: number; status: string; timestamp: bigint }[]
  pomodoro: { userId: bigint; sessionId: bigint; date: string; count: number }[]
  challenges: {
    userId: bigint; challengeId: number; startedAt: bigint; completedDays: number[]; isCompleted: boolean
    completedAt: bigint | null; startDateKey: string | null; endDateKey: string | null; attempt: number | null
  }[]
  friends: number[]
  incoming: number[]
  outgoing: number[]
  warnings: string[]
}

export function mapUser(doc: Doc, newHabitId: (original: bigint, userId: number) => bigint): MappedUser | { error: string } {
  const id = Number(doc.id)
  if (!Number.isSafeInteger(id)) return { error: "id yaroqsiz" }
  const email = str(doc.email).trim().toLowerCase()
  if (!email) return { error: "email yo'q" }
  const warnings: string[] = []
  const createdAt = toDate(doc.createdAt, new Date(0))
  if (!(doc.createdAt instanceof Date) && Number.isNaN(new Date(doc.createdAt).getTime())) warnings.push("createdAt yaroqsiz")
  const uid = BigInt(id)
  const stats = doc.stats ?? {}
  const xp = doc.xpData ?? {}
  const pomo = doc.pomodoroData ?? {}

  const data: Record<string, unknown> = {
    name: str(doc.name, "Foydalanuvchi") || "Foydalanuvchi",
    email,
    password: str(doc.password),
    salt: optStr(doc.salt),
    createdAt,
    isActive: doc.isActive === false ? false : true,
    isAdmin: bool(doc.isAdmin),
    timezone: optStr(doc.timezone),
    avatarUrl: optStr(doc.avatarUrl),
    firstName: optStr(doc.firstName),
    lastName: optStr(doc.lastName),
    publicProfile: bool(doc.publicProfile),
    selectedTheme: optStr(doc.selectedTheme), selectedBadge: optStr(doc.selectedBadge), selectedBorder: optStr(doc.selectedBorder),
    selectedFrame: optStr(doc.selectedFrame), selectedBackground: optStr(doc.selectedBackground),
    statsTotalHabits: i32(stats.totalHabits), statsCompletedDays: i32(stats.completedDays),
    statsCurrentStreak: i32(stats.currentStreak), statsLongestStreak: i32(stats.longestStreak),
    totalXP: i32(xp.totalXP), level: i32(xp.level, 1), rank: xp.rank == null ? null : i32(xp.rank),
    weeklyXP: i32(xp.weeklyXP), monthlyXP: i32(xp.monthlyXP), weekKey: optStr(xp.weekKey),
    currentXP: i32(xp.currentXP), xpLastUpdated: i64(xp.lastUpdated),
    streakFreezes: i32(doc.streakFreezes, 0), totalFreezesUsed: i32(doc.totalFreezesUsed), lastFreezeEarned: i64n(doc.lastFreezeEarned),
    pomodoroTotal: i32(pomo.totalPomodoros),
    unlockedAvatars: strArr(doc.unlockedAvatars), unlockedThemes: strArr(doc.unlockedThemes), unlockedBadges: strArr(doc.unlockedBadges),
    unlockedBorders: strArr(doc.unlockedBorders), unlockedFrames: strArr(doc.unlockedFrames), unlockedBackgrounds: strArr(doc.unlockedBackgrounds),
    completedTasks: intArr(doc.completedTasks), completedChallenges: intArr(doc.completedChallenges),
    challengeRewards: Array.isArray(doc.challengeRewards) ? doc.challengeRewards : [],
    plannedHabits: Array.isArray(doc.plannedHabits) ? doc.plannedHabits : [],
    rev: i32(doc._rev, 0),
  }

  // Odatlar
  const habits: MappedHabit[] = []
  const habitIdMap = new Map<string, bigint>() // eski id → yangi id (to'qnashuv bo'lsa)
  const seenHere = new Set<string>()
  ;(Array.isArray(doc.habits) ? doc.habits : []).forEach((h: Doc, position: number) => {
    const origId = i64n(h?.id)
    if (origId == null) { warnings.push(`odat #${position}: id yo'q — o'tkazib yuborildi`); return }
    if (seenHere.has(String(origId))) { warnings.push(`odat ${origId}: foydalanuvchi ichida takroriy id — o'tkazib yuborildi`); return }
    seenHere.add(String(origId))
    const habitId = newHabitId(origId, id)
    if (habitId !== origId) { habitIdMap.set(String(origId), habitId); warnings.push(`odat ${origId}: id boshqa foydalanuvchida band — yangi id berildi`) }

    const sd = h.startDate ?? {}
    const startTs = i64n(sd.timestamp) ?? i64n(h.scheduledStartTime) ?? BigInt(createdAt.getTime())
    const sdt = new Date(Number(startTs))
    const habit = {
      id: habitId, userId: uid, position, name: str(h.name, "Odat") || "Odat", duration: i32(h.duration, 21),
      timeHour: h.time && h.time.hour != null ? i32(h.time.hour) : null,
      timeMinute: h.time && h.time.hour != null ? i32(h.time.minute) : null,
      notifications: bool(h.notifications),
      startDay: i32(sd.day, sdt.getDate()), startMonth: i32(sd.month, sdt.getMonth() + 1), startYear: i32(sd.year, sdt.getFullYear()),
      startTimestamp: startTs, scheduledStartTime: i64n(h.scheduledStartTime), why: str(h.why),
    }
    const days: MappedHabit["days"] = []
    const keys = new Set([...Object.keys(h.days ?? {}), ...Object.keys(h.dayLocks ?? {}), ...Object.keys(h.missReasons ?? {})])
    for (const k of keys) {
      const dayIndex = Number(k)
      if (!Number.isInteger(dayIndex)) continue
      const lock = h.dayLocks?.[k]
      days.push({
        habitId, dayIndex,
        status: optStr(h.days?.[k]),
        lockStatus: lock ? optStr(lock.status) : null,
        markedAt: lock ? i64(lock.markedAt) : null,
        dateString: lock ? optStr(lock.dateString) : null,
        xpAwarded: lock && lock.xpAwarded != null ? i32(lock.xpAwarded) : null,
        locked: lock ? bool(lock.locked) : null,
        missReason: typeof h.missReasons?.[k] === "string" ? h.missReasons[k] : null,
      })
    }
    habits.push({ habit, days })
  })

  const xpHistory = (Array.isArray(xp.xpHistory) ? xp.xpHistory : []).map((x: Doc) => {
    const orig = i64(x?.habitId)
    return {
      userId: uid, date: str(x?.date), xpEarned: i32(x?.xpEarned), habitId: habitIdMap.get(String(orig)) ?? orig,
      dayIndex: i32(x?.dayIndex), status: str(x?.status), timestamp: i64(x?.timestamp),
    }
  })

  const pomodoro = (Array.isArray(pomo.sessions) ? pomo.sessions : []).map((s: Doc) => ({
    userId: uid, sessionId: i64(s?.id), date: str(s?.date), count: i32(s?.count),
  }))

  const challenges = (Array.isArray(doc.activeChallenges) ? doc.activeChallenges : []).map((c: Doc) => ({
    userId: uid, challengeId: i32(c?.challengeId), startedAt: i64(c?.startedAt), completedDays: intArr(c?.completedDays),
    isCompleted: bool(c?.isCompleted), completedAt: i64n(c?.completedAt), startDateKey: optStr(c?.startDateKey),
    endDateKey: optStr(c?.endDateKey), attempt: c?.attempt == null ? null : i32(c.attempt),
  }))

  return {
    id, email, data, habits, xpHistory, pomodoro, challenges,
    friends: intArr(doc.friends), incoming: intArr(doc.friendRequests), outgoing: intArr(doc.sentRequests), warnings,
  }
}

export function mapTask(doc: Doc): { id: string; data: Record<string, unknown> } | { error: string } {
  const rawId = doc._id
  const id = rawId && typeof rawId.toHexString === "function" ? rawId.toHexString() : rawId != null ? String(rawId) : ""
  if (!id) return { error: "_id yo'q" }
  const userId = Number(doc.userId)
  if (!Number.isSafeInteger(userId)) return { error: "userId yaroqsiz" }
  const now = new Date()
  const createdAt = toDate(doc.createdAt, now)
  return {
    id,
    data: {
      id, userId: BigInt(userId), title: str(doc.title, "Vazifa") || "Vazifa", description: str(doc.description),
      date: str(doc.date), time: optStr(doc.time), durationMin: doc.durationMin == null ? null : i32(doc.durationMin),
      category: str(doc.category, "other"), priority: str(doc.priority, "medium"),
      reminderMin: doc.reminderMin == null ? null : i32(doc.reminderMin),
      completed: bool(doc.completed), completedAt: doc.completedAt ? toDate(doc.completedAt, now) : null,
      createdAt, updatedAt: toDate(doc.updatedAt, createdAt),
    },
  }
}
