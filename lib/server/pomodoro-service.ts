/**
 * Pomodoro xizmati: barcha holat PostgreSQL'da (PomodoroRun / PomodoroSettings), vaqt TIMESTAMP bilan hisoblanadi.
 *
 * Takrorlanmaslik kafolati:
 *  - Fokus seans yakunlanishi bitta atomik o'tish: `UPDATE ... WHERE id AND status='running' AND resumedAt=<o'qilgan> AND elapsedMs=<o'qilgan>`.
 *    Faqat shu UPDATE 1 qatorga tegsa (g'olib) statistika yoziladi — va bu bitta tranzaksiyada (mutateUser hook).
 *  - Parallel pauza/yakunlash/qayta chaqiruvlar bir xil qatorga bog'langan, shuning uchun faqat bittasi g'olib bo'ladi.
 *  - Boshlash: foydalanuvchi bo'yicha pg_advisory_xact_lock — bir vaqtda ikkita faol taymer yaratib bo'lmaydi.
 */
import type { PrismaClient, Prisma as PrismaNs } from "@/generated/prisma/client"
import { db, big } from "@/lib/prisma"
import { mutateUser, sanitizeUser, userTimezone, type UserDoc } from "@/lib/server/user-store"
import { todayKey, dateKeyFromTimestamp } from "@/lib/dates"
import { checkAndUnlockTasks } from "@/lib/task-unlock"
import { advanceChallenges } from "@/lib/server/challenge-engine"
import type { User } from "@/types/user"
import {
  DEFAULT_SETTINGS, durationFor, nextBreak, pausedElapsed, remainingMs, naturalEnd,
  type PomodoroMode, type PomodoroSettingsData, type PomodoroState, type RunStatus,
} from "@/lib/pomodoro"

type Run = PrismaNs.PomodoroRunGetPayload<object>
type Tx = PrismaNs.TransactionClient

export class PomodoroError extends Error {
  constructor(public status: number, message: string, public code: string, public extra?: Record<string, unknown>) { super(message) }
}

const ms = (d: Date | null | undefined) => (d ? d.getTime() : null)
const times = (r: Run) => ({ status: r.status as RunStatus, plannedSeconds: r.plannedSeconds, elapsedMs: r.elapsedMs, resumedAt: ms(r.resumedAt) })
// Eskirgan (24 soatdan ortiq pauzada turgan) taymer yangisini boshlashga xalaqit bermaydi
const STALE_PAUSE_MS = 24 * 3600 * 1000

export async function getSettings(userId: number, client: PrismaClient | Tx = db()): Promise<PomodoroSettingsData> {
  const s = await client.pomodoroSettings.findUnique({ where: { userId: big(userId) } })
  return s ? { focusMin: s.focusMin, shortBreakMin: s.shortBreakMin, longBreakMin: s.longBreakMin, longBreakEvery: s.longBreakEvery } : { ...DEFAULT_SETTINGS }
}

export async function saveSettings(userId: number, patch: Partial<PomodoroSettingsData>): Promise<PomodoroSettingsData> {
  const uid = big(userId)
  // Qator yo'q bo'lsa standart qiymatlar + o'zgarish bilan yaratiladi; bor bo'lsa faqat berilgan maydonlar yangilanadi.
  const row = await db().pomodoroSettings.upsert({
    where: { userId: uid },
    create: { userId: uid, ...DEFAULT_SETTINGS, ...patch },
    update: { ...patch, updatedAt: new Date() },
  })
  return { focusMin: row.focusMin, shortBreakMin: row.shortBreakMin, longBreakMin: row.longBreakMin, longBreakEvery: row.longBreakEvery }
}

async function activeRun(userId: number, client: PrismaClient | Tx = db()): Promise<Run | null> {
  return client.pomodoroRun.findFirst({ where: { userId: big(userId), status: { in: ["running", "paused"] } }, orderBy: { createdAt: "desc" } })
}

