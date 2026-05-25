/**
 * TAXI BOT DATABASE - BARCHA FUNKSIYALAR
 * Bu fayldan barcha database funksiyalarini import qilish mumkin
 */

// Users
export {
  createUser,
  getUserByTelegramId,
  getAllUsers,
  updateUser,
  addXpToUser,
  deleteUser,
} from "./users"

// Habits
export {
  createHabit,
  getUserHabits,
  getHabitById,
  updateHabit,
  deleteHabit,
  getTodayHabits,
} from "./habits"

// Habit Logs
export {
  completeHabit,
  getHabitLogs,
  getHabitLogsByHabitId,
  getTodayHabitCount,
} from "./habit-logs"

// Pomodoro
export {
  createPomodoroSession,
  getPomodoroSessions,
  getTodayPomodoroStats,
  getWeeklyPomodoroStats,
} from "./pomodoro"

// XP History
export { createXpHistory, getXpHistory, getTotalXpForPeriod } from "./xp-history"

// Leaderboard
export { updateLeaderboard, getLeaderboard, getUserRank } from "./leaderboard"

// Reports
export {
  createWeeklyReport,
  createMonthlyReport,
  getWeeklyReports,
  getMonthlyReports,
} from "./reports"

// MongoDB connection
export { connectToDatabase, getDb } from "@/lib/mongodb"
