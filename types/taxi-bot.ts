/**
 * TAXI BOT UCHUN BARCHA TURLAR (TYPES)
 * Bu faylda barcha ma'lumotlar uchun TypeScript interface'lar yozilgan
 */

// Foydalanuvchi (User) ma'lumotlari
export interface TaxiUser {
  _id?: string // MongoDB ID
  telegramId: number // Telegram user ID
  username?: string // Telegram username
  firstName: string // Ism
  lastName?: string // Familiya
  registeredAt: Date // Ro'yxatdan o'tgan vaqt
  xp: number // Tajriba ballari (Experience Points)
  level: number // Hozirgi daraja
  isActive: boolean // Faol yoki yo'q
}

// Odat (Habit) ma'lumotlari
export interface TaxiHabit {
  _id?: string // MongoDB ID
  userId: number // Qaysi foydalanuvchiga tegishli
  name: string // Odat nomi
  description?: string // Odat tavsifi
  daysOfWeek: number[] // Qaysi kunlarda (0=Yakshanba, 1=Dushanba, ...)
  createdAt: Date // Qachon yaratilgan
  deletedAt?: Date // Qachon o'chirilgan (agar o'chirilgan bo'lsa)
  isDeleted: boolean // O'chirilganmi
  xpReward: number // Bu odat uchun qancha XP beriladi
}

// Odat bajarilish tarixi (Habit Log)
export interface TaxiHabitLog {
  _id?: string // MongoDB ID
  userId: number // Foydalanuvchi ID
  habitId: string // Qaysi odat
  completedAt: Date // Qachon bajarilgan
  xpEarned: number // Qancha XP olindi
  date: string // Sana (YYYY-MM-DD formatda)
}

// Pomidoro sessiyasi (Pomodoro Session)
export interface TaxiPomodoroSession {
  _id?: string // MongoDB ID
  userId: number // Foydalanuvchi ID
  startedAt: Date // Qachon boshlangan
  endedAt: Date // Qachon tugagan
  duration: number // Qancha vaqt davom etgan (minutlarda)
  type: "work" | "break" // Ish yoki dam olish
  xpEarned: number // Qancha XP olindi
  date: string // Sana (YYYY-MM-DD formatda)
}

// XP tarixi (XP History)
export interface TaxiXpHistory {
  _id?: string // MongoDB ID
  userId: number // Foydalanuvchi ID
  amount: number // Qancha XP qo'shildi yoki ayirildi
  source: "habit" | "pomodoro" | "level_up" | "bonus" // Qayerdan keldi
  sourceId?: string // Odat yoki pomidoro ID
  timestamp: Date // Qachon qo'shilgan
  description?: string // Qo'shimcha ma'lumot
}

// Leaderboard (Reyting) ma'lumotlari
export interface TaxiLeaderboard {
  _id?: string // MongoDB ID
  userId: number // Foydalanuvchi ID
  username: string // Username
  firstName: string // Ism
  xp: number // Umumiy XP
  level: number // Daraja
  habitCount: number // Necha odat bajarilgan
  pomodoroCount: number // Necha pomidoro ishlagan
  rank: number // O'rinda
  period: "daily" | "weekly" | "monthly" | "all-time" // Qaysi davr
  periodDate: string // Davr sanasi (YYYY-MM-DD)
  updatedAt: Date // Oxirgi yangilanish vaqti
}

// Haftalik hisobot (Weekly Report)
export interface TaxiWeeklyReport {
  _id?: string // MongoDB ID
  userId: number // Foydalanuvchi ID
  weekStart: Date // Hafta boshlanishi
  weekEnd: Date // Hafta tugashi
  totalXp: number // Umumiy XP
  habitsCompleted: number // Bajarilgan odatlar soni
  pomodoroSessions: number // Pomidoro sessiyalari soni
  totalWorkTime: number // Umumiy ish vaqti (minutlarda)
  habitBreakdown: Array<{
    // Har bir odat uchun statistika
    habitId: string
    habitName: string
    completedCount: number
  }>
  createdAt: Date // Qachon yaratilgan
}

// Oylik hisobot (Monthly Report)
export interface TaxiMonthlyReport {
  _id?: string // MongoDB ID
  userId: number // Foydalanuvchi ID
  month: number // Oy (1-12)
  year: number // Yil
  totalXp: number // Umumiy XP
  habitsCompleted: number // Bajarilgan odatlar soni
  pomodoroSessions: number // Pomidoro sessiyalari soni
  totalWorkTime: number // Umumiy ish vaqti (minutlarda)
  averageDailyXp: number // O'rtacha kunlik XP
  bestDay: {
    // Eng yaxshi kun
    date: string
    xp: number
  }
  habitBreakdown: Array<{
    // Har bir odat uchun statistika
    habitId: string
    habitName: string
    completedCount: number
  }>
  createdAt: Date // Qachon yaratilgan
}

// API uchun Response turlari
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
