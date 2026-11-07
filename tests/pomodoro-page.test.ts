import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PomodoroPage, formatClock, formatFocusTime } from "../components/pomodoro-page"
import { DEFAULT_SETTINGS } from "../lib/pomodoro"
import type { PomodoroController } from "../hooks/use-pomodoro"

const stats = { totalSessions: 12, todaySessions: 3, totalFocusSeconds: 7500, todayFocusSeconds: 4500 }
const ctl = (o: Partial<PomodoroController> = {}): PomodoroController => ({
  state: { settings: DEFAULT_SETTINGS, active: null, suggestedBreak: "short_break", stats, serverNow: 0 },
  settings: DEFAULT_SETTINGS, active: null, loading: false, busy: false, running: false, mode: "focus",
  selectMode: () => {}, remainingMs: 25 * 60_000, totalMs: 25 * 60_000,
  start: () => {}, pause: () => {}, resume: () => {}, reset: () => {}, saveSettings: async (p) => ({ ...DEFAULT_SETTINGS, ...p }),
  ...o,
} as PomodoroController)
const render = (c: PomodoroController) => renderToStaticMarkup(h(PomodoroPage, { pomodoro: c, pomodoroData: { sessions: [], totalPomodoros: 12 } }))

test("formatlash: soat/daqiqa", () => {
  assert.equal(formatClock(25 * 60_000), "25:00")
  assert.equal(formatClock(1), "00:01") // yuqoriga yaxlitlanadi: 0 faqat haqiqatan tugaganda
  assert.equal(formatClock(0), "00:00")
  assert.equal(formatClock(90 * 60_000), "1:30:00")
  assert.equal(formatFocusTime(37 * 60), "37 daq")
  assert.equal(formatFocusTime(125 * 60), "2 soat 5 daq")
  assert.equal(formatFocusTime(120 * 60), "2 soat")
})

test("tayyor holat: Boshlash tugmasi, statistika, barcha presetlar va 'o'z qiymati' maydoni", () => {
  const html = render(ctl())
  assert.match(html, /Boshlash/)
  assert.match(html, /25:00/)
  for (const n of [15, 20, 25, 30, 45, 60]) assert.match(html, new RegExp(`${n} daq`))
  assert.match(html, /Fokus davomiyligi/); assert.match(html, /Qisqa tanaffus/); assert.match(html, /Uzoq tanaffus/)
  assert.match(html, /min="15"/) // fokus uchun minimal 15
  assert.match(html, />12</); assert.match(html, />3</); assert.match(html, /2 soat 5 daq/); assert.match(html, /1 soat 15 daq/)
  assert.doesNotMatch(html, /Pauza</)
})

test("ishlayotgan holat: Pauza + Reset; pauzada: Davom ettirish", () => {
  const active = { id: "r1", mode: "focus" as const, status: "running" as const, plannedSeconds: 1500, remainingMs: 600_000 }
  const run = render(ctl({ active, running: true, remainingMs: 600_000 }))
  assert.match(run, /Pauza/); assert.match(run, /10:00/); assert.match(run, /Fokus davom etmoqda/); assert.match(run, /bekor qilinadi/)
  const paused = render(ctl({ active: { ...active, status: "paused" }, running: false, remainingMs: 600_000 }))
  assert.match(paused, /Davom ettirish/); assert.match(paused, /Pauza/)
})

test("tanaffus rejimi va yuklanish holati", () => {
  assert.match(render(ctl({ mode: "long_break", remainingMs: 15 * 60_000 })), /15:00/)
  const loading = render(ctl({ loading: true, state: null }))
  assert.match(loading, /--:--/); assert.match(loading, /Yuklanmoqda/)
})

test("maxsus qiymat (preset emas) ko'rsatiladi", () => {
  const html = render(ctl({ settings: { ...DEFAULT_SETTINGS, focusMin: 37 } }))
  assert.match(html, /37 daq/)
})
