/**
 * LEADERBOARD (REYTING) UCHUN DATABASE OPERATSIYALAR
 * Bu faylda leaderboard collection bilan ishlash uchun barcha funksiyalar
 */

import { getDb } from "@/lib/mongodb"
import type { TaxiLeaderboard, ApiResponse } from "@/types/taxi-bot"
import { getAllUsers } from "./users"
import { getHabitLogs } from "./habit-logs"
import { getPomodoroSessions } from "./pomodoro"

/**
 * Leaderboard yangilash (barcha foydalanuvchilar uchun)
 * @param period - Qaysi davr uchun ("daily" | "weekly" | "monthly" | "all-time")
 * @returns {Promise<ApiResponse<TaxiLeaderboard[]>>}
 */
export async function updateLeaderboard(
  period: "daily" | "weekly" | "monthly" | "all-time",
): Promise<ApiResponse<TaxiLeaderboard[]>> {
  try {
    const db = await getDb()
    const leaderboardCollection = db.collection<TaxiLeaderboard>("leaderboard")

    // Barcha foydalanuvchilarni olish
    const usersResponse = await getAllUsers()
    if (!usersResponse.success || !usersResponse.data) {
      return {
        success: false,
        error: "Foydalanuvchilarni olishda xatolik",
        data: [],
      }
    }

    const users = usersResponse.data

    // Davr sanasini aniqlash
    const today = new Date()
    let periodDate: string

    if (period === "daily") {
      periodDate = today.toISOString().split("T")[0]
    } else if (period === "weekly") {
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(today)
      monday.setDate(today.getDate() + mondayOffset)
      periodDate = monday.toISOString().split("T")[0]
    } else if (period === "monthly") {
      periodDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`
    } else {
      periodDate = "all-time"
    }

    // Har bir foydalanuvchi uchun statistika hisoblash
    const leaderboardData: TaxiLeaderboard[] = []

    for (const user of users) {
      // Odatlar va pomidoro sonini hisoblash
      let habitCount = 0
      let pomodoroCount = 0

      if (period !== "all-time") {
        const startDate = periodDate
        const endDate = today.toISOString().split("T")[0]

        const habitsResponse = await getHabitLogs(user.telegramId, startDate, endDate)
        habitCount = habitsResponse.data?.length || 0

        const pomodoroResponse = await getPomodoroSessions(user.telegramId, startDate, endDate)
        pomodoroCount = pomodoroResponse.data?.filter((s) => s.type === "work").length || 0
      } else {
        const habitsResponse = await getHabitLogs(user.telegramId)
        habitCount = habitsResponse.data?.length || 0

        const pomodoroResponse = await getPomodoroSessions(user.telegramId)
        pomodoroCount = pomodoroResponse.data?.filter((s) => s.type === "work").length || 0
      }

      leaderboardData.push({
        userId: user.telegramId,
        username: user.username || "",
        firstName: user.firstName,
        xp: user.xp,
        level: user.level,
        habitCount,
        pomodoroCount,
        rank: 0, // Keyinroq qo'yamiz
        period,
        periodDate,
        updatedAt: new Date(),
      })
    }

    // XP bo'yicha saralash va rank berish
    leaderboardData.sort((a, b) => b.xp - a.xp)
    leaderboardData.forEach((entry, index) => {
      entry.rank = index + 1
    })

    // Databasega saqlash (upsert)
    const bulkOps = leaderboardData.map((entry) => ({
      updateOne: {
        filter: { userId: entry.userId, period, periodDate },
        update: { $set: entry },
        upsert: true,
      },
    }))

    if (bulkOps.length > 0) {
      await leaderboardCollection.bulkWrite(bulkOps)
    }

    return {
      success: true,
      data: leaderboardData,
      message: "Leaderboard muvaffaqiyatli yangilandi",
    }
  } catch (error) {
    console.error("[MongoDB] Error updating leaderboard:", error)
    return {
      success: false,
      error: "Leaderboard yangilashda xatolik yuz berdi",
      data: [],
    }
  }
}

/**
 * Leaderboard ni olish
 * @param period - Qaysi davr uchun
 * @param limit - Nechta o'rinni ko'rsatish (default: 100)
 * @returns {Promise<ApiResponse<TaxiLeaderboard[]>>}
 */
export async function getLeaderboard(
  period: "daily" | "weekly" | "monthly" | "all-time",
  limit = 100,
): Promise<ApiResponse<TaxiLeaderboard[]>> {
  try {
    const db = await getDb()
    const leaderboardCollection = db.collection<TaxiLeaderboard>("leaderboard")

    // Eng so'nggi leaderboard ni olish
    const leaderboard = await leaderboardCollection.find({ period }).sort({ rank: 1 }).limit(limit).toArray()

    // Agar bo'sh bo'lsa, yangilash
    if (leaderboard.length === 0) {
      return await updateLeaderboard(period)
    }

    return {
      success: true,
      data: leaderboard,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting leaderboard:", error)
    return {
      success: false,
      error: "Leaderboard ni olishda xatolik yuz berdi",
      data: [],
    }
  }
}

/**
 * Foydalanuvchining leaderboard dagi o'rnini topish
 * @param userId - Foydalanuvchi ID
 * @param period - Qaysi davr uchun
 * @returns {Promise<ApiResponse<TaxiLeaderboard>>}
 */
export async function getUserRank(
  userId: number,
  period: "daily" | "weekly" | "monthly" | "all-time",
): Promise<ApiResponse<TaxiLeaderboard>> {
  try {
    const db = await getDb()
    const leaderboardCollection = db.collection<TaxiLeaderboard>("leaderboard")

    const userEntry = await leaderboardCollection.findOne({ userId, period })

    if (!userEntry) {
      // Agar topilmasa, leaderboard ni yangilash
      await updateLeaderboard(period)
      const updatedEntry = await leaderboardCollection.findOne({ userId, period })

      if (!updatedEntry) {
        return {
          success: false,
          error: "Foydalanuvchi leaderboard da topilmadi",
        }
      }

      return {
        success: true,
        data: updatedEntry,
      }
    }

    return {
      success: true,
      data: userEntry,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting user rank:", error)
    return {
      success: false,
      error: "Foydalanuvchi o'rnini olishda xatolik yuz berdi",
    }
  }
}
