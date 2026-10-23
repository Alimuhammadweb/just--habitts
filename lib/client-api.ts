"use client"
import { authFetch } from "@/lib/api-client"
import type { User } from "@/types/user"
import type { ChallengeView } from "@/lib/server/challenge-engine"

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message) }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await authFetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" })
  } catch {
    throw new ApiError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.", 0, "NETWORK")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data?.error || `Xato (${res.status})`, res.status, data?.code)
  return data as T
}

export const deviceTimezone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return undefined } }

// ── Odatlar ──
export const syncHabits = () => call<{ user: User }>("/api/habits/sync", { method: "POST", body: JSON.stringify({ timezone: deviceTimezone() }) })
export const setHabitStatus = (habitId: number, dayIndex: number, status: "completed" | "partial" | "missed" | "none", missReason?: string) =>
  call<{ user: User; xpChange: number; unchanged: boolean; newTasks: number[] }>("/api/habits/status", { method: "POST", body: JSON.stringify({ habitId, dayIndex, status, missReason }) })
export const createHabit = (habit: unknown) => call<{ user: User }>("/api/habits", { method: "POST", body: JSON.stringify({ habit }) })
export const removeHabit = (habitId: number) => call<{ success: boolean }>("/api/habits", { method: "DELETE", body: JSON.stringify({ habitId }) })

// ── Profil ──
export const updateProfile = (updates: Partial<User>) => call<{ success: boolean }>("/api/users", { method: "PUT", body: JSON.stringify(updates) })
export const fetchMe = (id: number) => call<User>(`/api/users/${id}`)

// ── Pomodoro ──
export const completePomodoro = () => call<{ user: User }>("/api/pomodoro", { method: "POST", body: JSON.stringify({ session: { count: 1 } }) })

// ── Chelenjlar ──
export const getChallenges = () => call<{ user: User; views: ChallengeView[] }>("/api/challenges")
export const challengeAction = (action: "start" | "checkin", challengeId: number) =>
  call<{ user: User; views: ChallengeView[]; justCompleted: number[] }>("/api/challenges", { method: "POST", body: JSON.stringify({ action, challengeId }) })

// ── Reyting ──
export interface LeaderboardEntry { rank: number; id: number; displayName: string; avatarUrl?: string; level: number; score: number; isMe: boolean; selectedBorder?: string }
export interface LeaderboardResponse { period: "all" | "week"; limit: number; weekStart?: string; entries: LeaderboardEntry[]; me: LeaderboardEntry | null }
export const getLeaderboard = (period: "all" | "week") => call<LeaderboardResponse>(`/api/leaderboard?period=${period}`)

// ── Haftalik reja ──
export type TaskCategory = "study" | "programming" | "health" | "personal" | "work" | "other"
export type TaskPriority = "low" | "medium" | "high"
export interface WeeklyTask {
  id: string; title: string; description: string; date: string; time: string | null; durationMin: number | null
  category: TaskCategory; priority: TaskPriority; reminderMin: number | null
  completed: boolean; completedAt: string | null; createdAt: string; updatedAt: string
}
export type TaskInput = Omit<WeeklyTask, "id" | "completed" | "completedAt" | "createdAt" | "updatedAt">
export const listWeeklyTasks = (from: string, to: string) => call<{ tasks: WeeklyTask[]; today: string }>(`/api/weekly-tasks?from=${from}&to=${to}`)
export const listOverdueTasks = () => call<{ tasks: WeeklyTask[]; today: string }>("/api/weekly-tasks?overdue=1")
export const createWeeklyTask = (t: TaskInput) => call<{ task: WeeklyTask }>("/api/weekly-tasks", { method: "POST", body: JSON.stringify(t) })
export const patchWeeklyTask = (id: string, patch: Partial<TaskInput> & { completed?: boolean }) =>
  call<{ task: WeeklyTask }>(`/api/weekly-tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) })
export const deleteWeeklyTask = (id: string) => call<{ success: boolean }>(`/api/weekly-tasks/${id}`, { method: "DELETE" })
