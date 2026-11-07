import { test } from "node:test"
import assert from "node:assert/strict"
import { zonedTimeToUtc } from "../lib/dates"
import { startChallenge, checkInChallenge, advanceChallenges, describe, ruleFor, findChallenge } from "../lib/server/challenge-engine"
import { applyHabitStatus } from "../lib/server/habit-engine"
import { CHALLENGES, type User, type Habit } from "../types/user"

const TZ = "Asia/Tashkent"
const at = (k: string, t = "12:00") => zonedTimeToUtc(k, t, TZ)
const base = (extra: Partial<User> = {}): User => ({
  id: 1, name: "u", email: "", password: "", createdAt: "", isActive: true, isAdmin: false, habits: [],
  stats: { totalHabits: 0, completedDays: 0, currentStreak: 0, longestStreak: 0 },
  pomodoroData: { sessions: [], totalPomodoros: 0 },
  xpData: { totalXP: 0, level: 1, rank: null, weeklyXP: 0, monthlyXP: 0, xpHistory: [], currentXP: 0, lastUpdated: 0 },
  publicProfile: false, unlockedAvatars: [], unlockedThemes: [], unlockedBadges: [], unlockedBorders: [], completedTasks: [],
  streakFreezes: 0, totalFreezesUsed: 0, ...extra,
})
const must = <T extends { ok: boolean }>(r: T) => { assert.ok(r.ok, JSON.stringify(r)); return r as Extract<T, { ok: true }> }

test("har bir mavjud chelenj turi uchun qoida aniqlangan va maqsad musbat", () => {
  const kinds = new Set<string>()
  for (const c of CHALLENGES) { const r = ruleFor(c); assert.ok(r.target > 0, `#${c.id}`); kinds.add(r.kind) }
  assert.deepEqual([...kinds].sort(), ["habit_and_pomodoro_days", "habit_days", "pomodoro_total", "self_report"])
})

test("self_report: kuniga bir marta, takroriy so'rov progressni oshirmaydi", () => {
  let u = must(startChallenge(base(), 1, TZ, at("2026-10-20"))).user // 7 kunlik
  const a = must(checkInChallenge(u, 1, TZ, at("2026-10-20", "08:00"))); u = a.user
  const b = must(checkInChallenge(u, 1, TZ, at("2026-10-20", "21:00"))); u = b.user
  assert.equal(b.unchanged, true)
  assert.equal(u.activeChallenges![0].completedDays.length, 1)
})

test("self_report: kalendar kuni chegarasi (23:59 va 00:01 ikki xil kun)", () => {
  let u = must(startChallenge(base(), 1, TZ, at("2026-10-20", "10:00"))).user
  u = must(checkInChallenge(u, 1, TZ, at("2026-10-20", "23:59"))).user
  u = must(checkInChallenge(u, 1, TZ, at("2026-10-21", "00:01"))).user
  assert.deepEqual(u.activeChallenges![0].completedDays, [0, 1])
})

test("7 kunlik chelenj: 7 ta turli kun -> yakunlanadi, mukofot BIR marta", () => {
  let u = must(startChallenge(base(), 1, TZ, at("2026-10-20"))).user
  for (let i = 0; i < 7; i++) {
    const day = `2026-10-${20 + i}`
    u = must(checkInChallenge(u, 1, TZ, at(day))).user
    u = advanceChallenges(u, TZ, at(day))
  }
  assert.deepEqual(u.completedChallenges, [1]); assert.equal(u.challengeRewards!.length, 1)
  for (let k = 0; k < 3; k++) u = advanceChallenges(u, TZ, at("2026-10-27", "10:00")) // qayta so'rovlar
  assert.equal(u.challengeRewards!.length, 1); assert.deepEqual(u.completedChallenges, [1])
  const again = checkInChallenge(u, 1, TZ, at("2026-10-27"))
  assert.ok(!again.ok) // yakunlangan chelenjga qayta belgi qo'yib bo'lmaydi
})