/** Joriy holat + statistika. `tz` — foydalanuvchining vaqt zonasi ("bugun" shu bo'yicha). */
export async function buildState(userId: number, tz: string, now: number): Promise<PomodoroState> {
  const uid = big(userId)
  const [settings, run, userRow, todayRow, totalFocus, recent] = await Promise.all([
    getSettings(userId),
    activeRun(userId),
    db().user.findUnique({ where: { id: uid }, select: { pomodoroTotal: true } }),
    db().pomodoroSession.aggregate({ _sum: { count: true }, where: { userId: uid, date: todayKey(tz, now) } }),
    db().pomodoroRun.aggregate({ _sum: { plannedSeconds: true }, where: { userId: uid, mode: "focus", status: "completed", credited: true } }),
    db().pomodoroRun.findMany({
      where: { userId: uid, mode: "focus", status: "completed", credited: true, endedAt: { gte: new Date(now - 48 * 3600 * 1000) } },
      select: { endedAt: true, plannedSeconds: true },
    }),
  ])
  const today = todayKey(tz, now)
  const todays = recent.filter((r) => r.endedAt && dateKeyFromTimestamp(r.endedAt.getTime(), tz) === today)
  const completedFocusToday = todays.length
  return {
    settings,
    active: run && (run.status === "running" || run.status === "paused")
      ? { id: run.id, mode: run.mode as PomodoroMode, status: run.status as "running" | "paused", plannedSeconds: run.plannedSeconds, remainingMs: remainingMs(times(run), now) }
      : null,
    suggestedBreak: nextBreak(completedFocusToday, settings.longBreakEvery),
    stats: {
      totalSessions: userRow?.pomodoroTotal ?? 0,
      todaySessions: todayRow._sum.count ?? 0,
      totalFocusSeconds: totalFocus._sum.plannedSeconds ?? 0,
      todayFocusSeconds: todays.reduce((a, r) => a + r.plannedSeconds, 0),
    },
    serverNow: now,
  }
}

/** Foydalanuvchi qatori mavjudligini tekshiradi (env-admin id 0 bazada yo'q). */
async function ensureUser(userId: number) {
  const u = await db().user.findUnique({ where: { id: big(userId) }, select: { id: true, timezone: true } })
  if (!u) throw new PomodoroError(404, "Foydalanuvchi topilmadi", "NOT_FOUND")
  return u
}

export interface ServiceResult { state: PomodoroState; user?: User; completed?: { id: string; mode: PomodoroMode; credited: boolean } }

/**
 * Faol taymer vaqti tugagan bo'lsa — uni BIR MARTA yakunlaydi (fokus bo'lsa statistikaga yozadi).
 * Qaytaradi: yakunlangan bo'lsa natija, aks holda null.
 */
async function finalizeIfDue(userId: number, run: Run, tz: string, now: number): Promise<{ run: Run; user?: User; credited: boolean } | null> {
  if (run.status !== "running" || remainingMs(times(run), now) > 0) return null
  const endMs = Math.min(now, naturalEnd(times(run)) ?? now)
  const endedAt = new Date(endMs)
  // Bu so'rov o'qigan holatga bog'langan shart: boshqa so'rov (pauza/yakunlash) o'zgartirgan bo'lsa 0 qator.
  const pin = { id: run.id, userId: run.userId, status: "running", resumedAt: run.resumedAt, elapsedMs: run.elapsedMs } as const

  if (run.mode !== "focus") {
    const r = await db().pomodoroRun.updateMany({ where: pin, data: { status: "completed", endedAt, resumedAt: null, elapsedMs: run.plannedSeconds * 1000 } })
    return r.count === 1 ? { run: { ...run, status: "completed" }, credited: false } : null
  }

  // Fokus: yakunlash + statistikaga yozish BITTA tranzaksiyada (mutateUser: rev bo'yicha optimistik nazorat + hook).
  const out = await mutateUser(
    userId,
    (doc: UserDoc) => {
      const utz = userTimezone(doc)
      const date = todayKey(utz, endMs)
      const sessions = [...(doc.pomodoroData?.sessions || [])]
      const i = sessions.findIndex((s) => s.date === date)
      if (i >= 0) sessions[i] = { ...sessions[i], count: sessions[i].count + 1 }
      else sessions.push({ id: endMs, date, count: 1 })
      let next: UserDoc = { ...doc, pomodoroData: { sessions, totalPomodoros: (doc.pomodoroData?.totalPomodoros || 0) + 1 } }
      next = { ...next, ...checkAndUnlockTasks(next) }
      next = { ...next, ...advanceChallenges(next, utz, endMs) }
      return { user: next, result: true }
    },
    12,
    async (tx) => {
      const r = await tx.pomodoroRun.updateMany({ where: pin, data: { status: "completed", endedAt, resumedAt: null, elapsedMs: run.plannedSeconds * 1000, credited: true } })
      return r.count === 1 // 0 bo'lsa — boshqa so'rov allaqachon yakunlagan: hech narsa yozilmaydi (rollback)
    },
  )
  if (!out.found || out.aborted || !out.changed) return null
  return { run: { ...run, status: "completed", credited: true }, user: sanitizeUser(out.user) ?? undefined, credited: true }
}

