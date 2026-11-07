import { userStreak, type HabitLike } from "@/lib/stats/habit-stats"
import { todayKey, resolveTimezone } from "@/lib/dates"
import type { User, Task } from "@/types/user"
import { TASKS as TASK_LIST } from "@/types/user"

export function calculateTaskProgress(user: User): Map<number, number> {
  const progress = new Map<number, number>()

  // Calculate total completed days across all habits
  const totalCompletedDays = user.habits.reduce(
    (sum, habit) => sum + Object.values(habit.days).filter((s) => s === "completed").length,
    0,
  )

  // Streak yagona statistika xizmatidan olinadi (boshqa joyda qayta hisoblanmaydi)
  const consecutiveStreak = userStreak(user.habits as HabitLike[], todayKey(resolveTimezone(user.timezone)), resolveTimezone(user.timezone)).current

  const totalPomodoros = user.pomodoroData?.totalPomodoros || 0

  TASK_LIST.forEach((task) => {
    let taskProgress = 0

    switch (task.requirement.type) {
      case "xp":
        taskProgress = Math.min(100, (user.xpData.totalXP / task.requirement.value) * 100)
        break
      case "level":
        taskProgress = Math.min(100, (user.xpData.level / task.requirement.value) * 100)
        break
      case "habits":
        taskProgress = Math.min(100, (user.habits.length / task.requirement.value) * 100)
        break
      case "consecutive_days":
      case "streak":
        taskProgress = Math.min(100, (consecutiveStreak / task.requirement.value) * 100)
        break
      case "completed_days":
        taskProgress = Math.min(100, (totalCompletedDays / task.requirement.value) * 100)
        break
      case "pomodoro":
        taskProgress = Math.min(100, (totalPomodoros / task.requirement.value) * 100)
        break
    }

    progress.set(task.id, Math.round(taskProgress))
  })

  return progress
}

export function checkAndUnlockTasks(user: User): User {
  const progressMap = calculateTaskProgress(user)
  const newCompletedTasks: number[] = [...(user.completedTasks || [])]
  const newUnlockedAvatars: string[] = [...(user.unlockedAvatars || [])]
  const newUnlockedThemes: string[] = [...(user.unlockedThemes || [])]
  const newUnlockedBadges: string[] = [...(user.unlockedBadges || [])]
  const newUnlockedBorders: string[] = [...(user.unlockedBorders || [])]
  const newUnlockedFrames: string[] = [...(user.unlockedFrames || [])]
  const newUnlockedBackgrounds: string[] = [...(user.unlockedBackgrounds || [])]

  let totalXPBonus = 0

  TASK_LIST.forEach((task) => {
    const progress = progressMap.get(task.id) || 0
    const isCompleted = newCompletedTasks.includes(task.id)

    if (progress >= 100 && !isCompleted) {
      newCompletedTasks.push(task.id)

      let xpBonus = 0
      switch (task.difficulty) {
        case "easy":
          xpBonus = 5
          break
        case "medium":
          xpBonus = 15
          break
        case "hard":
          xpBonus = 50
          break
        case "expert":
          xpBonus = 100
          break
      }
      totalXPBonus += xpBonus

      // Unlock reward
      switch (task.reward.type) {
        case "avatar":
          if (!newUnlockedAvatars.includes(task.reward.value)) {
            newUnlockedAvatars.push(task.reward.value)
          }
          break
        case "theme":
          if (!newUnlockedThemes.includes(task.reward.value)) {
            newUnlockedThemes.push(task.reward.value)
          }
          break
        case "badge":
          if (!newUnlockedBadges.includes(task.reward.value)) {
            newUnlockedBadges.push(task.reward.value)
          }
          break
        case "border":
          if (!newUnlockedBorders.includes(task.reward.value)) {
            newUnlockedBorders.push(task.reward.value)
          }
          break
        case "frame":
          if (!newUnlockedFrames.includes(task.reward.value)) {
            newUnlockedFrames.push(task.reward.value)
          }
          break
        case "background":
          if (!newUnlockedBackgrounds.includes(task.reward.value)) {
            newUnlockedBackgrounds.push(task.reward.value)
          }
          break
      }
    }
  })

  const updatedXPData = {
    ...user.xpData,
    totalXP: user.xpData.totalXP + totalXPBonus,
    currentXP: user.xpData.currentXP + totalXPBonus,
  }

  return {
    ...user,
    xpData: updatedXPData,
    completedTasks: newCompletedTasks,
    unlockedAvatars: newUnlockedAvatars,
    unlockedThemes: newUnlockedThemes,
    unlockedBadges: newUnlockedBadges,
    unlockedBorders: newUnlockedBorders,
    unlockedFrames: newUnlockedFrames,
    unlockedBackgrounds: newUnlockedBackgrounds,
  }
}

export function isTaskCompleted(user: User, taskId: number): boolean {
  return (user.completedTasks || []).includes(taskId)
}

export function getTasksByCategory(category: string): Task[] {
  return TASK_LIST.filter((task) => task.category === category)
}

export function getTasksByDifficulty(difficulty: string): Task[] {
  return TASK_LIST.filter((task) => task.difficulty === difficulty)
}