test("progress maqsaddan oshmaydi va muddatdan keyin belgilab bo'lmaydi (expired)", () => {
  let u = must(startChallenge(base(), 1, TZ, at("2026-10-20"))).user
  u = must(checkInChallenge(u, 1, TZ, at("2026-10-20"))).user
  const v = describe(u, u.activeChallenges![0], TZ, at("2026-11-05"))!
  assert.equal(v.status, "expired")
  assert.ok(!checkInChallenge(u, 1, TZ, at("2026-11-05")).ok)
  assert.ok(v.progress <= v.target)
})

test("o'tkazib yuborilgan kundan keyin maqsadga erishib bo'lmasa, erta 'expired'", () => {
  let u = must(startChallenge(base(), 1, TZ, at("2026-10-20"))).user // 7 kun: 20..26
  u = must(checkInChallenge(u, 1, TZ, at("2026-10-20"))).user
  // 22-oktabr: 1 ta bajarilgan, 21 o'tkazib yuborilgan; qolgan kunlar (22..26 = 5) < kerak (6)
  assert.equal(describe(u, u.activeChallenges![0], TZ, at("2026-10-22"))!.status, "expired")
  // 21-oktabrda hali mumkin (21..26 = 6 kun, kerak 6)
  assert.equal(describe(u, u.activeChallenges![0], TZ, at("2026-10-21"))!.status, "active")
})

test("qayta boshlash: faol chelenjni ikkinchi marta boshlab bo'lmaydi; expiredni qayta boshlash mumkin", () => {
  let u = must(startChallenge(base(), 1, TZ, at("2026-10-20"))).user
  u = must(checkInChallenge(u, 1, TZ, at("2026-10-20"))).user // 1-kun bajarildi: chelenj hali mumkin
  assert.ok(!startChallenge(u, 1, TZ, at("2026-10-21")).ok)
  // 1-kun o'tkazib yuborilsa, ertasiga maqsadga erishib bo'lmaydi -> expired, qayta boshlash mumkin
  const missed = must(startChallenge(base(), 1, TZ, at("2026-10-20"))).user
  assert.equal(describe(missed, missed.activeChallenges![0], TZ, at("2026-10-21"))!.status, "expired")
  assert.ok(startChallenge(missed, 1, TZ, at("2026-10-21")).ok)
  const again = must(startChallenge(u, 1, TZ, at("2026-12-01")))
  assert.equal(again.user.activeChallenges!.length, 1); assert.equal(again.user.activeChallenges![0].attempt, 2)
})

test("pomodoro_total (#7): maqsad serverda yozilgan pomodorolardan; oynadan tashqari sanalar hisobga olinmaydi", () => {
  let u = must(startChallenge(base(), 7, TZ, at("2026-10-20"))).user
  u = { ...u, pomodoroData: { totalPomodoros: 60, sessions: [{ id: 1, date: "2026-10-19", count: 40 }, { id: 2, date: "2026-10-21", count: 49 }] } }
  assert.equal(advanceChallenges(u, TZ, at("2026-10-22")).completedChallenges?.includes(7) ?? false, false) // 49 < 50
  u = { ...u, pomodoroData: { totalPomodoros: 61, sessions: [{ id: 2, date: "2026-10-21", count: 50 }] } }
  const done = advanceChallenges(u, TZ, at("2026-10-22"))
  assert.deepEqual(done.completedChallenges, [7])
  assert.deepEqual(advanceChallenges(done, TZ, at("2026-10-23")).challengeRewards, done.challengeRewards)
  assert.ok(!checkInChallenge(u, 7, TZ, at("2026-10-22")).ok) // qo'lda belgilab bo'lmaydi
})