/** GET: holatni qaytaradi; vaqti tugagan faol taymer bo'lsa avval yakunlaydi (sahifa yopiq bo'lsa ham bir marta hisoblanadi). */
export async function getState(userId: number, now = Date.now()): Promise<ServiceResult> {
  const u = await ensureUser(userId)
  const tz = userTimezone(u)
  const run = await activeRun(userId)
  let fin: Awaited<ReturnType<typeof finalizeIfDue>> = null
  if (run) fin = await finalizeIfDue(userId, run, tz, now)
  const state = await buildState(userId, tz, now)
  return { state, ...(fin ? { user: fin.user, completed: { id: fin.run.id, mode: fin.run.mode as PomodoroMode, credited: fin.credited } } : {}) }
}

export async function startRun(userId: number, mode: PomodoroMode, now = Date.now()): Promise<ServiceResult> {
  const u = await ensureUser(userId)
  const tz = userTimezone(u)
  // Avval vaqti tugagan eski taymer bo'lsa yakunlab qo'yamiz (aks holda "faol taymer bor" deb xato chiqardi)
  const pre = await activeRun(userId)
  let fin: Awaited<ReturnType<typeof finalizeIfDue>> = null
  if (pre) fin = await finalizeIfDue(userId, pre, tz, now)

  await db().$transaction(async (tx) => {
    // Foydalanuvchi bo'yicha seriyalash: ikki parallel "start" bitta faol taymer yaratadi, ikkinchisi 409 oladi.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${big(userId)})`
    const existing = await activeRun(userId, tx)
    if (existing) {
      const stale = existing.status === "paused" && existing.pausedAt && now - existing.pausedAt.getTime() > STALE_PAUSE_MS
      if (!stale) throw new PomodoroError(409, "Faol taymer allaqachon mavjud", "ACTIVE_RUN")
      await tx.pomodoroRun.updateMany({ where: { id: existing.id, status: "paused" }, data: { status: "cancelled", endedAt: new Date(now) } })
    }
    const settings = await getSettings(userId, tx)
    const plannedSeconds = durationFor(mode, settings)
    await tx.pomodoroRun.create({ data: { userId: big(userId), mode, status: "running", plannedSeconds, startedAt: new Date(now), resumedAt: new Date(now), elapsedMs: 0 } })
  }, { timeout: 15_000, maxWait: 10_000 })

  const state = await buildState(userId, tz, now)
  return { state, ...(fin ? { user: fin.user, completed: { id: fin.run.id, mode: fin.run.mode as PomodoroMode, credited: fin.credited } } : {}) }
}

