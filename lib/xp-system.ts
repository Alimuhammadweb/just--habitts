import type { User, XPData, DayStatus, DayLock } from "@/types/user"
import { XP_REWARDS, LEVEL_THRESHOLDS } from "@/types/user"

/**
 * XP SYSTEM - DATE-BASED TRACKING WITH AUTOMATIC DAILY PENALTIES
 *
 * CORE RULES:
 * 1. Each habit works independently
 * 2. Only ONE day can be open at a time per habit
 * 3. At midnight (00:00), ALL unmarked days are automatically:
 *    - Marked as "missed" (o'tkazib yuborildi)
 *    - Penalized with -15 XP
 *    - Locked permanently (no editing allowed)
 * 4. Yesterday's day is ALWAYS locked, regardless of status
 */

export function getCurrentDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function isDateTodayOrFuture(dateString: string): boolean {
  const today = getCurrentDateString()
  return dateString >= today
}

export function getExpectedDateForDay(habitStartTimestamp: number, dayIndex: number): string {
  const startDate = new Date(habitStartTimestamp)
  const expectedDate = new Date(startDate)
  expectedDate.setDate(expectedDate.getDate() + dayIndex)
  return getDateString(expectedDate)
}

export function calculateXP(status: DayStatus): number {
  return XP_REWARDS[status]
}

export function calculateLevel(totalXP: number): number {
  return Math.floor(totalXP / 100) + 1
}

export function getLevelName(level: number): string {
  if (level >= 30) return LEVEL_THRESHOLDS.ELITE.name
  if (level >= 20) return LEVEL_THRESHOLDS.IRON_MIND.name
  if (level >= 10) return LEVEL_THRESHOLDS.ATOMIC_MAN.name
  if (level >= 5) return LEVEL_THRESHOLDS.DISCIPLINE.name
  return LEVEL_THRESHOLDS.BEGINNER.name
}

export function getXPForNextLevel(currentLevel: number): number {
  const nextLevel = currentLevel + 1
  return nextLevel * 100
}

