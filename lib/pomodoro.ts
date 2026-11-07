/**
 * Pomodoro: mijoz va server uchun umumiy konstantalar va sof (DB'siz) hisob-kitoblar.
 * Taymer holati serverda TIMESTAMP bilan saqlanadi; qolgan vaqt har doim shu yerdagi `remainingMs` orqali hisoblanadi.
 */
import { z } from "zod"

export type PomodoroMode = "focus" | "short_break" | "long_break"
export type RunStatus = "running" | "paused" | "completed" | "cancelled"

export const MODES: PomodoroMode[] = ["focus", "short_break", "long_break"]

// Fokus: kamida 15 daqiqa (talab). Yuqori chegara — tasodifiy katta qiymatlardan himoya.
export const FOCUS_MIN = 15
export const FOCUS_MAX = 180
export const SHORT_BREAK_MIN = 1
export const SHORT_BREAK_MAX = 30
export const LONG_BREAK_MIN = 5
export const LONG_BREAK_MAX = 60
export const LONG_EVERY_MIN = 2
export const LONG_EVERY_MAX = 10

export const FOCUS_PRESETS = [15, 20, 25, 30, 45, 60] as const
export const SHORT_BREAK_PRESETS = [3, 5, 10, 15] as const
export const LONG_BREAK_PRESETS = [15, 20, 25, 30] as const

export interface PomodoroSettingsData {
  focusMin: number
  shortBreakMin: number
  longBreakMin: number
  longBreakEvery: number
}

export const DEFAULT_SETTINGS: PomodoroSettingsData = { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, longBreakEvery: 4 }

const intIn = (min: number, max: number, label: string) =>
  z.number({ invalid_type_error: `${label}: son kiriting`, required_error: `${label} kerak` })
    .int(`${label}: butun son bo'lishi kerak`)
    .min(min, `${label}: kamida ${min} daqiqa`)
    .max(max, `${label}: ko'pi bilan ${max} daqiqa`)

/** Qisman yangilash: faqat berilgan maydonlar tekshiriladi va yoziladi. */
export const SettingsPatch = z.object({
  focusMin: intIn(FOCUS_MIN, FOCUS_MAX, "Fokus davomiyligi").optional(),
  shortBreakMin: intIn(SHORT_BREAK_MIN, SHORT_BREAK_MAX, "Qisqa tanaffus").optional(),
  longBreakMin: intIn(LONG_BREAK_MIN, LONG_BREAK_MAX, "Uzoq tanaffus").optional(),
  longBreakEvery: intIn(LONG_EVERY_MIN, LONG_EVERY_MAX, "Uzoq tanaffus oralig'i").optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "Hech narsa o'zgartirilmadi")

export function durationFor(mode: PomodoroMode, s: PomodoroSettingsData): number {
  return (mode === "focus" ? s.focusMin : mode === "short_break" ? s.shortBreakMin : s.longBreakMin) * 60
}

export interface RunTimes {
  status: RunStatus
  plannedSeconds: number
  elapsedMs: number
  resumedAt: number | null // ms
}

/** Qolgan vaqt (ms). Faqat `running` holatda hozirgi bo'lak qo'shiladi; pauzada vaqt to'xtaydi. */
export function remainingMs(r: RunTimes, now: number): number {
  const total = r.plannedSeconds * 1000
  const live = r.status === "running" && r.resumedAt != null ? Math.max(0, now - r.resumedAt) : 0
  return Math.max(0, total - Math.min(total, r.elapsedMs + live))
}

/** Ishlayotgan taymer tabiiy tugaydigan vaqt (ms) — sessiya qaysi kalendar kuniga yozilishini aniqlaydi. */
export function naturalEnd(r: RunTimes): number | null {
  if (r.status !== "running" || r.resumedAt == null) return null
  return r.resumedAt + (r.plannedSeconds * 1000 - r.elapsedMs)
}

/** Pauza: shu vaqtgacha o'tgan qismni `elapsedMs` ga qo'shadi (jami davomiylikdan oshmaydi). */
export function pausedElapsed(r: RunTimes, now: number): number {
  const total = r.plannedSeconds * 1000
  const live = r.resumedAt != null ? Math.max(0, now - r.resumedAt) : 0
  return Math.min(total, r.elapsedMs + live)
}

/** Keyingi tanaffus turi: bugun yakunlangan fokuslar soni `longBreakEvery` ga karrali bo'lsa — uzoq. */
export function nextBreak(completedFocusToday: number, longBreakEvery: number): "short_break" | "long_break" {
  return completedFocusToday > 0 && completedFocusToday % longBreakEvery === 0 ? "long_break" : "short_break"
}

// ── Server ↔ mijoz javob shakli ──
export interface ActiveRunView {
  id: string
  mode: PomodoroMode
  status: "running" | "paused"
  plannedSeconds: number
  remainingMs: number // javob yuborilgan paytdagi qolgan vaqt
}

export interface PomodoroStats {
  totalSessions: number // jami yakunlangan fokus seanslari (eski yozuvlar bilan)
  todaySessions: number
  totalFocusSeconds: number // yangi tizimda yakunlangan fokuslarning jami vaqti
  todayFocusSeconds: number
}

export interface PomodoroState {
  settings: PomodoroSettingsData
  active: ActiveRunView | null
  suggestedBreak: "short_break" | "long_break"
  stats: PomodoroStats
  serverNow: number
}
