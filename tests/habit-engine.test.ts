import { test } from "node:test"
import assert from "node:assert/strict"
import { zonedTimeToUtc } from "../lib/dates"
import { applyHabitStatus, settleOldDays } from "../lib/server/habit-engine"
import type { User, Habit } from "../types/user"

const TZ = "Asia/Tashkent"
const at = (k: string, t = "12:00") => zonedTimeToUtc(k, t, TZ)
const habit = (start: string, duration = 30, days: any = {}, dayLocks: any = {}): Habit => ({
  id: 1, name: "h", duration, days, dayLocks, missReasons: {}, time: null, notifications: false, why: "",
  startDate: { day: 1, month: 1, year: 2026, timestamp: at(start, "09:00") },
})
const user = (habits: Habit[], extra: Partial<User> = {}): User => ({
  id: 7, name: "u", email: "", password: "", createdAt: "", isActive: true, isAdmin: false, habits,
  stats: { totalHabits: 0, completedDays: 0, currentStreak: 0, longestStreak: 0 },
  pomodoroData: { sessions: [], totalPomodoros: 0 },
  xpData: { totalXP: 100, level: 2, rank: null, weeklyXP: 0, monthlyXP: 0, xpHistory: [], currentXP: 100, lastUpdated: 0 },
  publicProfile: false, unlockedAvatars: [], unlockedThemes: [], unlockedBadges: [], unlockedBorders: [], completedTasks: [],
  streakFreezes: 0, totalFreezesUsed: 0, ...extra,
})

test("bugungi kunni bajarish +10 XP beradi va tarixga bitta yozuv qo'shadi", () => {
  const r = applyHabitStatus(user([habit("2026-10-22")]), 1, 0, "completed", TZ, at("2026-10-22"))
  assert.ok(r.ok); if (!r.ok) return
  assert.equal(r.xpChange, 10); assert.equal(r.user.xpData.totalXP, 110)
  assert.equal(r.user.xpData.xpHistory.length, 1)
})

test("IDEMPOTENT: bir xil so'rov ikki marta yuborilsa XP ikki marta berilmaydi", () => {
  const u0 = user([habit("2026-10-22")])
  const a = applyHabitStatus(u0, 1, 0, "completed", TZ, at("2026-10-22")); assert.ok(a.ok); if (!a.ok) return
  const b = applyHabitStatus(a.user, 1, 0, "completed", TZ, at("2026-10-22", "12:05")); assert.ok(b.ok); if (!b.ok) return
  assert.equal(b.unchanged, true); assert.equal(b.xpChange, 0)
  assert.equal(b.user.xpData.totalXP, 110); assert.equal(b.user.xpData.xpHistory.length, 1)
})

test("o'zgartirish (completed -> partial -> none) XPni to'g'ri qaytaradi va tarix yo'qolmaydi", () => {
  let u = user([habit("2026-10-22")])
  const step = (s: any) => { const r = applyHabitStatus(u, 1, 0, s, TZ, at("2026-10-22")); assert.ok(r.ok); if (r.ok) u = r.user; return r.ok ? r.xpChange : NaN }
  assert.equal(step("completed"), 10)
  assert.equal(step("partial"), -5)
  assert.equal(u.xpData.totalXP, 105)
  assert.equal(u.xpData.xpHistory[0].xpEarned, 5) // kun uchun JAMI XP, delta emas
  assert.equal(step("none"), -5)
  assert.equal(u.xpData.totalXP, 100); assert.equal(u.xpData.xpHistory.length, 0)
})

