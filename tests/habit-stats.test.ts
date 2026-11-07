import { test } from "node:test"
import assert from "node:assert/strict"
import { zonedTimeToUtc, addDays, weekStart, diffDays } from "../lib/dates"
import { computeOverview, dailySeries, habitStreak, userStreak, habitProgress, weeklySeries, type HabitLike } from "../lib/stats/habit-stats"

const TZ = "Asia/Tashkent"
const at = (key: string, hhmm = "12:00", tz = TZ) => zonedTimeToUtc(key, hhmm, tz)
const mk = (id: number, start: string, duration: number, days: Record<number, string>, tz = TZ): HabitLike => ({
  id, duration, startDate: { timestamp: at(start, "09:00", tz) }, days,
})

test("dates: kalendar arifmetikasi va hafta dushanbadan boshlanadi", () => {
  assert.equal(addDays("2026-02-27", 2), "2026-03-01")
  assert.equal(addDays("2028-02-28", 1), "2028-02-29")
  assert.equal(diffDays("2026-10-20", "2026-11-03"), 14)
  assert.equal(weekStart("2026-10-22"), "2026-10-19") // payshanba -> dushanba
  assert.equal(weekStart("2026-10-25"), "2026-10-19") // yakshanba
})

test("dates: DST chegarasida kun siljimaydi (New York 2026-11-01)", () => {
  assert.equal(diffDays("2026-10-31", "2026-11-02"), 2)
  const h = mk(1, "2026-10-30", 5, { 0: "completed", 1: "completed", 2: "completed" }, "America/New_York")
  const p = habitProgress(h, "America/New_York", at("2026-11-02", "10:00", "America/New_York"))
  assert.equal(p.completed, 3)
  assert.equal(p.daysElapsed, 4)
})

test("bugungi belgilanmagan kun 'o'tkazib yuborilgan' hisoblanmaydi", () => {
  const h = mk(1, "2026-10-20", 30, { 0: "completed", 1: "completed" })
  const o = computeOverview([h], TZ, at("2026-10-22"))
  assert.equal(o.today.pending, 1)
  assert.equal(o.today.missed, 0)
  assert.equal(o.today.rate, null) // ma'lumot yo'q, 0% emas
  assert.equal(o.overall.due, 2)
  assert.equal(o.overall.rate, 100)
})

test("kun tugagan, yozuv yo'q -> inferred missed; kelajak kunlar hisoblanmaydi", () => {
  const h = mk(1, "2026-10-19", 30, { 0: "completed" })
  const o = computeOverview([h], TZ, at("2026-10-22")) // kunlar 0..3; 1,2 yozuvsiz o'tgan, 3 = bugun
  assert.equal(o.overall.completed, 1)
  assert.equal(o.overall.missed, 2)
  assert.equal(o.overall.pending, 1)
  assert.equal(o.overall.rate, 33.3)
})

test("boshlanmagan odat jazolanmaydi va 'upcoming' deb sanaladi", () => {
  const h = mk(1, "2026-10-25", 7, {})
  const o = computeOverview([h], TZ, at("2026-10-22"))
  assert.equal(o.upcomingHabits, 1)
  assert.equal(o.activeHabits, 0)
  assert.equal(o.overall.due, 0)
  assert.equal(o.overall.rate, null)
})

test("odat o'rtahafta/o'rtaoyda boshlansa, faqat o'sha kundan hisoblanadi", () => {
  const h = mk(1, "2026-10-21", 30, { 0: "completed", 1: "completed" }) // chorshanba
  const o = computeOverview([h], TZ, at("2026-10-22"))
  assert.equal(o.week.due, 2)
  assert.equal(o.week.rate, 100)
  const m = mk(2, "2026-10-31", 5, { 0: "completed", 1: "missed" })
  const o2 = computeOverview([m], TZ, at("2026-11-01"))
  assert.equal(o2.month.due, 1) // noyabr: faqat 1-sana (dayIndex 1, "missed")
  assert.equal(o2.month.missed, 1)
  assert.equal(o2.overall.due, 2)
})

test("odat muddati tugagach, keyingi kunlar maxrajga kirmaydi", () => {
  const h = mk(1, "2026-10-01", 3, { 0: "completed", 1: "completed", 2: "partial" })
  const o = computeOverview([h], TZ, at("2026-10-22"))
  assert.equal(o.finishedHabits, 1)
  assert.equal(o.overall.due, 3)
  assert.equal(o.overall.partial, 1)
  assert.equal(o.overall.rate, 66.7)
})

