import { test } from "node:test"
import assert from "node:assert/strict"
import {
  remainingMs, pausedElapsed, naturalEnd, nextBreak, durationFor, SettingsPatch, DEFAULT_SETTINGS,
  FOCUS_PRESETS, type RunTimes,
} from "../lib/pomodoro"

const T0 = Date.UTC(2026, 10, 7, 10, 0, 0)
const run = (o: Partial<RunTimes> = {}): RunTimes => ({ status: "running", plannedSeconds: 25 * 60, elapsedMs: 0, resumedAt: T0, ...o })

test("qolgan vaqt vaqt belgisidan hisoblanadi (setInterval emas)", () => {
  assert.equal(remainingMs(run(), T0), 25 * 60_000)
  assert.equal(remainingMs(run(), T0 + 60_000), 24 * 60_000)
  assert.equal(remainingMs(run(), T0 + 3 * 3600_000), 0) // sahifa soatlab yopiq bo'lsa ham to'g'ri
})

test("pauzada vaqt to'xtaydi, davom ettirilganda qolgan joyidan ketadi", () => {
  const paused = run({ status: "paused", resumedAt: null, elapsedMs: pausedElapsed(run(), T0 + 10 * 60_000) })
  assert.equal(paused.elapsedMs, 10 * 60_000)
  assert.equal(remainingMs(paused, T0 + 99 * 60_000), 15 * 60_000) // uzoq pauza qolgan vaqtni o'zgartirmaydi
  const resumed = run({ elapsedMs: paused.elapsedMs, resumedAt: T0 + 20 * 60_000 })
  assert.equal(remainingMs(resumed, T0 + 25 * 60_000), 10 * 60_000)
  assert.equal(remainingMs(resumed, T0 + 35 * 60_000), 0)
})

test("bir necha pauza/davom ettirish: jami faqat ishlagan vaqt hisoblanadi", () => {
  let r = run()
  r = { ...r, status: "paused", resumedAt: null, elapsedMs: pausedElapsed(r, T0 + 5 * 60_000) }
  r = { ...r, status: "running", resumedAt: T0 + 30 * 60_000 }
  r = { ...r, status: "paused", resumedAt: null, elapsedMs: pausedElapsed(r, T0 + 38 * 60_000) }
  assert.equal(r.elapsedMs, 13 * 60_000)
  assert.equal(remainingMs({ ...r, status: "running", resumedAt: T0 + 50 * 60_000 }, T0 + 50 * 60_000), 12 * 60_000)
})

test("elapsed rejalashtirilgan davomiylikdan oshmaydi; naturalEnd to'g'ri", () => {
  assert.equal(pausedElapsed(run(), T0 + 999 * 60_000), 25 * 60_000)
  assert.equal(naturalEnd(run({ elapsedMs: 5 * 60_000 })), T0 + 20 * 60_000)
  assert.equal(naturalEnd(run({ status: "paused", resumedAt: null })), null)
})

test("keyingi tanaffus: har 4-fokusdan keyin uzoq", () => {
  assert.equal(nextBreak(0, 4), "short_break")
  assert.equal(nextBreak(1, 4), "short_break")
  assert.equal(nextBreak(4, 4), "long_break")
  assert.equal(nextBreak(5, 4), "short_break")
  assert.equal(nextBreak(8, 4), "long_break")
})

test("davomiylik rejimga mos sozlamadan olinadi", () => {
  const s = { focusMin: 45, shortBreakMin: 7, longBreakMin: 20, longBreakEvery: 3 }
  assert.equal(durationFor("focus", s), 45 * 60)
  assert.equal(durationFor("short_break", s), 7 * 60)
  assert.equal(durationFor("long_break", s), 20 * 60)
})

test("sozlamalar tekshiruvi: fokus < 15 rad etiladi, presetlar qabul qilinadi", () => {
  for (const bad of [0, 1, 14, -25, 14.9, 15.5, 181, NaN]) assert.equal(SettingsPatch.safeParse({ focusMin: bad }).success, false, `focusMin=${bad}`)
  assert.equal(SettingsPatch.safeParse({ focusMin: "25" }).success, false)
  for (const p of FOCUS_PRESETS) assert.equal(SettingsPatch.safeParse({ focusMin: p }).success, true, `preset ${p}`)
  assert.equal(SettingsPatch.safeParse({ focusMin: 15 }).success, true)
  assert.equal(SettingsPatch.safeParse({ focusMin: 37 }).success, true) // maxsus qiymat
  assert.equal(SettingsPatch.safeParse({}).success, false)
  assert.equal(SettingsPatch.safeParse({ shortBreakMin: 0 }).success, false)
  assert.equal(SettingsPatch.safeParse({ longBreakMin: 61 }).success, false)
  assert.equal(SettingsPatch.safeParse({ userId: 5, focusMin: 25 }).success, false) // begona maydonlar rad etiladi
  assert.deepEqual(DEFAULT_SETTINGS, { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4 })
})
