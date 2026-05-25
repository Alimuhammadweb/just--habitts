/**
 * ODATLAR (HABITS) UCHUN DATABASE OPERATSIYALAR
 * Bu faylda habits collection bilan ishlash uchun barcha funksiyalar
 */

import { getDb } from "@/lib/mongodb"
import type { TaxiHabit, ApiResponse } from "@/types/taxi-bot"
import { ObjectId } from "mongodb"

/**
 * Yangi odat qo'shish
 * @param habit - Odat ma'lumotlari
 * @returns {Promise<ApiResponse<TaxiHabit>>}
 */
export async function createHabit(habit: Omit<TaxiHabit, "_id">): Promise<ApiResponse<TaxiHabit>> {
  try {
    const db = await getDb()
    const habitsCollection = db.collection<TaxiHabit>("habits")

    const newHabit = {
      ...habit,
      createdAt: new Date(),
      isDeleted: false,
      xpReward: 100, // Har bir odat uchun 100 XP
    } as TaxiHabit

    const result = await habitsCollection.insertOne(newHabit)
    const createdHabit = await habitsCollection.findOne({ _id: result.insertedId })

    return {
      success: true,
      data: createdHabit as TaxiHabit,
      message: "Odat muvaffaqiyatli qo'shildi",
    }
  } catch (error) {
    console.error("[MongoDB] Error creating habit:", error)
    return {
      success: false,
      error: "Odat qo'shishda xatolik yuz berdi",
    }
  }
}

/**
 * Foydalanuvchining barcha odatlarini olish
 * @param userId - Foydalanuvchi ID
 * @param includeDeleted - O'chirilganlarni ham ko'rsatish (default: false)
 * @returns {Promise<ApiResponse<TaxiHabit[]>>}
 */
export async function getUserHabits(userId: number, includeDeleted = false): Promise<ApiResponse<TaxiHabit[]>> {
  try {
    const db = await getDb()
    const habitsCollection = db.collection<TaxiHabit>("habits")

    const filter: Record<string, unknown> = { userId }
    if (!includeDeleted) {
      filter.isDeleted = false
    }

    const habits = await habitsCollection.find(filter).sort({ createdAt: -1 }).toArray()

    return {
      success: true,
      data: habits,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting user habits:", error)
    return {
      success: false,
      error: "Odatlarni olishda xatolik yuz berdi",
      data: [],
    }
  }
}

/**
 * Odat ID bo'yicha topish
 * @param habitId - Odat ID
 * @returns {Promise<ApiResponse<TaxiHabit>>}
 */
export async function getHabitById(habitId: string): Promise<ApiResponse<TaxiHabit>> {
  try {
    const db = await getDb()
    const habitsCollection = db.collection<TaxiHabit>("habits")

    const habit = await habitsCollection.findOne({ _id: new ObjectId(habitId) })

    if (!habit) {
      return {
        success: false,
        error: "Odat topilmadi",
      }
    }

    return {
      success: true,
      data: habit,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting habit:", error)
    return {
      success: false,
      error: "Odatni olishda xatolik yuz berdi",
    }
  }
}

/**
 * Odatni yangilash
 * @param habitId - Odat ID
 * @param updates - Yangilanishlar
 * @returns {Promise<ApiResponse<TaxiHabit>>}
 */
export async function updateHabit(habitId: string, updates: Partial<TaxiHabit>): Promise<ApiResponse<TaxiHabit>> {
  try {
    const db = await getDb()
    const habitsCollection = db.collection<TaxiHabit>("habits")

    const result = await habitsCollection.findOneAndUpdate(
      { _id: new ObjectId(habitId) },
      { $set: updates },
      { returnDocument: "after" },
    )

    if (!result) {
      return {
        success: false,
        error: "Odat topilmadi",
      }
    }

    return {
      success: true,
      data: result,
      message: "Odat muvaffaqiyatli yangilandi",
    }
  } catch (error) {
    console.error("[MongoDB] Error updating habit:", error)
    return {
      success: false,
      error: "Odatni yangilashda xatolik yuz berdi",
    }
  }
}

/**
 * Odatni o'chirish (soft delete)
 * @param habitId - Odat ID
 * @returns {Promise<ApiResponse<void>>}
 */
export async function deleteHabit(habitId: string): Promise<ApiResponse<void>> {
  try {
    const db = await getDb()
    const habitsCollection = db.collection<TaxiHabit>("habits")

    const result = await habitsCollection.updateOne(
      { _id: new ObjectId(habitId) },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    )

    if (result.matchedCount === 0) {
      return {
        success: false,
        error: "Odat topilmadi",
      }
    }

    return {
      success: true,
      message: "Odat muvaffaqiyatli o'chirildi",
    }
  } catch (error) {
    console.error("[MongoDB] Error deleting habit:", error)
    return {
      success: false,
      error: "Odatni o'chirishda xatolik yuz berdi",
    }
  }
}

/**
 * Bugungi kun uchun bajariladigan odatlarni topish
 * @param userId - Foydalanuvchi ID
 * @returns {Promise<ApiResponse<TaxiHabit[]>>}
 */
export async function getTodayHabits(userId: number): Promise<ApiResponse<TaxiHabit[]>> {
  try {
    const db = await getDb()
    const habitsCollection = db.collection<TaxiHabit>("habits")

    // Bugungi kun raqamini olish (0=Yakshanba, 1=Dushanba, ...)
    const today = new Date().getDay()

    const habits = await habitsCollection
      .find({
        userId,
        isDeleted: false,
        daysOfWeek: { $in: [today] },
      })
      .toArray()

    return {
      success: true,
      data: habits,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting today habits:", error)
    return {
      success: false,
      error: "Bugungi odatlarni olishda xatolik yuz berdi",
      data: [],
    }
  }
}
