/**
 * FOYDALANUVCHILAR (USERS) UCHUN DATABASE OPERATSIYALAR
 * Bu faylda users collection bilan ishlash uchun barcha funksiyalar
 */

import { getDb } from "@/lib/mongodb"
import type { TaxiUser, ApiResponse } from "@/types/taxi-bot"

/**
 * Yangi foydalanuvchi qo'shish
 * @param user - Foydalanuvchi ma'lumotlari
 * @returns {Promise<ApiResponse<TaxiUser>>}
 */
export async function createUser(user: Omit<TaxiUser, "_id">): Promise<ApiResponse<TaxiUser>> {
  try {
    const db = await getDb()
    const usersCollection = db.collection<TaxiUser>("users")

    // Avval shunday foydalanuvchi bormi tekshirish
    const existingUser = await usersCollection.findOne({ telegramId: user.telegramId })
    if (existingUser) {
      return {
        success: false,
        error: "Bu foydalanuvchi allaqachon ro'yxatdan o'tgan",
      }
    }

    // Yangi foydalanuvchi qo'shish
    const result = await usersCollection.insertOne({
      ...user,
      registeredAt: new Date(),
      xp: 0,
      level: 1,
      isActive: true,
    } as TaxiUser)

    const newUser = await usersCollection.findOne({ _id: result.insertedId })

    return {
      success: true,
      data: newUser as TaxiUser,
      message: "Foydalanuvchi muvaffaqiyatli qo'shildi",
    }
  } catch (error) {
    console.error("[MongoDB] Error creating user:", error)
    return {
      success: false,
      error: "Foydalanuvchi qo'shishda xatolik yuz berdi",
    }
  }
}

/**
 * Telegram ID bo'yicha foydalanuvchini topish
 * @param telegramId - Telegram ID
 * @returns {Promise<ApiResponse<TaxiUser>>}
 */
export async function getUserByTelegramId(telegramId: number): Promise<ApiResponse<TaxiUser>> {
  try {
    const db = await getDb()
    const usersCollection = db.collection<TaxiUser>("users")

    const user = await usersCollection.findOne({ telegramId })

    if (!user) {
      return {
        success: false,
        error: "Foydalanuvchi topilmadi",
      }
    }

    return {
      success: true,
      data: user,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting user:", error)
    return {
      success: false,
      error: "Foydalanuvchini olishda xatolik yuz berdi",
    }
  }
}

/**
 * Barcha foydalanuvchilarni olish
 * @returns {Promise<ApiResponse<TaxiUser[]>>}
 */
export async function getAllUsers(): Promise<ApiResponse<TaxiUser[]>> {
  try {
    const db = await getDb()
    const usersCollection = db.collection<TaxiUser>("users")

    const users = await usersCollection.find({ isActive: true }).sort({ xp: -1 }).toArray()

    return {
      success: true,
      data: users,
    }
  } catch (error) {
    console.error("[MongoDB] Error getting all users:", error)
    return {
      success: false,
      error: "Foydalanuvchilarni olishda xatolik yuz berdi",
      data: [],
    }
  }
}

/**
 * Foydalanuvchi ma'lumotlarini yangilash
 * @param telegramId - Telegram ID
 * @param updates - Yangilanishlar
 * @returns {Promise<ApiResponse<TaxiUser>>}
 */
export async function updateUser(telegramId: number, updates: Partial<TaxiUser>): Promise<ApiResponse<TaxiUser>> {
  try {
    const db = await getDb()
    const usersCollection = db.collection<TaxiUser>("users")

    const result = await usersCollection.findOneAndUpdate(
      { telegramId },
      { $set: updates },
      { returnDocument: "after" },
    )

    if (!result) {
      return {
        success: false,
        error: "Foydalanuvchi topilmadi",
      }
    }

    return {
      success: true,
      data: result,
      message: "Foydalanuvchi muvaffaqiyatli yangilandi",
    }
  } catch (error) {
    console.error("[MongoDB] Error updating user:", error)
    return {
      success: false,
      error: "Foydalanuvchini yangilashda xatolik yuz berdi",
    }
  }
}

/**
 * Foydalanuvchiga XP qo'shish va darajani tekshirish
 * @param telegramId - Telegram ID
 * @param xpAmount - Qo'shiladigan XP miqdori
 * @returns {Promise<ApiResponse<{user: TaxiUser, leveledUp: boolean}>>}
 */
export async function addXpToUser(
  telegramId: number,
  xpAmount: number,
): Promise<ApiResponse<{ user: TaxiUser; leveledUp: boolean }>> {
  try {
    const db = await getDb()
    const usersCollection = db.collection<TaxiUser>("users")

    const user = await usersCollection.findOne({ telegramId })
    if (!user) {
      return {
        success: false,
        error: "Foydalanuvchi topilmadi",
      }
    }

    const newXp = user.xp + xpAmount
    // Har 1000 XP uchun 1 daraja ko'tariladi
    const newLevel = Math.floor(newXp / 1000) + 1
    const leveledUp = newLevel > user.level

    const result = await usersCollection.findOneAndUpdate(
      { telegramId },
      { $set: { xp: newXp, level: newLevel } },
      { returnDocument: "after" },
    )

    return {
      success: true,
      data: {
        user: result!,
        leveledUp,
      },
      message: leveledUp ? `Tabriklaymiz! Siz ${newLevel}-darajaga ko'tarildingiz!` : "XP muvaffaqiyatli qo'shildi",
    }
  } catch (error) {
    console.error("[MongoDB] Error adding XP:", error)
    return {
      success: false,
      error: "XP qo'shishda xatolik yuz berdi",
    }
  }
}

/**
 * Foydalanuvchini o'chirish (soft delete)
 * @param telegramId - Telegram ID
 * @returns {Promise<ApiResponse<void>>}
 */
export async function deleteUser(telegramId: number): Promise<ApiResponse<void>> {
  try {
    const db = await getDb()
    const usersCollection = db.collection<TaxiUser>("users")

    const result = await usersCollection.updateOne({ telegramId }, { $set: { isActive: false } })

    if (result.matchedCount === 0) {
      return {
        success: false,
        error: "Foydalanuvchi topilmadi",
      }
    }

    return {
      success: true,
      message: "Foydalanuvchi muvaffaqiyatli o'chirildi",
    }
  } catch (error) {
    console.error("[MongoDB] Error deleting user:", error)
    return {
      success: false,
      error: "Foydalanuvchini o'chirishda xatolik yuz berdi",
    }
  }
}
