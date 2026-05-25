/**
 * HISOBOTLAR (REPORTS) UCHUN DATABASE OPERATSIYALAR
 * Bu faylda haftalik va oylik hisobotlar uchun barcha funksiyalar
 */

import { getDb } from "@/lib/mongodb"
import type { TaxiWeeklyReport, TaxiMonthlyReport, ApiResponse } from "@/types/taxi-bot"
import { getHabitLogs } from "./habit-logs"
import { getPomodoroSessions } from "./pomodoro"
import { getTotalXpForPeriod } from "./xp-history"
import { getUserHabits } from "./habits"

/**
 * Haftalik hisobot yaratish
 * @param userId - Foydalanuvchi ID
 * @returns {Promise<ApiResponse<TaxiWeeklyReport>>}
 */
export async function createWeeklyReport(userId: number): Promise<ApiResponse<TaxiWeeklyReport>> {
  try {
    const db = await getDb()
    const weeklyReportsCollection = db.collection<TaxiWeeklyReport>("weekly_reports")

    // Haftaning boshlanishi va tugashini aniqlash
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    // Haftalik odatlar
    const habitsResponse = await getHabitLogs(
      userId,
      monday.toISOString().split("T")[0],
      sunday.toISOString().split("T")[0],
    )
    const habitLogs = habitsResponse.data || []

    // Haftalik pomidoro
    const pomodoroResponse = await getPomodoroSessions(
      userId,
      monday.toISOString().split("T")[0],
      sunday.toISOString().split("T")[0],
    )
    const pomodoroSessions = pomodoroResponse.data || []

    // Umumiy XP
    const xpResponse = await getTotalXpForPeriod(userId, monday, sunday)
    const totalXp = xpResponse.data || 0

    // Ish vaqti
    const totalWorkTime = pomodoroSessions.filter((s) => s.type === "work").reduce((sum, s) => sum + s.duration, 0)

    // Har bir odat uchun statistika
    const habitsMap = new Map<string, { habitName: string; completedCount: number }>()
    const userHabitsResponse = await getUserHabits(userId)
    const userHabits = userHabitsResponse.data || []

    for (const log of habitLogs) {
      const habit = userHabits.find((h) => h._id?.toString() === log.habitId)
      if (habit) {
        const existing = habitsMap.get(log.habitId)
        if (existing) {
          existing.completedCount++
        } else {
          habitsMap.set(log.habitId, {
            habitName: habit.name,
            completedCount: 1,
          })
        }
      }
    }

    const habitBreakdown = Array.from(habitsMap.entries()).map(([habitId, data]) => ({
      habitId,
      habitName: data.habitName,
      completedCount: data.completedCount,
    }))

    // Hisobotni yaratish
    const report: TaxiWeeklyReport = {
      userId,
      weekStart: monday,
      weekEnd: sunday,
      totalXp,
      habitsCompleted: habitLogs.length,
      pomodoroSessions: pomodoroSessions.filter((s) => s.type === "work").length,
      totalWorkTime,
      habitBreakdown,
      createdAt: new Date(),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any


    await reportCollection.// eslint-disable-next-line @typescript-eslint/no-explicit-any
    insertOne(report as any)

    return {
      success: true,
      data: report,
      message: "Haftalik hisobot yaratildi",
    }
  } catch (error) {
    console.error("[MongoDB] Error creating weekly report:", error)
    return {
      success: false,
      error: "Haftalik hisobot yaratishda xatolik yuz berdi",
    }
  }
}

/**
 * Oylik hisobot yaratish
 * @param userId - Foydalanuvchi ID
 * @param month - Oy (1-12)
 * @param year - Yil
 * @returns {Promise<ApiResponse<TaxiMonthlyReport>>}
 */
export async function createMonthlyReport(
  userId: number,
  month: number,
  year: number,
): Promise<ApiResponse<TaxiMonthlyReport>> {
  try {
    const db = await getDb()
    const monthlyReportsCollection = db.collection<TaxiMonthlyReport>("monthly_reports")

    // Oyning boshlanishi va tugashi
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

    // Oylik odatlar
    const habitsResponse = await getHabitLogs(
      userId,
      monthStart.toISOString().split("T")[0],
      monthEnd.toISOString().split("T")[0],
    )
    const habitLogs = habitsResponse.data || []

    // Oylik pomidoro
    const pomodoroResponse = await getPomodoroSessions(
      userId,
      monthStart.toISOString().split("T")[0],
      monthEnd.toISOString().split("T")[0],
    )
    const pomodoroSessions = pomodoroResponse.data || []

    // Umumiy XP
    const xpResponse = await getTotalXpForPeriod(userId, monthStart, monthEnd)
    const totalXp = xpResponse.data || 0

    // Ish vaqti
    const totalWorkTime = pomodoroSessions.filter((s) => s.type === "work").reduce((sum, s) => sum + s.duration, 0)

    // O'rtacha kunlik XP
    const daysInMonth = monthEnd.getDate()
    const averageDailyXp = Math.floor(totalXp / daysInMonth)

    // Eng yaxshi kunni topish
    const dailyXpMap = new Map<string, number>()
    for (const log of habitLogs) {
      const date = log.date
      dailyXpMap.set(date, (dailyXpMap.get(date) || 0) + log.xpEarned)
    }
    for (const session of pomodoroSessions.filter((s) => s.type === "work")) {
      const date = session.date
      dailyXpMap.set(date, (dailyXpMap.get(date) || 0) + session.xpEarned)
    }

    let bestDay = { date: "", xp: 0 }
    for (const [date, xp] of dailyXpMap.entries()) {
      if (xp > bestDay.xp) {
        bestDay = { date, xp }
      }
    }

    // Har bir odat uchun statistika
    const habitsMap = new Map<string, { habitName: string; completedCount: number }>()
    const userHabitsResponse = await getUserHabits(userId)
    const userHabits = userHabitsResponse.data || []

    for (const log of habitLogs) {
      const habit = userHabits.find((h) => h._id?.toString() === log.habitId)
      if (habit) {
        const existing = habitsMap.get(log.habitId)
        if (existing) {
          existing.completedCount++
        } else {
          habitsMap.set(log.habitId, {
            habitName: habit.name,
            completedCount: 1,
          })
        }
      }
    }

    const habitBreakdown = Array.from(habitsMap.entries()).map(([habitId, data]) => ({
      habitId,
      habitName: data.habitName,
      completedCount: data.completedCount,
    }))

    // Hisobotni yaratish
    const report: TaxiMonthlyReport = {
      userId,
      month,
      year,
      totalXp,
      habitsCompleted: habitLogs.length,
      pomodoroSessions: pomodoroSessions.filter((s) => s.type === "work").length,
      totalWorkTime,
      averageDailyXp,
      bestDay,
      habitBreakdown,
      createdAt: new Date(),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any


    await reportCollection.// eslint-disable-next-line @typescript-eslint/no-explicit-any
    insertOne(report as any)

    return {
      success: true,
      data: report,
      message: "Oylik hisobot yaratildi",
    }
  } catch (error) {
    console.error("[MongoDB] Error creating monthly report:", error)
    return {
      success: false,
      error: "Oylik hisobot yaratishda xatolik yuz berdi",
    }
  }
}

/**
 * Haftalik hisobotlarni olish
 * @param userId - Foydalanuvchi ID
 * @param limit - Nechta hisobotni ko'rsatish (default: 10)
 * @returns {Promise<ApiResponse<TaxiWeeklyReport[]>>}
 */
export async function getWeeklyReports(userId: number, limit = 10): Promise<ApiResponse<TaxiWeeklyReport[]>> {
  try {
    const db = await getDb()
    const weeklyReportsCollection = db.collection<TaxiWeeklyReport>("weekly_reports")

    const reports = await weeklyReportsCollection.find({ userId }).sort({ weekStart: -1 }).limit(limit).toArray()

    return {
      success: true,
      data: reports,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting weekly reports:", error)
    return {
      success: false,
      error: "Haftalik hisobotlarni olishda xatolik yuz berdi",
      data: [],
    }
  }
}

/**
 * Oylik hisobotlarni olish
 * @param userId - Foydalanuvchi ID
 * @param limit - Nechta hisobotni ko'rsatish (default: 12)
 * @returns {Promise<ApiResponse<TaxiMonthlyReport[]>>}
 */
export async function getMonthlyReports(userId: number, limit = 12): Promise<ApiResponse<TaxiMonthlyReport[]>> {
  try {
    const db = await getDb()
    const monthlyReportsCollection = db.collection<TaxiMonthlyReport>("monthly_reports")

    const reports = await monthlyReportsCollection.find({ userId }).sort({ year: -1, month: -1 }).limit(limit).toArray()

    return {
      success: true,
      data: reports,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting monthly reports:", error)
    return {
      success: false,
      error: "Oylik hisobotlarni olishda xatolik yuz berdi",
      data: [],
    }
  }
}
