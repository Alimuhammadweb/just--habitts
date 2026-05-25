/**
 * XP TARIXI (XP HISTORY) UCHUN DATABASE OPERATSIYALAR
 * Bu faylda xp_history collection bilan ishlash uchun barcha funksiyalar
 */

import { getDb } from "@/lib/mongodb"
import type { TaxiXpHistory, ApiResponse } from "@/types/taxi-bot"

/**
 * XP tarixiga yangi yozuv qo'shish
 * @param history - XP tarixi ma'lumotlari
 * @returns {Promise<ApiResponse<TaxiXpHistory>>}
 */
export async function createXpHistory(history: Omit<TaxiXpHistory, "_id">): Promise<ApiResponse<TaxiXpHistory>> {
  try {
    const db = await getDb()
    const xpHistoryCollection = db.collection<TaxiXpHistory>("xp_history")

    const result = await xpHistoryCollection.insertOne(history as TaxiXpHistory)
    const createdHistory = await xpHistoryCollection.findOne({ _id: result.insertedId })

    return {
      success: true,
      data: createdHistory as TaxiXpHistory,
    }
  } catch (error) {
    console.error("[MongoDB] Error creating XP history:", error)
    return {
      success: false,
      error: "XP tarixini saqlashda xatolik yuz berdi",
    }
  }
}

/**
 * Foydalanuvchining XP tarixini olish
 * @param userId - Foydalanuvchi ID
 * @param limit - Nechta yozuvni ko'rsatish (default: 50)
 * @returns {Promise<ApiResponse<TaxiXpHistory[]>>}
 */
export async function getXpHistory(userId: number, limit = 50): Promise<ApiResponse<TaxiXpHistory[]>> {
  try {
    const db = await getDb()
    const xpHistoryCollection = db.collection<TaxiXpHistory>("xp_history")

    const history = await xpHistoryCollection.find({ userId }).sort({ timestamp: -1 }).limit(limit).toArray()

    return {
      success: true,
      data: history,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting XP history:", error)
    return {
      success: false,
      error: "XP tarixini olishda xatolik yuz berdi",
      data: [],
    }
  }
}

/**
 * Ma'lum davr uchun XP yig'indisini hisoblash
 * @param userId - Foydalanuvchi ID
 * @param startDate - Boshlanish sanasi
 * @param endDate - Tugash sanasi
 * @returns {Promise<ApiResponse<number>>}
 */
export async function getTotalXpForPeriod(
  userId: number,
  startDate: Date,
  endDate: Date,
): Promise<ApiResponse<number>> {
  try {
    const db = await getDb()
    const xpHistoryCollection = db.collection<TaxiXpHistory>("xp_history")

    const result = await xpHistoryCollection
      .aggregate([
        {
          $match: {
            userId,
            timestamp: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ])
      .toArray()

    const total = result.length > 0 ? result[0].total : 0

    return {
      success: true,
      data: total,
    }
  } catch (error) {
    console.error("[MongoDB] Error calculating total XP:", error)
    return {
      success: false,
      error: "Umumiy XP ni hisoblashda xatolik yuz berdi",
      data: 0,
    }
  }
}