test("kelajak va o'tgan (qulflangan) kunlarni belgilab bo'lmaydi; noto'g'ri indeks rad etiladi", () => {
  const u = user([habit("2026-10-20")])
  const fut = applyHabitStatus(u, 1, 3, "completed", TZ, at("2026-10-22"))
  assert.ok(!fut.ok && fut.code === "FUTURE_DAY")
  const past = applyHabitStatus(u, 1, 0, "completed", TZ, at("2026-10-22"))
  assert.ok(!past.ok && past.code === "DAY_LOCKED")
  assert.ok(!applyHabitStatus(u, 1, -1, "completed", TZ, at("2026-10-22")).ok)
  assert.ok(!applyHabitStatus(u, 1, 99, "completed", TZ, at("2026-10-22")).ok)
  assert.ok(!applyHabitStatus(u, 2, 0, "completed", TZ, at("2026-10-22")).ok)
  assert.ok(!applyHabitStatus(u, 1, 2, "bogus" as any, TZ, at("2026-10-22")).ok)
})

test("kun chegarasi: Toshkent 00:10 yangi kun, 23:50 esa hali eski kun", () => {
  const u = user([habit("2026-10-21")])
  assert.ok(applyHabitStatus(u, 1, 0, "completed", TZ, at("2026-10-21", "23:50")).ok)
  const r = applyHabitStatus(u, 1, 0, "completed", TZ, at("2026-10-22", "00:10"))
  assert.ok(!r.ok && r.code === "DAY_LOCKED")
})

test("settleOldDays: yozuvsiz o'tgan kunlar -15 XP, bir marta; qayta chaqirish o'zgartirmaydi", () => {
  const u0 = user([habit("2026-10-19", 30, { 0: "completed" }, { 0: { status: "completed", markedAt: 1, dateString: "2026-10-19", xpAwarded: 10, locked: false } })], { xpData: { totalXP: 110, level: 2, rank: null, weeklyXP: 0, monthlyXP: 0, xpHistory: [], currentXP: 110, lastUpdated: 0 } })
  const a = settleOldDays(u0, TZ, at("2026-10-22"))
  assert.equal(a.changed, true)
  assert.equal(a.user.habits[0].days[1], "missed"); assert.equal(a.user.habits[0].days[2], "missed")
  assert.equal(a.user.habits[0].days[3], undefined) // bugun tegilmaydi
  assert.equal(a.user.xpData.totalXP, 80)
  assert.equal(a.user.habits[0].dayLocks[0].locked, true)
  const b = settleOldDays(a.user, TZ, at("2026-10-22", "18:00"))
  assert.equal(b.changed, false); assert.equal(b.user.xpData.totalXP, 80)
})

test("settleOldDays: streak freeze mavjud bo'lsa jazo o'rniga ishlatiladi; XP 0 dan past tushmaydi", () => {
  const a = settleOldDays(user([habit("2026-10-20")], { streakFreezes: 1 }), TZ, at("2026-10-22"))
  assert.equal(a.user.habits[0].days[0], "frozen"); assert.equal(a.user.habits[0].days[1], "missed")
  assert.equal(a.user.streakFreezes, 0); assert.equal(a.user.totalFreezesUsed, 1)
  assert.equal(a.user.xpData.totalXP, 85)
  const low = user([habit("2026-10-01")], { xpData: { totalXP: 5, level: 1, rank: null, weeklyXP: 0, monthlyXP: 0, xpHistory: [], currentXP: 5, lastUpdated: 0 } })
  assert.equal(settleOldDays(low, TZ, at("2026-10-22")).user.xpData.totalXP, 0)
})

test("kelajakda boshlanadigan odatga settleOldDays tegmaydi", () => {
  assert.equal(settleOldDays(user([habit("2026-10-30")]), TZ, at("2026-10-22")).changed, false)
})

test("haftalik XP kalendar haftasi bo'yicha dayLock'lardan hisoblanadi", () => {
  const h = habit("2026-10-12", 30)
  let u = user([h])
  u = settleOldDays(u, TZ, at("2026-10-22")).user // 12..21 oktabr: 10 kun missed
  const r = applyHabitStatus(u, 1, 10, "completed", TZ, at("2026-10-22")); assert.ok(r.ok); if (!r.ok) return
  // joriy hafta (19-25): 19,20,21 = -45, 22 = +10 => net manfiy => 0
  assert.equal(r.user.xpData.weeklyXP, 0)
})
