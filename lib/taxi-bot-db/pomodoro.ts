/**
 * POMIDORO (POMODORO) UCHUN DATABASE OPERATSIYALAR
 * Bu faylda pomodoro_sessions collection bilan ishlash uchun barcha funksiyalar
 */

import { getDb } from "@/lib/mongodb"
import type { TaxiPomodoroSession, ApiResponse } from "@/types/taxi-bot"
import { addXpToUser } from "./users"
import { createXpHistory } from "./xp-history"

/**
 * Yangi pomidoro sessiyasini saqlash
 * @param session - Sessiya ma'lumotlari
 * @returns {Promise<ApiResponse<{session: TaxiPomodoroSession, xpAdded: number}>>}
 */
export async function createPomodoroSession(
  session: Omit<TaxiPomodoroSession, "_id" | "xpEarned">,
): Promise<ApiResponse<{ session: TaxiPomodoroSession; xpAdded: number }>> {
  try {
    const db = await getDb()
    const pomodoroCollection = db.collection<TaxiPomodoroSession>("pomodoro_sessions")

    // XP hisoblash: har 25 daqiqa (1 pomidoro) uchun 50 XP
    const xpEarned = session.type === "work" ? Math.floor(session.duration / 25) * 50 : 0

    const newSession: TaxiPomodoroSession = {
      ...session,
      xpEarned,
      startedAt: new Date(session.startedAt),
      endedAt: new Date(session.endedAt),
      date: new Date().toISOString().split("T")[0],
    }

    const result = // eslint-disable-next-line @typescript-eslint/no-explicit-any
 await newSessionCollection.// eslint-disable-next-line @typescript-eslint/no-explicit-any
    insertOne(newSession as any)
    const createdSession = await pomodoroCollection.findOne({ _id: result.insertedId })

    // Agar ish sessiyasi bo'lsa, XP qo'shish
    if (xpEarned > 0) {
      await addXpToUser(session.userId, xpEarned)

      // XP tarixiga yozish
      await createXpHistory({
        userId: session.userId,
        amount: xpEarned,
        source: "pomodoro",
        sourceId: result.insertedId.toString(),
        timestamp: new Date(),
        description: `Pomidoro sessiyasi: ${session.duration} daqiqa`,
      })
    }

    return {
      success: true,
      data: {
        session: createdSession as TaxiPomodoroSession,
        xpAdded: xpEarned,
      },
      message: xpEarned > 0 ? `Ajoyib! +${xpEarned} XP olindi` : "Sessiya saqlandi",
    }
  } catch (error) {
    console.error("[MongoDB] Error creating pomodoro session:", error)
    return {
      success: false,
      error: "Pomidoro sessiyasini saqlashda xatolik yuz berdi",
    }
  }
}

/**
 * Foydalanuvchining pomidoro tarixini olish
 * @param userId - Foydalanuvchi ID
 * @param startDate - Boshlanish sanasi (optional)
 * @param endDate - Tugash sanasi (optional)
 * @returns {Promise<ApiResponse<TaxiPomodoroSession[]>>}
 */
export async function getPomodoroSessions(
  userId: number,
  startDate?: string,
  endDate?: string,
): Promise<ApiResponse<TaxiPomodoroSession[]>> {
  try {
    const db = await getDb()
    const pomodoroCollection = db.collection<TaxiPomodoroSession>("pomodoro_sessions")

    const filter: Record<string, unknown> = { userId }

    if (startDate || endDate) {
      filter.date = {}
      if (startDate) filter.date.$gte = startDate
      if (endDate) filter.date.$lte = endDate
    }

    const sessions = await pomodoroCollection.find(filter).sort({ startedAt: -1 }).toArray()

    return {
      success: true,
      data: sessions,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting pomodoro sessions:", error)
    return {
      success: false,
      error: "Pomidoro sessiyalarini olishda xatolik yuz berdi",
      data: [],
    }
  }
}

/**
 * Bugungi pomidoro statistikasini olish
 * @param userId - Foydalanuvchi ID
 * @returns {Promise<ApiResponse<{count: number, totalTime: number, xpEarned: number}>>}
 */
export async function getTodayPomodoroStats(
  userId: number,
): Promise<ApiResponse<{ count: number; totalTime: number; xpEarned: number }>> {
  try {
    const db = await getDb()
    const pomodoroCollection = db.collection<TaxiPomodoroSession>("pomodoro_sessions")

    const today = new Date().toISOString().split("T")[0]

    const sessions = await pomodoroCollection
      .find({
        userId,
        date: today,
        type: "work",
      })
      .toArray()

    const count = sessions.length
    const totalTime = sessions.reduce((sum, session) => sum + session.duration, 0)
    const xpEarned = sessions.reduce((sum, session) => sum + session.xpEarned, 0)

    return {
      success: true,
      data: {
        count,
        totalTime,
        xpEarned,
      },
    }
  } catch (error) {
    console.error("[MongoDB] Error getting today pomodoro stats:", error)
    return {
      success: false,
      error: "Bugungi pomidoro statistikasini olishda xatolik yuz berdi",
      data: { count: 0, totalTime: 0, xpEarned: 0 },
    }
  }
}

/**
 * Haftalik pomidoro statistikasini olish
 * @param userId - Foydalanuvchi ID
 * @returns {Promise<ApiResponse<{count: number, totalTime: number, xpEarned: number}>>}
 */
export async function getWeeklyPomodoroStats(
  userId: number,
): Promise<ApiResponse<{ count: number; totalTime: number; xpEarned: number }>> {
  try {
    const db = await getDb()
    const pomodoroCollection = db.collection<TaxiPomodoroSession>("pomodoro_sessions")

    // Haftaning boshlanishi (Dushanba)
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset)
    const weekStart = monday.toISOString().split("T")[0]

    const sessions = await pomodoroCollection
      .find({
        userId,
        date: { $gte: weekStart },
        type: "work",
      })
      .toArray()

    const count = sessions.length
    const totalTime = sessions.reduce((sum, session) => sum + session.duration, 0)
    const xpEarned = sessions.reduce((sum, session) => sum + session.xpEarned, 0)

    return {
      success: true,
      data: {
        count,
        totalTime,
        xpEarned,
      },
    }
  } catch (error) {
    console.error("[MongoDB] Error getting weekly pomodoro stats:", error)
    return {
      success: false,
      error: "Haftalik pomidoro statistikasini olishda xatolik yuz berdi",
      data: { count: 0, totalTime: 0, xpEarned: 0 },
    }
  }
}