test("frozen: maxrajga kirmaydi va streakni uzmaydi", () => {
  const h = mk(1, "2026-10-17", 30, { 0: "completed", 1: "frozen", 2: "completed", 3: "completed" })
  const s = habitStreak(h, "2026-10-20", TZ)
  assert.equal(s.current, 3)
  assert.equal(s.longest, 3)
  const o = computeOverview([h], TZ, at("2026-10-20"))
  assert.equal(o.overall.frozen, 1)
  assert.equal(o.overall.due, 3)
})

test("streak: partial va missed uzadi; bugun belgilanmagan bo'lsa kechadan sanaladi", () => {
  const h = mk(1, "2026-10-14", 30, { 0: "completed", 1: "completed", 2: "partial", 3: "completed", 4: "completed", 5: "completed" })
  assert.deepEqual(habitStreak(h, "2026-10-20", TZ), { current: 3, longest: 3 }) // 5,4,3; 2=partial uzadi; bugun(6) pending
  const h2 = mk(2, "2026-10-14", 30, { 0: "completed", 1: "completed", 2: "completed", 3: "missed", 4: "completed", 5: "completed" })
  assert.deepEqual(habitStreak(h2, "2026-10-20", TZ), { current: 2, longest: 3 })
})

test("streak: o'tgan yozuvsiz kun streakni uzadi", () => {
  const h = mk(1, "2026-10-14", 30, { 0: "completed", 1: "completed", 3: "completed" }) // 2-kun yozuvsiz
  assert.deepEqual(habitStreak(h, "2026-10-18", TZ), { current: 1, longest: 2 }) // kunlar 0..4; 4 = bugun pending
})

test("foydalanuvchi streaki: har qanday odat bajarilgan kunlar ketma-ketligi", () => {
  const a = mk(1, "2026-10-17", 30, { 0: "completed", 1: "missed", 2: "completed", 3: "completed" })
  const b = mk(2, "2026-10-17", 30, { 0: "missed", 1: "completed", 2: "missed", 3: "missed" })
  // 17: a ok; 18: b ok; 19: a ok; 20: a ok  => 4 kun (har kuni kamida bittasi bajarilgan)
  assert.deepEqual(userStreak([a, b], "2026-10-20", TZ), { current: 4, longest: 4 })
  const c = mk(3, "2026-10-17", 30, { 0: "completed", 1: "missed", 2: "missed" })
  assert.deepEqual(userStreak([c], "2026-10-20", TZ), { current: 0, longest: 1 })
})

test("dailySeries: ma'lumot yo'q kunlar null, nol emas; kelajak hasData=false", () => {
  const h = mk(1, "2026-10-20", 30, { 0: "completed" })
  const s = dailySeries([h], "2026-10-18", "2026-10-23", TZ, at("2026-10-21"))
  assert.equal(s[0].rate, null); assert.equal(s[0].hasData, false) // boshlanishdan oldin
  assert.equal(s[2].rate, 100)
  assert.equal(s[3].hasData, true); assert.equal(s[3].pending, 1) // bugun
  assert.equal(s[4].hasData, false) // kelajak
})

test("vaqt zonasi chegarasi: 23:30 Toshkent vaqti - UTC bo'yicha ertasi emas", () => {
  const h: HabitLike = { id: 1, duration: 10, startDate: { timestamp: at("2026-10-22", "23:30") }, days: {} }
  const p = habitProgress(h, TZ, at("2026-10-22", "23:59"))
  assert.equal(p.daysElapsed, 1)
  assert.equal(p.status, "active")
  const p2 = habitProgress(h, "America/Los_Angeles", at("2026-10-22", "23:59"))
  assert.ok(["active", "upcoming"].includes(p2.status))
})

test("weeklySeries: haftalar dushanbadan, oxirgisi joriy hafta", () => {
  const h = mk(1, "2026-10-12", 60, { 0: "completed", 1: "completed", 7: "completed", 8: "missed" })
  const w = weeklySeries([h], 3, TZ, at("2026-10-22"))
  assert.equal(w.length, 3)
  assert.equal(w[2].label, "2026-10-19")
  assert.equal(w[1].completed, 2)
})

test("bir xil yozuv ikki marta sanalmaydi (takroriy days kaliti string/number)", () => {
  const h: HabitLike = { id: 1, duration: 10, startDate: { timestamp: at("2026-10-20") }, days: Object.assign({}, { 0: "completed" }, JSON.parse('{"0":"completed"}')) }
  assert.equal(computeOverview([h], TZ, at("2026-10-21")).overall.completed, 1)
})
