import type { PrismaClient, Prisma as PrismaNs } from "@/generated/prisma/client"
import { db, big, num } from "@/lib/prisma"
import type { Habit, User, DayStatus, ActiveChallenge, XPHistory } from "@/types/user"
import { resolveTimezone } from "@/lib/dates"

export type UserDoc = User & { _rev?: number; salt?: string; timezone?: string }

type Db = PrismaClient | PrismaNs.TransactionClient

// ───────────────────────────── yuklash (DB qatorlari → User obyekti) ─────────────────────────────

export const userInclude = {
  habits: { include: { days: true }, orderBy: [{ position: "asc" }, { id: "asc" }] },
  xpHistory: { orderBy: { id: "asc" } },
  pomodoroSessions: { orderBy: { pk: "asc" } },
  activeChallenges: { orderBy: { pk: "asc" } },
  friendships: true,
  sentRequests: true,
  receivedRequests: true,
} satisfies PrismaNs.UserInclude

type UserRow = PrismaNs.UserGetPayload<{ include: typeof userInclude }>
type HabitRow = UserRow["habits"][number]

function rowToHabit(h: HabitRow): Habit {
  const days: Record<number, DayStatus> = {}
  const dayLocks: Habit["dayLocks"] = {}
  const missReasons: Record<number, string> = {}
  for (const d of h.days) {
    if (d.status) days[d.dayIndex] = d.status as DayStatus
    if (d.lockStatus != null) {
      dayLocks[d.dayIndex] = {
        status: d.lockStatus as DayStatus,
        markedAt: Number(d.markedAt ?? 0),
        dateString: d.dateString ?? "",
        xpAwarded: d.xpAwarded ?? 0,
        locked: Boolean(d.locked),
      }
    }
    if (d.missReason != null) missReasons[d.dayIndex] = d.missReason
  }
  return {
    id: Number(h.id), name: h.name, duration: h.duration,
    days, dayLocks,
    time: h.timeHour != null ? { hour: h.timeHour, minute: h.timeMinute ?? 0 } : null,
    notifications: h.notifications,
    startDate: { day: h.startDay, month: h.startMonth, year: h.startYear, timestamp: Number(h.startTimestamp) },
    ...(h.scheduledStartTime != null ? { scheduledStartTime: Number(h.scheduledStartTime) } : {}),
    why: h.why, missReasons,
  }
}

export function rowToUser(r: UserRow): UserDoc {
  return {
    id: Number(r.id), name: r.name, email: r.email, password: r.password,
    ...(r.salt ? { salt: r.salt } : {}),
    createdAt: r.createdAt.toISOString(), isActive: r.isActive, isAdmin: r.isAdmin,
    ...(r.timezone ? { timezone: r.timezone } : {}),
    habits: r.habits.map(rowToHabit),
    stats: { totalHabits: r.statsTotalHabits, completedDays: r.statsCompletedDays, currentStreak: r.statsCurrentStreak, longestStreak: r.statsLongestStreak },
    pomodoroData: {
      sessions: r.pomodoroSessions.map((s) => ({ id: Number(s.sessionId), date: s.date, count: s.count })),
      totalPomodoros: r.pomodoroTotal,
    },
    xpData: {
      totalXP: r.totalXP, level: r.level, rank: r.rank, weeklyXP: r.weeklyXP, monthlyXP: r.monthlyXP,
      ...(r.weekKey ? { weekKey: r.weekKey } : {}),
      xpHistory: r.xpHistory.map((x): XPHistory => ({
        date: x.date, xpEarned: x.xpEarned, habitId: Number(x.habitId), dayIndex: x.dayIndex,
        status: x.status as DayStatus, timestamp: Number(x.timestamp),
      })),
      currentXP: r.currentXP, lastUpdated: Number(r.xpLastUpdated),
    },
    ...(r.avatarUrl ? { avatarUrl: r.avatarUrl } : {}),
    ...(r.firstName ? { firstName: r.firstName } : {}),
    ...(r.lastName ? { lastName: r.lastName } : {}),
<<<<<<< HEAD
    publicProfile: r.publicProfile, googleLinked: r.googleSub != null, telegramLinked: r.telegramId != null,
=======
    publicProfile: r.publicProfile,
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d
    unlockedAvatars: r.unlockedAvatars, unlockedThemes: r.unlockedThemes, unlockedBadges: r.unlockedBadges,
    unlockedBorders: r.unlockedBorders, unlockedFrames: r.unlockedFrames, unlockedBackgrounds: r.unlockedBackgrounds,
    completedTasks: r.completedTasks,
    plannedHabits: (r.plannedHabits as unknown as Habit[]) ?? [],
    friends: r.friendships.map((f) => Number(f.friendId)),
    friendRequests: r.receivedRequests.map((q) => Number(q.fromId)),
    sentRequests: r.sentRequests.map((q) => Number(q.toId)),
    streakFreezes: r.streakFreezes, totalFreezesUsed: r.totalFreezesUsed,
    ...(r.lastFreezeEarned != null ? { lastFreezeEarned: Number(r.lastFreezeEarned) } : {}),
    ...(r.selectedTheme ? { selectedTheme: r.selectedTheme } : {}),
    ...(r.selectedBadge ? { selectedBadge: r.selectedBadge } : {}),
    ...(r.selectedBorder ? { selectedBorder: r.selectedBorder } : {}),
    ...(r.selectedFrame ? { selectedFrame: r.selectedFrame } : {}),
    ...(r.selectedBackground ? { selectedBackground: r.selectedBackground } : {}),
    activeChallenges: r.activeChallenges.map((c): ActiveChallenge => ({
      challengeId: c.challengeId, startedAt: Number(c.startedAt), completedDays: c.completedDays, isCompleted: c.isCompleted,
      ...(c.completedAt != null ? { completedAt: Number(c.completedAt) } : {}),
      ...(c.startDateKey ? { startDateKey: c.startDateKey } : {}),
      ...(c.endDateKey ? { endDateKey: c.endDateKey } : {}),
      ...(c.attempt != null ? { attempt: c.attempt } : {}),
    })),
    completedChallenges: r.completedChallenges,
    challengeRewards: (r.challengeRewards as unknown as User["challengeRewards"]) ?? [],
    _rev: r.rev,
  }
}