async function loadOwn(userId: number, id: string): Promise<Run> {
  // Faqat o'z yozuvi: userId sharti bilan — boshqa foydalanuvchining id'si "topilmadi" (404) beradi.
  const run = await db().pomodoroRun.findFirst({ where: { id, userId: big(userId) } })
  if (!run) throw new PomodoroError(404, "Taymer topilmadi", "NOT_FOUND")
  return run
}

export async function pauseRun(userId: number, id: string, now = Date.now()): Promise<ServiceResult> {
  const u = await ensureUser(userId); const tz = userTimezone(u)
  const run = await loadOwn(userId, id)
  if (run.status === "running") {
    // Vaqti allaqachon tugagan bo'lsa — pauza emas, yakunlash
    const fin = await finalizeIfDue(userId, run, tz, now)
    if (fin) return { state: await buildState(userId, tz, now), user: fin.user, completed: { id: run.id, mode: run.mode as PomodoroMode, credited: fin.credited } }
    await db().pomodoroRun.updateMany({
      where: { id: run.id, userId: run.userId, status: "running", resumedAt: run.resumedAt, elapsedMs: run.elapsedMs },
      data: { status: "paused", pausedAt: new Date(now), resumedAt: null, elapsedMs: pausedElapsed(times(run), now) },
    })
  } // allaqachon pauzada/tugagan bo'lsa — idempotent: joriy holat qaytariladi
  return { state: await buildState(userId, tz, now) }
}

export async function resumeRun(userId: number, id: string, now = Date.now()): Promise<ServiceResult> {
  const u = await ensureUser(userId); const tz = userTimezone(u)
  const run = await loadOwn(userId, id)
  if (run.status === "paused") {
    await db().pomodoroRun.updateMany({
      where: { id: run.id, userId: run.userId, status: "paused" },
      data: { status: "running", resumedAt: new Date(now), pausedAt: null },
    })
  }
  return { state: await buildState(userId, tz, now) }
}

/** Reset: faol taymerni BEKOR qiladi. Bekor qilingan seans hech qachon hisoblanmaydi. */
export async function resetRun(userId: number, id: string, now = Date.now()): Promise<ServiceResult> {
  const u = await ensureUser(userId); const tz = userTimezone(u)
  const run = await loadOwn(userId, id)
  if (run.status === "running") {
    // Reset bosilgan paytda vaqt allaqachon tugagan bo'lsa, u haqiqatan yakunlangan — avval yakunlaymiz
    const fin = await finalizeIfDue(userId, run, tz, now)
    if (fin) return { state: await buildState(userId, tz, now), user: fin.user, completed: { id: run.id, mode: run.mode as PomodoroMode, credited: fin.credited } }
  }
  await db().pomodoroRun.updateMany({
    where: { id: run.id, userId: run.userId, status: { in: ["running", "paused"] } },
    data: { status: "cancelled", endedAt: new Date(now), resumedAt: null, pausedAt: null },
  })
  return { state: await buildState(userId, tz, now) }
}

/** Mijoz taymer 0 ga yetganda chaqiradi. Server vaqtni o'zi tekshiradi: hali tugamagan bo'lsa 409 NOT_DUE. */
export async function completeRun(userId: number, id: string, now = Date.now()): Promise<ServiceResult> {
  const u = await ensureUser(userId); const tz = userTimezone(u)
  const run = await loadOwn(userId, id)
  if (run.status === "completed") return { state: await buildState(userId, tz, now) } // takroriy chaqiruv: ikkinchi marta hisoblanmaydi
  if (run.status === "cancelled") throw new PomodoroError(409, "Taymer bekor qilingan", "CANCELLED")
  const left = remainingMs(times(run), now)
  if (run.status === "paused" || left > 0) {
    throw new PomodoroError(409, "Taymer hali tugamagan", "NOT_DUE", { remainingMs: left, state: await buildState(userId, tz, now) })
  }
  const fin = await finalizeIfDue(userId, run, tz, now)
  const state = await buildState(userId, tz, now)
  return fin ? { state, user: fin.user, completed: { id: run.id, mode: run.mode as PomodoroMode, credited: fin.credited } } : { state }
}
