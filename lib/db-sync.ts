"use client"

import type { User, Habit } from "@/types/user"
import { authFetch } from "@/lib/api-client"

const BASE_URL = typeof window !== "undefined" ? window.location.origin : ""

async function apiFetch(path: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    // authFetch access token muddati tugagan bo'lsa, avtomatik yangilab,
    // so'rovni bir marta qayta yuboradi.
    const res = await authFetch(`${BASE_URL}${path}`, { ...options, signal: controller.signal })
    clearTimeout(timeout)
    return res
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

// Foydalanuvchini bazaga saqlash
export async function saveUser(user: User): Promise<void> {
  if (!user?.id) {
    console.warn("[DB] saveUser: user.id yo'q")
    return
  }
  const res = await apiFetch("/api/users", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `saveUser xato: ${res.status}`)
  }
}

// Habit qo'shish
export async function addHabit(userId: number, habit: Habit): Promise<void> {
  const res = await apiFetch("/api/habits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, habit }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `addHabit xato: ${res.status}`)
  }
}

// Habit yangilash
export async function updateHabit(userId: number, habitId: number, updates: Partial<Habit>): Promise<void> {
  const res = await apiFetch("/api/habits", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, habitId, updates }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `updateHabit xato: ${res.status}`)
  }
}

// Habit o'chirish
export async function deleteHabit(userId: number, habitId: number): Promise<void> {
  const res = await apiFetch("/api/habits", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, habitId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `deleteHabit xato: ${res.status}`)
  }
}

interface PomodoroSession {
  id: number
  date: string
  count: number
}

// Pomodoro saqlash
export async function savePomodoro(userId: number, session: PomodoroSession): Promise<void> {
  const res = await apiFetch("/api/pomodoro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, session }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `savePomodoro xato: ${res.status}`)
  }
}

// Barcha foydalanuvchilarni olish - faqat server (PostgreSQL)
let cachedUsers: User[] | null = null
let lastFetchTime = 0
const CACHE_MS = 8000

export async function fetchAllUsers(): Promise<User[]> {
  const now = Date.now()
  if (cachedUsers && now - lastFetchTime < CACHE_MS) return cachedUsers

  const res = await apiFetch("/api/users", { cache: "no-store" } as RequestInit)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `fetchUsers xato: ${res.status}`)
  }
  const users = await res.json()
  cachedUsers = Array.isArray(users) ? users : []
  lastFetchTime = now
  return cachedUsers!
}

export function clearUsersCache() {
  cachedUsers = null
  lastFetchTime = 0
}