export async function findUserById(id: number): Promise<UserDoc | null> {
  const row = await db().user.findUnique({ where: { id: big(id) }, include: userInclude })
  return row ? rowToUser(row) : null
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const row = await db().user.findUnique({ where: { email }, include: userInclude })
  return row ? rowToUser(row) : null
}

export async function listAllUsers(): Promise<UserDoc[]> {
  const rows = await db().user.findMany({ include: userInclude, orderBy: { createdAt: "asc" } })
  return rows.map(rowToUser)
}

// ───────────────────────────── yozish (User obyekti → DB qatorlari) ─────────────────────────────

const BIGINT_COLS = new Set(["xpLastUpdated", "lastFreezeEarned"])
const emptyToNull = (v: string | undefined) => (v === undefined || v === "" ? null : v)

/** User obyektining oddiy (skalyar) ustunlarga mos qiymatlari. */
function scalarCols(u: UserDoc): Record<string, unknown> {
  return {
    name: u.name, email: u.email, isActive: u.isActive, isAdmin: u.isAdmin,
    timezone: emptyToNull(u.timezone), avatarUrl: emptyToNull(u.avatarUrl),
    firstName: emptyToNull(u.firstName), lastName: emptyToNull(u.lastName), publicProfile: u.publicProfile,
    selectedTheme: emptyToNull(u.selectedTheme), selectedBadge: emptyToNull(u.selectedBadge),
    selectedBorder: emptyToNull(u.selectedBorder), selectedFrame: emptyToNull(u.selectedFrame),
    selectedBackground: emptyToNull(u.selectedBackground),
    statsTotalHabits: u.stats?.totalHabits ?? 0, statsCompletedDays: u.stats?.completedDays ?? 0,
    statsCurrentStreak: u.stats?.currentStreak ?? 0, statsLongestStreak: u.stats?.longestStreak ?? 0,
    totalXP: u.xpData?.totalXP ?? 0, level: u.xpData?.level ?? 1, rank: u.xpData?.rank ?? null,
    weeklyXP: u.xpData?.weeklyXP ?? 0, monthlyXP: u.xpData?.monthlyXP ?? 0, weekKey: u.xpData?.weekKey ?? null,
    currentXP: u.xpData?.currentXP ?? 0, xpLastUpdated: u.xpData?.lastUpdated ?? 0,
    streakFreezes: u.streakFreezes ?? 0, totalFreezesUsed: u.totalFreezesUsed ?? 0, lastFreezeEarned: u.lastFreezeEarned ?? null,
    pomodoroTotal: u.pomodoroData?.totalPomodoros ?? 0,
    unlockedAvatars: u.unlockedAvatars ?? [], unlockedThemes: u.unlockedThemes ?? [], unlockedBadges: u.unlockedBadges ?? [],
    unlockedBorders: u.unlockedBorders ?? [], unlockedFrames: u.unlockedFrames ?? [], unlockedBackgrounds: u.unlockedBackgrounds ?? [],
    completedTasks: u.completedTasks ?? [], completedChallenges: u.completedChallenges ?? [],
    challengeRewards: u.challengeRewards ?? [], plannedHabits: u.plannedHabits ?? [],
  }
}

