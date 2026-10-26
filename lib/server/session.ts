import type { NextResponse } from "next/server"
import {
  createAccessToken, createRefreshToken,
  ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS, REFRESH_MAX_AGE_SECONDS,
} from "@/lib/auth"
import { newTokenId } from "@/lib/auth-refresh"
import { storeRefreshToken } from "@/lib/refresh-tokens"
import { updateUserColumns } from "@/lib/server/user-store"
import type { User } from "@/types/user"

/** Access + refresh cookie'larini qo'yadi (parol bilan kirish va Google uchun umumiy). */
export async function issueTokens(res: NextResponse, id: number, isAdmin: boolean) {
  const access = await createAccessToken({ id, isAdmin })
  const jti = newTokenId()
  const refresh = await createRefreshToken({ id, isAdmin }, jti)
  // Admin (id 0) bazada saqlanmagani uchun refresh tokeni ham DB'ga yozilmaydi - faqat imzosi tekshiriladi.
  if (id !== 0) await storeRefreshToken(jti, id, refresh, REFRESH_MAX_AGE_SECONDS)
  res.cookies.set(ACCESS_COOKIE, access, ACCESS_COOKIE_OPTIONS)
  res.cookies.set(REFRESH_COOKIE, refresh, REFRESH_COOKIE_OPTIONS)
}

/** Oxirgi kirish vaqtini yozadi (admin monitoringi uchun). Xato kirishga xalaqit bermaydi. */
export async function markLogin(userId: number) {
  try { await updateUserColumns(userId, { lastLoginAt: new Date() }) } catch (e) { console.warn("[Auth] lastLoginAt yozilmadi:", e) }
}

export function adminEmail() { return (process.env.ADMIN_EMAIL || "admin@mail.com").toLowerCase().trim() }

/** .env orqali kiradigan admin (id 0) uchun bazaga bog'liq bo'lmagan "foydalanuvchi" obyekti. */
export function buildEnvAdminUser(): User {
  return {
    id: 0, name: "Admin", email: adminEmail(), password: "",
    createdAt: new Date().toISOString(), isActive: true, isAdmin: true,
    habits: [], stats: { totalHabits: 0, completedDays: 0, currentStreak: 0, longestStreak: 0 },
    pomodoroData: { sessions: [], totalPomodoros: 0 },
    xpData: { totalXP: 0, level: 1, rank: null, weeklyXP: 0, monthlyXP: 0, xpHistory: [], currentXP: 0, lastUpdated: Date.now() },
    publicProfile: false, unlockedAvatars: [], unlockedThemes: [], unlockedBadges: [],
    unlockedBorders: [], unlockedFrames: [], unlockedBackgrounds: [],
    completedTasks: [], plannedHabits: [], streakFreezes: 3, totalFreezesUsed: 0,
    friends: [], friendRequests: [], sentRequests: [],
  }
}
