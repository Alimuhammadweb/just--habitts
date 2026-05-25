/**
 * ODAT BAJARILISH TARIXI (HABIT LOGS) UCHUN DATABASE OPERATSIYALAR
 * Bu faylda habit_logs collection bilan ishlash uchun barcha funksiyalar
 */

import { getDb } from "@/lib/mongodb"
import type { TaxiHabitLog, ApiResponse } from "@/types/taxi-bot"
import { addXpToUser } from "./users"
import { getHabitById } from "./habits"
import { createXpHistory } from "./xp-history"

/**
 * Odat bajarilganini belgilash
 * @param userId - Foydalanuvchi ID
 * @param habitId - Odat ID
 * @returns {Promise<ApiResponse<{log: TaxiHabitLog, xpAdded: number}>>}
 */
export async function completeHabit(
  userId: number,
  habitId: string,
): Promise<ApiResponse<{ log: TaxiHabitLog; xpAdded: number }>> {
  try {
    const db = await getDb()
    const habitLogsCollection = db.collection<TaxiHabitLog>("habit_logs")

    // Odatni olish
    const habitResponse = await getHabitById(habitId)
    if (!habitResponse.success || !habitResponse.data) {
      return {
        success: false,
        error: "Odat topilmadi",
      }
    }

    const habit = habitResponse.data
    const today = new Date().toISOString().split("T")[0]

    // Bugun allaqachon bajarilganmi tekshirish
    const existingLog = await habitLogsCollection.findOne({
      userId,
      habitId,
      date: today,
    })

    if (existingLog) {
      return {
        success: false,
        error: "Bu odat bugun allaqachon bajarilgan",
      }
    }

    // Yangi log yozish
    const log: TaxiHabitLog = {
      userId,
      habitId,
      completedAt: new Date(),
      xpEarned: habit.xpReward,
      date: today,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any


    await logCollection.// eslint-disable-next-line @typescript-eslint/no-explicit-any
    insertOne(log as any)

    // Foydalanuvchiga XP qo'shish
    await addXpToUser(userId, habit.xpReward)

    // XP tarixiga yozish
    await createXpHistory({
      userId,
      amount: habit.xpReward,
      source: "habit",
      sourceId: habitId,
      timestamp: new Date(),
      description: `Odat bajarildi: ${habit.name}`,
    })

    return {
      success: true,
      data: {
        log,
        xpAdded: habit.xpReward,
      },
      message: `Ajoyib! +${habit.xpReward} XP olindi`,
    }
  } catch (error) {
    console.error("[MongoDB] Error completing habit:", error)
    return {
      success: false,
      error: "Odatni bajarishda xatolik yuz berdi",
    }
  }
}

/**
 * Foydalanuvchining odat tarixini olish
 * @param userId - Foydalanuvchi ID
 * @param startDate - Boshlanish sanasi (optional)
 * @param endDate - Tugash sanasi (optional)
 * @returns {Promise<ApiResponse<TaxiHabitLog[]>>}
 */
export async function getHabitLogs(
  userId: number,
  startDate?: string,
  endDate?: string,
): Promise<ApiResponse<TaxiHabitLog[]>> {
  try {
    const db = await getDb()
    const habitLogsCollection = db.collection<TaxiHabitLog>("habit_logs")

    const filter: Record<string, unknown> = { userId }

    if (startDate || endDate) {
      filter.date = {}
      if (startDate) filter.date.$gte = startDate
      if (endDate) filter.date.$lte = endDate
    }

    const logs = await habitLogsCollection.find(filter).sort({ completedAt: -1 }).toArray()

    return {
      success: true,
      data: logs,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting habit logs:", error)
    return {
      success: false,
      error: "Odat tarixini olishda xatolik yuz berdi",
      data: [],
    }
  }
}

/**
 * Ma'lum bir odat uchun tarixni olish
 * @param habitId - Odat ID
 * @returns {Promise<ApiResponse<TaxiHabitLog[]>>}
 */
export async function getHabitLogsByHabitId(habitId: string): Promise<ApiResponse<TaxiHabitLog[]>> {
  try {
    const db = await getDb()
    const habitLogsCollection = db.collection<TaxiHabitLog>("habit_logs")

    const logs = await habitLogsCollection.find({ habitId }).sort({ completedAt: -1 }).toArray()

    return {
      success: true,
      data: logs,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting habit logs by habit:", error)
    return {
      success: false,
      error: "Odat tarixini olishda xatolik yuz berdi",
      data: [],
    }
  }
}

/**
 * Bugungi bajarilgan odatlar sonini olish
 * @param userId - Foydalanuvchi ID
 * @returns {Promise<ApiResponse<number>>}
 */
export async function getTodayHabitCount(userId: number): Promise<ApiResponse<number>> {
  try {
    const db = await getDb()
    const habitLogsCollection = db.collection<TaxiHabitLog>("habit_logs")

    const today = new Date().toISOString().split("T")[0]
    const count = await habitLogsCollection.countDocuments({ userId, date: today })

    return {
      success: true,
      data: count,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting today habit count:", error)
    return {
      success: false,
      error: "Bugungi odatlar sonini olishda xatolik yuz berdi",
      data: 0,
    }
  }
}