function toDbCols(cols: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(cols)) {
    out[k] = BIGINT_COLS.has(k) && v != null ? big(Number(v)) : v
  }
  return out
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function habitRows(userId: number, h: Habit, position: number) {
  const habit = {
    id: big(h.id), userId: big(userId), position, name: h.name, duration: h.duration,
    timeHour: h.time?.hour ?? null, timeMinute: h.time?.minute ?? null,
    notifications: Boolean(h.notifications),
    startDay: h.startDate.day, startMonth: h.startDate.month, startYear: h.startDate.year, startTimestamp: big(h.startDate.timestamp),
    scheduledStartTime: h.scheduledStartTime != null ? big(h.scheduledStartTime) : null,
    why: h.why ?? "",
  }
  const keys = new Set([...Object.keys(h.days || {}), ...Object.keys(h.dayLocks || {}), ...Object.keys(h.missReasons || {})])
  const days: PrismaNs.HabitDayCreateManyInput[] = []
  for (const k of keys) {
    const dayIndex = Number(k)
    if (!Number.isInteger(dayIndex)) continue
    const lock = h.dayLocks?.[dayIndex]
    days.push({
      habitId: habit.id, dayIndex,
      status: h.days?.[dayIndex] ?? null,
      lockStatus: lock?.status ?? null,
      markedAt: lock ? big(lock.markedAt ?? 0) : null,
      dateString: lock?.dateString ?? null,
      xpAwarded: lock?.xpAwarded ?? null,
      locked: lock ? Boolean(lock.locked) : null,
      missReason: h.missReasons?.[dayIndex] ?? null,
    })
  }
  return { habit, days }
}

type Plan = {
  scalars: Record<string, unknown>
  habitsChanged: boolean
  xp: "none" | "append" | "replace"
  pomodoro: boolean
  challenges: boolean
}

function plan(before: UserDoc, after: UserDoc): Plan {
  const a = scalarCols(before), b = scalarCols(after)
  const scalars: Record<string, unknown> = {}
  for (const k of Object.keys(b)) if (!same(a[k], b[k])) scalars[k] = b[k]

  const bx = before.xpData?.xpHistory || [], ax = after.xpData?.xpHistory || []
  let xp: Plan["xp"] = "none"
  if (!same(bx, ax)) xp = ax.length >= bx.length && same(ax.slice(0, bx.length), bx) ? "append" : "replace"

  return {
    scalars,
    habitsChanged: !same(before.habits || [], after.habits || []),
    xp,
    pomodoro: !same(before.pomodoroData?.sessions || [], after.pomodoroData?.sessions || []),
    challenges: !same(before.activeChallenges || [], after.activeChallenges || []),
  }
}

const hasChanges = (p: Plan) => Object.keys(p.scalars).length > 0 || p.habitsChanged || p.xp !== "none" || p.pomodoro || p.challenges