test("habit_days (#16): faqat tugagan kunlar saqlanadi; bugungi bajarilgan kun ertasigacha mukofot bermaydi", () => {
  const h: Habit = { id: 5, name: "h", duration: 200, days: {}, dayLocks: {}, missReasons: {}, time: null, notifications: false, why: "", startDate: { day: 1, month: 1, year: 2026, timestamp: at("2026-10-20", "09:00") } }
  let u = must(startChallenge(base({ habits: [h] }), 16, TZ, at("2026-10-20"))).user
  const r = applyHabitStatus(u, 5, 0, "completed", TZ, at("2026-10-20")); assert.ok(r.ok); if (!r.ok) return
  u = advanceChallenges(r.user, TZ, at("2026-10-20", "20:00"))
  assert.deepEqual(u.activeChallenges![0].completedDays, []) // bugun hali saqlanmaydi
  assert.equal(describe(u, u.activeChallenges![0], TZ, at("2026-10-20", "20:00"))!.progress, 1) // lekin jonli ko'rsatiladi
  u = advanceChallenges(u, TZ, at("2026-10-21", "08:00"))
  assert.deepEqual(u.activeChallenges![0].completedDays, [0])
})

test("habit_days: odat o'chirilsa, avval hisoblangan kunlar yo'qolmaydi", () => {
  const h: Habit = { id: 5, name: "h", duration: 200, days: { 0: "completed" }, dayLocks: {}, missReasons: {}, time: null, notifications: false, why: "", startDate: { day: 1, month: 1, year: 2026, timestamp: at("2026-10-20", "09:00") } }
  let u = must(startChallenge(base({ habits: [h] }), 16, TZ, at("2026-10-20"))).user
  u = advanceChallenges(u, TZ, at("2026-10-21"))
  u = advanceChallenges({ ...u, habits: [] }, TZ, at("2026-10-22"))
  assert.deepEqual(u.activeChallenges![0].completedDays, [0])
})

test("habit_and_pomodoro_days (#17): odat VA pomodoro ikkalasi ham bo'lgan kun hisoblanadi", () => {
  const h: Habit = { id: 5, name: "h", duration: 200, days: { 0: "completed", 1: "completed" }, dayLocks: {}, missReasons: {}, time: null, notifications: false, why: "", startDate: { day: 1, month: 1, year: 2026, timestamp: at("2026-10-20", "09:00") } }
  let u = must(startChallenge(base({ habits: [h], pomodoroData: { totalPomodoros: 1, sessions: [{ id: 1, date: "2026-10-20", count: 1 }] } }), 17, TZ, at("2026-10-20"))).user
  u = advanceChallenges(u, TZ, at("2026-10-22"))
  assert.deepEqual(u.activeChallenges![0].completedDays, [0]) // 21-kunda pomodoro yo'q
})

test("eski (v1) yozuv: takroriy kunlar olib tashlanadi, muddatsiz/erta expired bo'lib qolmaydi", () => {
  const legacy = { challengeId: 1, startedAt: at("2026-10-01"), completedDays: [0, 0, 1, 1, 2, 99], isCompleted: false }
  const u = base({ activeChallenges: [legacy] })
  const v = describe(u, legacy, TZ, at("2026-10-22"))!
  assert.equal(v.progress, 3) // takrorlar va oynadan tashqari indeks sanalmaydi
  assert.equal(v.status, "active") // qolgan 4 kunni bajarishga muhlat beriladi
  assert.equal(findChallenge(1)!.durationDays, 7)
})

test("bir xil challenge ikki parallel 'advance' ikkita mukofot bermaydi", () => {
  let u = must(startChallenge(base({ pomodoroData: { totalPomodoros: 60, sessions: [{ id: 1, date: "2026-10-21", count: 60 }] } }), 7, TZ, at("2026-10-20"))).user
  const a = advanceChallenges(u, TZ, at("2026-10-22")), b = advanceChallenges(u, TZ, at("2026-10-22"))
  assert.equal(a.challengeRewards!.length, 1); assert.equal(b.challengeRewards!.length, 1)
  u = advanceChallenges(a, TZ, at("2026-10-22")); assert.equal(u.challengeRewards!.length, 1)
})
