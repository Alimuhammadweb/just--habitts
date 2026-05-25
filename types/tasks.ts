export interface Task {
  id: number
  title: string
  description: string
  requirement: TaskRequirement
  reward: TaskReward
  difficulty: "easy" | "medium" | "hard" | "expert"
  category: "xp" | "habits" | "streak" | "level"
  icon: string
}

export interface TaskRequirement {
  type: "xp" | "level" | "habits" | "streak" | "completed_days"
  value: number
}

export interface TaskReward {
  type: "avatar" | "theme" | "badge" | "border"
  value: string
  name: string
  preview?: string
}

export interface TaskProgress {
  taskId: number
  progress: number
  completed: boolean
  completedAt?: string
}