async function writeChanges(tx: Db, userId: number, before: UserDoc, after: UserDoc, p: Plan) {
  const uid = big(userId)

  if (p.habitsChanged) {
    const bMap = new Map((before.habits || []).map((h) => [h.id, JSON.stringify(h)]))
    const afterHabits = after.habits || []
    const keep = new Set(afterHabits.map((h) => h.id))
    const removed = (before.habits || []).filter((h) => !keep.has(h.id)).map((h) => big(h.id))
    if (removed.length) await tx.habit.deleteMany({ where: { userId: uid, id: { in: removed } } })
    for (let i = 0; i < afterHabits.length; i++) {
      const h = afterHabits[i]
      const unchanged = bMap.get(h.id) === JSON.stringify(h)
      const { habit, days } = habitRows(userId, h, i)
      if (unchanged) {
        // faqat tartib o'zgargan bo'lishi mumkin
        const prevPos = (before.habits || []).findIndex((x) => x.id === h.id)
        if (prevPos !== i) await tx.habit.update({ where: { id: habit.id }, data: { position: i } })
        continue
      }
      const { id: _id, userId: _u, ...data } = habit
      await tx.habit.upsert({ where: { id: habit.id }, create: habit, update: data })
      await tx.habitDay.deleteMany({ where: { habitId: habit.id } })
      if (days.length) await tx.habitDay.createMany({ data: days })
    }
  }

  if (p.xp !== "none") {
    const bx = before.xpData?.xpHistory || [], ax = after.xpData?.xpHistory || []
    const toRow = (x: XPHistory) => ({ userId: uid, date: x.date, xpEarned: x.xpEarned, habitId: big(x.habitId), dayIndex: x.dayIndex, status: x.status, timestamp: big(x.timestamp) })
    if (p.xp === "append") {
      await tx.xpHistory.createMany({ data: ax.slice(bx.length).map(toRow) })
    } else {
      await tx.xpHistory.deleteMany({ where: { userId: uid } })
      if (ax.length) await tx.xpHistory.createMany({ data: ax.map(toRow) })
    }
  }

  if (p.pomodoro) {
    const sessions = after.pomodoroData?.sessions || []
    await tx.pomodoroSession.deleteMany({ where: { userId: uid } })
    if (sessions.length) await tx.pomodoroSession.createMany({ data: sessions.map((s) => ({ userId: uid, sessionId: big(s.id), date: s.date, count: s.count })) })
  }

  if (p.challenges) {
    const list = after.activeChallenges || []
    await tx.activeChallenge.deleteMany({ where: { userId: uid } })
    if (list.length) {
      await tx.activeChallenge.createMany({
        data: list.map((c) => ({
          userId: uid, challengeId: c.challengeId, startedAt: big(c.startedAt), completedDays: c.completedDays || [],
          isCompleted: Boolean(c.isCompleted), completedAt: c.completedAt != null ? big(c.completedAt) : null,
          startDateKey: c.startDateKey ?? null, endDateKey: c.endDateKey ?? null, attempt: c.attempt ?? null,
        })),
      })
    }
  }
}

export function sanitizeUser(u: UserDoc | null): User | null {
  if (!u) return null
  const { password, salt, _rev, ...clean } = u
  return clean as unknown as User
}

export function userTimezone(u: { timezone?: string | null } | null | undefined): string {
  return resolveTimezone(u?.timezone ?? undefined)
}

/**
 * Optimistik parallelizm nazorati bilan o'qish-o'zgartirish-yozish.
 * `rev` ustuni mos kelmasa (boshqa so'rov oldinroq yozgan), yozuv rad etiladi
 * va funksiya yangi holat bilan qayta ishga tushiriladi. Barcha yozuvlar bitta tranzaksiyada.
 */
export async function mutateUser<T>(
  userId: number,
  fn: (user: UserDoc) => { user: UserDoc; result: T } | null,
  retries = 12,
): Promise<{ found: false } | { found: true; changed: boolean; user: UserDoc; result: T | null }> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const doc = await findUserById(userId)
    if (!doc) return { found: false }
    const out = fn(doc)
    if (!out) return { found: true, changed: false, user: doc, result: null }

    const p = plan(doc, out.user)
    if (!hasChanges(p)) return { found: true, changed: false, user: doc, result: out.result }

    const rev = doc._rev ?? 0
    const ok = await db().$transaction(async (tx) => {
      const claimed = await tx.user.updateMany({
        where: { id: big(userId), rev },
        data: { ...toDbCols(p.scalars), rev: { increment: 1 } } as never,
      })
      if (claimed.count !== 1) return false
      await writeChanges(tx, userId, doc, out.user, p)
      return true
    }, { timeout: 20_000, maxWait: 10_000 })

    if (ok) return { found: true, changed: true, user: { ...out.user, _rev: rev + 1 }, result: out.result }
    // Parallel so'rovlar bir-birini bosib o'tmasligi uchun tasodifiy kutish (jitter)
    await new Promise((r) => setTimeout(r, Math.random() * 25 * (attempt + 1)))
  }
  throw new Error("Ma'lumot parallel o'zgartirilmoqda, qayta urinib ko'ring")
}

/** Yangi foydalanuvchini barcha boshlang'ich qiymatlari bilan yaratadi. */
export async function createUserRecord(u: UserDoc): Promise<void> {
  const cols = toDbCols(scalarCols(u))
  await db().user.create({
    data: { id: big(u.id), password: u.password, createdAt: new Date(u.createdAt), ...cols } as never,
  })
}

/** Profil maydonlarini (XP/odatlarga tegmasdan) yangilaydi. Foydalanuvchi topilmasa false. */
export async function updateUserColumns(userId: number, data: Record<string, unknown>): Promise<boolean> {
  const r = await db().user.updateMany({ where: { id: big(userId) }, data: data as never })
  return r.count > 0
}

export { num }
