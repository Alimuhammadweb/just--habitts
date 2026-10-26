import type { User } from "@/types/user"
import { calculateTaskProgress } from "./tasks-system"
import { TASKS } from "@/types/user"

export function checkAndUnlockTasks(user: User): User {
  const progressMap = calculateTaskProgress(user)
  const newCompletedTasks: number[] = [...(user.completedTasks || [])]
  const newUnlockedAvatars: string[] = [...(user.unlockedAvatars || [])]
  const newUnlockedThemes: string[] = [...(user.unlockedThemes || [])]
  const newUnlockedBadges: string[] = [...(user.unlockedBadges || [])]
  const newUnlockedBorders: string[] = [...(user.unlockedBorders || [])]
  const newUnlockedFrames: string[] = [...(user.unlockedFrames || [])]
  const newUnlockedBackgrounds: string[] = [...(user.unlockedBackgrounds || [])]

  TASKS.forEach((task) => {
    const progress = progressMap.get(task.id) || 0
    const isCompleted = newCompletedTasks.includes(task.id)

    if (progress >= 100 && !isCompleted) {
      newCompletedTasks.push(task.id)

      // Unlock reward based on type
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

  return {
    ...user,
    completedTasks: newCompletedTasks,
    unlockedAvatars: newUnlockedAvatars,
    unlockedThemes: newUnlockedThemes,
    unlockedBadges: newUnlockedBadges,
    unlockedBorders: newUnlockedBorders,
    unlockedFrames: newUnlockedFrames,
    unlockedBackgrounds: newUnlockedBackgrounds,
  }
}