export function calculateRanks(users: User[]): User[] {
  const sorted = [...users].sort((a, b) => {
    if (b.xpData.totalXP !== a.xpData.totalXP) {
      return b.xpData.totalXP - a.xpData.totalXP
    }
    if (b.xpData.weeklyXP !== a.xpData.weeklyXP) {
      return b.xpData.weeklyXP - a.xpData.weeklyXP
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  return sorted.map((user, index) => ({
    ...user,
    xpData: {
      ...user.xpData,
      rank: index + 1,
    },
  }))
}

export function getRankTitle(rank: number | null): string {
  if (rank === null) return "Unranked"
  if (rank === 1) return "Legend"
  if (rank <= 10) return "Elite"
  if (rank <= 50) return "Master"
  if (rank <= 200) return "Warrior"
  return "Challenger"
}

export function getRankEmoji(rank: number | null): string {
  if (rank === null) return "🎯"
  if (rank === 1) return "🥇"
  if (rank === 2) return "🥈"
  if (rank === 3) return "🥉"
  if (rank <= 10) return "🏆"
  if (rank <= 50) return "⭐"
  return "🎯"
}

export function getLevelBadge(level: number): string {
  if (level >= 30) return "👑"
  if (level >= 20) return "💎"
  if (level >= 10) return "⭐"
  if (level >= 5) return "🔥"
  return "🌱"
}

/**
 * CHECK IF STATUS CAN BE CHANGED - DATE-BASED
 * Now checks if the expected calendar date has arrived
 */
export function canChangeStatus(
  dayLock: DayLock | undefined,
  habitStartDate: number,
  dayIndex: number,
): { allowed: boolean; reason: string } {
  const currentDate = getCurrentDateString()
  const expectedDate = getExpectedDateForDay(habitStartDate, dayIndex)

  // If day is not marked yet, check if expected date has arrived
  if (!dayLock) {
    if (currentDate >= expectedDate) {
      return { allowed: true, reason: "" }
    } else {
      return {
        allowed: false,
        reason: `This day opens on ${expectedDate}. Current date: ${currentDate}`,
      }
    }
  }

  const markedDate = dayLock.dateString

  // Can only change on the same day it was marked
  if (currentDate === markedDate) {
    return {
      allowed: true,
      reason: "Status can be changed (same day)",
    }
  }

  return {
    allowed: false,
    reason: "Status locked. You can only change status on the same day it was marked.",
  }
}

/**
 * UPDATE HABIT STATUS - OPTIMIZED
 * Improved performance and clarity
 */
export function updateHabitStatus(
  user: User,
  habitId: number,
  dayIndex: number,
  newStatus: DayStatus | "none",
  missReason?: string,
): {
  success: boolean
  message: string
  updatedUser?: User
  xpChange?: number
} {
  const habitIndex = user.habits.findIndex((h) => h.id === habitId)
  if (habitIndex === -1) {
    return { success: false, message: "Habit not found" }
  }

  const habit = user.habits[habitIndex]
  const currentDayLock = habit.dayLocks?.[dayIndex]

  const validation = canChangeStatus(currentDayLock, habit.startDate.timestamp, dayIndex)

  if (!validation.allowed) {
    return { success: false, message: validation.reason }
  }

  const currentDate = getCurrentDateString()
  const now = Date.now()

  // Calculate XP delta
  const oldXP = currentDayLock?.xpAwarded || 0
  let xpChange = 0

  if (newStatus === "none") {
    xpChange = -oldXP
  } else {
    const newXP = calculateXP(newStatus)
    xpChange = newXP - oldXP
  }

  // Update habit
  const updatedHabits = [...user.habits]
  const updatedHabit = { ...habit }

  if (newStatus === "none") {
    const { [dayIndex]: removed, ...restDays } = updatedHabit.days
    updatedHabit.days = restDays

    if (updatedHabit.dayLocks) {
      const { [dayIndex]: removedLock, ...restLocks } = updatedHabit.dayLocks
      updatedHabit.dayLocks = restLocks
    }

    if (updatedHabit.missReasons) {
      const { [dayIndex]: removedReason, ...restReasons } = updatedHabit.missReasons
      updatedHabit.missReasons = restReasons
    }
  } else {
    updatedHabit.days = {
      ...updatedHabit.days,
      [dayIndex]: newStatus,
    }

    updatedHabit.dayLocks = {
      ...updatedHabit.dayLocks,
      [dayIndex]: {
        status: newStatus,
        markedAt: now,
        dateString: currentDate,
        xpAwarded: calculateXP(newStatus),
        locked: false,
      },
    }

    if (newStatus === "missed" && missReason) {
      updatedHabit.missReasons = {
        ...updatedHabit.missReasons,
        [dayIndex]: missReason,
      }
    }
  }

  updatedHabits[habitIndex] = updatedHabit

  // Update XP data
  const newTotalXP = Math.max(0, user.xpData.totalXP + xpChange)
  const newWeeklyXP = Math.max(0, user.xpData.weeklyXP + xpChange)
  const newMonthlyXP = Math.max(0, user.xpData.monthlyXP + xpChange)
  const newLevel = calculateLevel(newTotalXP)
  const currentXP = user.xpData.currentXP || 0
  const newCurrentXP = Math.max(0, currentXP + xpChange)

  // Update XP history (optimized)
  const updatedHistory = user.xpData.xpHistory.filter((h) => !(h.habitId === habitId && h.dayIndex === dayIndex))

  if (xpChange !== 0) {
    updatedHistory.push({
      date: currentDate,
      xpEarned: xpChange,
      habitId,
      dayIndex,
      status: newStatus === "none" ? "missed" : newStatus,
      timestamp: now,
    })
  }

  const updatedXPData: XPData = {
    ...user.xpData,
    totalXP: newTotalXP,
    currentXP: newCurrentXP,
    level: newLevel,
    weeklyXP: newWeeklyXP,
    monthlyXP: newMonthlyXP,
    xpHistory: updatedHistory,
    lastUpdated: now,
  }

  const updatedUser: User = {
    ...user,
    habits: updatedHabits,
    xpData: updatedXPData,
  }

  return {
    success: true,
    message: xpChange > 0 ? `+${xpChange} XP` : xpChange < 0 ? `${xpChange} XP` : "Status updated",
    updatedUser,
    xpChange,
  }
}

/**
 * LOCK OLD DAYS AND APPLY PENALTIES - CRITICAL FUNCTION
 * This runs every time the app loads and when the day changes
 *
 * NEW BEHAVIOR:
 * - All days from yesterday and before are locked
 * - Unmarked days automatically get "missed" status and -15 XP penalty
 * - Each habit is processed independently
 */
export function lockOldDays(user: User): User {
  const currentDate = getCurrentDateString()
  let totalPenalty = 0
  let updatedXPData = { ...user.xpData }

  let remainingFreezes = user.streakFreezes || 0
  let freezesConsumed = 0

  const updatedHabits = user.habits.map((habit) => {
    let habitPenalty = 0
    const updatedDays = { ...habit.days }
    const updatedLocks = { ...habit.dayLocks } || {}
    const updatedMissReasons = { ...habit.missReasons } || {}

    const habitStartDate = new Date(habit.startDate.timestamp)
    const today = new Date(currentDate)

    const checkDate = new Date(habitStartDate)
    let dayIndex = 0

    while (checkDate < today) {
      const checkDateString = getDateString(checkDate)
      const existingLock = updatedLocks[dayIndex]

      // If day is not marked or not locked yet
      if (!existingLock || !existingLock.locked) {
        // Check if this day was supposed to be marked
        const expectedDate = getExpectedDateForDay(habit.startDate.timestamp, dayIndex)

        if (expectedDate < currentDate) {
          // This day should have been marked but wasn't
          if (!updatedDays[dayIndex]) {
            // Check if user has streak freeze available
            if (remainingFreezes > 0) {
              updatedDays[dayIndex] = "frozen"
              updatedLocks[dayIndex] = {
                status: "frozen",
                markedAt: Date.now(),
                dateString: checkDateString,
                xpAwarded: 0, // No penalty for frozen day
                locked: true,
              }
              updatedMissReasons[dayIndex] = "streak-freeze"
              remainingFreezes--
              freezesConsumed++
            } else {
              updatedDays[dayIndex] = "missed"
              updatedLocks[dayIndex] = {
                status: "missed",
                markedAt: Date.now(),
                dateString: checkDateString,
                xpAwarded: -15, // Penalty for missed day
                locked: true,
              }
              updatedMissReasons[dayIndex] = "auto-missed" // System marked as missed
              habitPenalty += 15
            }
          } else {
            // Day was marked, just lock it
            if (existingLock) {
              updatedLocks[dayIndex] = { ...existingLock, locked: true }
            } else {
              updatedLocks[dayIndex] = {
                status: updatedDays[dayIndex],
                markedAt: Date.now(),
                dateString: checkDateString,
                xpAwarded: calculateXP(updatedDays[dayIndex]),
                locked: true,
              }
            }
          }
        }
      }

      checkDate.setDate(checkDate.getDate() + 1)
      dayIndex++
    }

    totalPenalty += habitPenalty

    return {
      ...habit,
      days: updatedDays,
      dayLocks: updatedLocks,
      missReasons: updatedMissReasons,
    }
  })

  if (totalPenalty > 0) {
    const newTotalXP = Math.max(0, user.xpData.totalXP - totalPenalty)
    const newWeeklyXP = Math.max(0, user.xpData.weeklyXP - totalPenalty)
    const newMonthlyXP = Math.max(0, user.xpData.monthlyXP - totalPenalty)
    const newLevel = calculateLevel(newTotalXP)
    const newCurrentXP = Math.max(0, (user.xpData.currentXP || 0) - totalPenalty)

    // Add penalty to XP history
    const penaltyHistory = {
      date: currentDate,
      xpEarned: -totalPenalty,
      habitId: 0, // System-wide penalty
      dayIndex: -1,
      status: "missed" as DayStatus,
      timestamp: Date.now(),
    }

    updatedXPData = {
      ...user.xpData,
      totalXP: newTotalXP,
      currentXP: newCurrentXP,
      level: newLevel,
      weeklyXP: newWeeklyXP,
      monthlyXP: newMonthlyXP,
      xpHistory: [...user.xpData.xpHistory, penaltyHistory],
      lastUpdated: Date.now(),
    }
  }

  return {
    ...user,
    habits: updatedHabits,
    xpData: updatedXPData,
    streakFreezes: Math.max(0, (user.streakFreezes || 0) - freezesConsumed),
    totalFreezesUsed: (user.totalFreezesUsed || 0) + freezesConsumed,
  }
}

/**
 * GET NEXT AVAILABLE DAY - STRICT RULE: ONLY ONE DAY OPEN AT A TIME
 *
 * RULES:
 * 1. If no days marked yet, only Day 0 can be marked (if date has arrived)
 * 2. If Day N is marked, only Day N+1 can be marked next
 * 3. Each day must wait for its calendar date
 */
export function getNextAvailableDay(
  habit: {
    days: Record<number, DayStatus>
    dayLocks?: Record<number, DayLock>
    startDate: { timestamp: number }
  },
  totalDuration: number,
): { dayIndex: number | null; hoursRemaining?: number; lastMarkedDay?: number } {
  const currentDate = getCurrentDateString()

  // Find the last marked day
  const markedDays = Object.keys(habit.days)
    .map(Number)
    .filter((index) => habit.days[index])
    .sort((a, b) => b - a)

  if (markedDays.length === 0) {
    const expectedDate = getExpectedDateForDay(habit.startDate.timestamp, 0)

    if (currentDate >= expectedDate) {
      return { dayIndex: 0 }
    } else {
      // Calculate hours until day 0 opens
      const today = new Date()
      const expected = new Date(expectedDate + "T00:00:00")
      const hoursDiff = (expected.getTime() - today.getTime()) / (1000 * 60 * 60)

      return {
        dayIndex: null,
        hoursRemaining: Math.max(0, hoursDiff),
        lastMarkedDay: -1,
      }
    }
  }

  const lastMarkedDay = markedDays[0]

  if (lastMarkedDay >= totalDuration - 1) {
    return { dayIndex: null, lastMarkedDay }
  }

  const nextDay = lastMarkedDay + 1
  const expectedDate = getExpectedDateForDay(habit.startDate.timestamp, nextDay)

  // Check if the expected calendar date has arrived
  if (currentDate >= expectedDate) {
    return { dayIndex: nextDay, lastMarkedDay }
  }

  // Calculate hours until next day opens
  const today = new Date()
  const expected = new Date(expectedDate + "T00:00:00")
  const hoursDiff = (expected.getTime() - today.getTime()) / (1000 * 60 * 60)

  return {
    dayIndex: null,
    hoursRemaining: Math.max(0, hoursDiff),
    lastMarkedDay,
  }
}

export function resetWeeklyXP(user: User): User {
  return {
    ...user,
    xpData: {
      ...user.xpData,
      weeklyXP: 0,
    },
  }
}

export function resetMonthlyXP(user: User): User {
  return {
    ...user,
    xpData: {
      ...user.xpData,
      monthlyXP: 0,
    },
  }
}

export function checkRankChange(oldRank: number | null, newRank: number | null) {
  if (oldRank === null || newRank === null) {
    return { changed: false, direction: null, oldRank, newRank }
  }

  if (oldRank > newRank) {
    return { changed: true, direction: "up" as const, oldRank, newRank }
  } else if (oldRank < newRank) {
    return { changed: true, direction: "down" as const, oldRank, newRank }
  }

  return { changed: false, direction: null, oldRank, newRank }
}

/**
 * Haftalik va oylik XP ni sanaga qarab qayta hisoblash
 * Har haftada dushanba kuni weeklyXP, har oyda 1-kuni monthlyXP nolga tushadi
 */
export function recalculatePeriodicXP(user: User): User {
  const now = new Date()
  const lastUpdated = new Date(user.xpData.lastUpdated || Date.now())
  
  // XP history dan haqiqiy weekly/monthly XP hisoblash
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  const xpHistory = user.xpData.xpHistory || []
  
  const realWeeklyXP = xpHistory
    .filter(h => new Date(h.date) >= oneWeekAgo && h.xpEarned > 0)
    .reduce((sum, h) => sum + h.xpEarned, 0)
  
  const realMonthlyXP = xpHistory
    .filter(h => new Date(h.date) >= oneMonthAgo && h.xpEarned > 0)
    .reduce((sum, h) => sum + h.xpEarned, 0)
  
  return {
    ...user,
    xpData: {
      ...user.xpData,
      weeklyXP: realWeeklyXP,
      monthlyXP: realMonthlyXP,
    }
  }
}


/**
 * Streak Freeze berish - har 7 kun birida, maksimum 3 ta
 */
export function earnStreakFreeze(user: User): { user: User; earned: boolean } {
  const MAX_FREEZES = 3
  const current = user.streakFreezes || 0
  
  if (current >= MAX_FREEZES) {
    return { user, earned: false }
  }

  const now = Date.now()
  const lastEarned = user.lastFreezeEarned || 0
  const daysSinceLast = (now - lastEarned) / (1000 * 60 * 60 * 24)

  // Earn 1 freeze every 7 days of activity, max 3
  if (daysSinceLast >= 7 || lastEarned === 0) {
    return {
      user: {
        ...user,
        streakFreezes: Math.min(MAX_FREEZES, current + 1),
        lastFreezeEarned: now,
      },
      earned: true,
    }
  }

  return { user, earned: false }
}

/**
 * Manual freeze ishlatish (foydalanuvchi o'zi bosadi)
 */
export function useStreakFreeze(user: User, habitId: number, dayIndex: number): User {
  if ((user.streakFreezes || 0) <= 0) return user

  const updatedHabits = user.habits.map((habit) => {
    if (habit.id !== habitId) return habit
    
    // Only freeze a missed and locked day
    if (habit.days[dayIndex] !== "missed") return habit

    return {
      ...habit,
      days: { ...habit.days, [dayIndex]: "frozen" as const },
      dayLocks: {
        ...habit.dayLocks,
        [dayIndex]: {
          ...habit.dayLocks?.[dayIndex],
          status: "frozen" as const,
          xpAwarded: 0,
        },
      },
      missReasons: {
        ...habit.missReasons,
        [dayIndex]: "streak-freeze",
      },
    }
  })

  return {
    ...user,
    habits: updatedHabits,
    streakFreezes: (user.streakFreezes || 0) - 1,
    totalFreezesUsed: (user.totalFreezesUsed || 0) + 1,
  }
}
