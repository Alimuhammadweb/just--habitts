export interface User {
  id: number
  name: string
  email: string
  password: string
  createdAt: string
  isActive: boolean
  isAdmin: boolean
  habits: Habit[]
  stats: UserStats
  pomodoroData: PomodoroData
  xpData: XPData
  avatarUrl?: string
  firstName?: string
  lastName?: string
  publicProfile: boolean
  unlockedAvatars: string[]
  unlockedThemes: string[]
  unlockedBadges: string[]
  unlockedBorders: string[]
  unlockedFrames?: string[]
  unlockedBackgrounds?: string[]
  completedTasks: number[]
  plannedHabits?: Habit[]
  // Friends system
  friends?: number[]           // friend user IDs
  friendRequests?: number[]    // incoming request user IDs
  sentRequests?: number[]      // outgoing request user IDs

  streakFreezes: number        // available freezes (max 3)
  totalFreezesUsed: number     // lifetime used
  lastFreezeEarned?: number    // timestamp
  selectedTheme?: string
  selectedBadge?: string
  selectedBorder?: string
  selectedFrame?: string
  selectedBackground?: string
  // Challenge system
  activeChallenges?: ActiveChallenge[]
  completedChallenges?: number[]
  challengeRewards?: ChallengeReward[]
}

export interface Habit {
  id: number
  name: string
  duration: number
  days: Record<number, DayStatus>
  dayLocks: Record<number, DayLock>
  time: { hour: number; minute: number } | null
  notifications: boolean
  startDate: {
    day: number
    month: number
    year: number
    timestamp: number
  }
  scheduledStartTime?: number
  why: string // Why is this habit important?
  missReasons: Record<number, string>
}

export interface DayLock {
  status: DayStatus
  markedAt: number // timestamp when marked
  dateString: string // YYYY-MM-DD format for day boundary checking
  xpAwarded: number // how much XP was given
  locked: boolean // prevents further changes after day ends
}

export type DayStatus = "completed" | "partial" | "missed"

export interface XPData {
  totalXP: number
  level: number
  rank: number | null // Rank can be null for new users temporarily
  weeklyXP: number
  monthlyXP: number
  xpHistory: XPHistory[]
  currentXP: number
  lastUpdated: number
}

export interface XPHistory {
  date: string // YYYY-MM-DD
  xpEarned: number
  habitId: number
  dayIndex: number // which day of the habit
  status: DayStatus
  timestamp: number
}

export interface MissReason {
  date: string // YYYY-MM-DD
  reason: "forgot" | "no-time" | "low-motivation" | "health" | "mental-overload" | "custom"
  customReason?: string
}

export interface UserStats {
  totalHabits: number
  completedDays: number
  currentStreak: number
  longestStreak: number
}

export interface PomodoroSession {
  id: number
  date: string // YYYY-MM-DD format
  count: number // number of pomodoros completed
}

export interface PomodoroData {
  sessions: PomodoroSession[]
  totalPomodoros: number
}

export interface Task {
  id: number
  title: string
  description: string
  requirement: TaskRequirement
  reward: TaskReward
  difficulty: "easy" | "medium" | "hard" | "expert"
  category: "xp" | "habits" | "streak" | "pomodoro" | "daily"
  animation?: "fade-in" | "sparkle" | "pulse" | "rotation" | "bounce" | "glow" | "shimmer" | "flash"
}

export interface TaskRequirement {
  type: "xp" | "level" | "habits" | "streak" | "completed_days" | "pomodoro" | "consecutive_days"
  value: number
}

export interface TaskReward {
  type: "avatar" | "theme" | "badge" | "border" | "frame" | "background"
  value: string
  name: string
  preview?: string
  visualDescription?: string
}

// ─── Challenge System ─────────────────────────────────────────────────────────

export type ChallengeDifficulty = "oson" | "ortacha" | "qiyin" | "iroda"

export interface Challenge {
  id: number
  title: string
  description: string
  difficulty: ChallengeDifficulty
  durationDays: number
  task: string // what to do
  reward: ChallengeReward
  icon: string
  color: string
}

export interface ChallengeReward {
  type: "frame" | "paint" | "border"
  value: string
  name: string
  description: string
  preview: string // CSS class or color hex
}

export interface ActiveChallenge {
  challengeId: number
  startedAt: number // timestamp
  completedDays: number[]  // day indices completed
  isCompleted: boolean
  completedAt?: number
}

export const CHALLENGES: Challenge[] = [
  // ─── OSON (5 ta) ────────────────────────────────────────────────────────
  {
    id: 1,
    title: "7 Kun Ertalab",
    description: "7 kun ketma-ket ertalab 06:00 gacha turing",
    difficulty: "oson",
    durationDays: 7,
    task: "Har kun ertalab 6:00 dan oldin turing va chelengni belgilang",
    reward: {
      type: "paint",
      value: "paint-sunrise",
      name: "Sunrise Bo'yog'i",
      description: "Profil rangini qizg'ish-sariq gradientga o'zgartiradi",
      preview: "linear-gradient(135deg, #f97316, #eab308)",
    },
    icon: "🌅",
    color: "#f97316",
  },
  {
    id: 2,
    title: "Suv Ichuvchi",
    description: "10 kun har kuni 2L suv iching",
    difficulty: "oson",
    durationDays: 10,
    task: "Har kuni 2 litr suv ichib chelengni belgilang",
    reward: {
      type: "paint",
      value: "paint-ocean",
      name: "Ocean Bo'yog'i",
      description: "Profil rangini ko'k-moviy gradientga o'zgartiradi",
      preview: "linear-gradient(135deg, #06b6d4, #3b82f6)",
    },
    icon: "💧",
    color: "#06b6d4",
  },
  {
    id: 3,
    title: "Kitobxon",
    description: "7 kun har kuni 20 bet kitob o'qing",
    difficulty: "oson",
    durationDays: 7,
    task: "Har kuni 20 bet kitob o'qib chelengni belgilang",
    reward: {
      type: "frame",
      value: "frame-reader",
      name: "Kitobxon Ramkasi",
      description: "Profil atrofida yashil nurli ramka",
      preview: "ring-4 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)]",
    },
    icon: "📚",
    color: "#10b981",
  },
  {
    id: 4,
    title: "Meditatsiya",
    description: "14 kun har kuni 10 daqiqa meditatsiya qiling",
    difficulty: "oson",
    durationDays: 14,
    task: "Har kuni 10 daqiqa meditatsiya qilib chelengni belgilang",
    reward: {
      type: "paint",
      value: "paint-zen",
      name: "Zen Bo'yog'i",
      description: "Profil rangini binafsha-ko'k gradientga o'zgartiradi",
      preview: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
    },
    icon: "🧘",
    color: "#8b5cf6",
  },
  {
    id: 5,
    title: "Shukrona Kundaligi",
    description: "7 kun har kuni 3 ta minnatdorchilik yozing",
    difficulty: "oson",
    durationDays: 7,
    task: "Har kuni 3 ta minnatdorchilik yozib chelengni belgilang",
    reward: {
      type: "border",
      value: "border-golden",
      name: "Oltin Chegara",
      description: "Profil kartasida oltin rang chegarasi",
      preview: "border-4 border-yellow-500 shadow-lg shadow-yellow-500/30",
    },
    icon: "✍️",
    color: "#eab308",
  },

  // ─── O'RTACHA (5 ta) ────────────────────────────────────────────────────
  {
    id: 6,
    title: "Sport Jangari",
    description: "21 kun har kuni 30 daqiqa sport qiling",
    difficulty: "ortacha",
    durationDays: 21,
    task: "Har kuni 30 daqiqa sport qilib chelengni belgilang",
    reward: {
      type: "frame",
      value: "frame-warrior",
      name: "Jangari Ramkasi",
      description: "Profil atrofida qizil-to'q nurli ramka",
      preview: "ring-4 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)]",
    },
    icon: "💪",
    color: "#ef4444",
  },
  {
    id: 7,
    title: "Tetrapak Pomodoro",
    description: "30 kun davomida 50 ta pomodoro yig'ing",
    difficulty: "ortacha",
    durationDays: 30,
    task: "Pomodoro taymerni tugatib chelengni belgilang (50 ta maqsad)",
    reward: {
      type: "paint",
      value: "paint-fire",
      name: "Olov Bo'yog'i",
      description: "Profil rangini qizil-to'q gradient olovga o'zgartiradi",
      preview: "linear-gradient(135deg, #ef4444, #f97316, #eab308)",
    },
    icon: "🍅",
    color: "#ef4444",
  },
  {
    id: 8,
    title: "Raqamli Detoks",
    description: "14 kun har kuni 1 soatdan ko'p telefon ishlatmaslik",
    difficulty: "ortacha",
    durationDays: 14,
    task: "Kun davomida 1 soatdan kam telefon ishlatib chelengni belgilang",
    reward: {
      type: "border",
      value: "border-crystal",
      name: "Kristal Chegara",
      description: "Profil kartasida kristall ko'k chegarasi",
      preview: "border-4 border-cyan-400 shadow-lg shadow-cyan-400/40",
    },
    icon: "📵",
    color: "#22d3ee",
  },
  {
    id: 9,
    title: "Sog'lom Ovqat",
    description: "21 kun har kuni sog'lom ovqatlaning",
    difficulty: "ortacha",
    durationDays: 21,
    task: "Har kuni fast-food yemay, sog'lom ovqatlanib chelengni belgilang",
    reward: {
      type: "frame",
      value: "frame-nature",
      name: "Tabiat Ramkasi",
      description: "Profil atrofida yashil tabiat rangdagi ramka",
      preview: "ring-4 ring-green-400 shadow-[0_0_18px_rgba(74,222,128,0.6)]",
    },
    icon: "🥗",
    color: "#4ade80",
  },
  {
    id: 10,
    title: "Erta Turuvchi",
    description: "30 kun ketma-ket 05:30 da turing",
    difficulty: "ortacha",
    durationDays: 30,
    task: "Har kuni 05:30 da turib chelengni belgilang",
    reward: {
      type: "paint",
      value: "paint-aurora",
      name: "Aurora Bo'yog'i",
      description: "Profil rangini yashil-ko'k aurora rangiga o'zgartiradi",
      preview: "linear-gradient(135deg, #10b981, #06b6d4, #6366f1)",
    },
    icon: "⏰",
    color: "#6366f1",
  },

  // ─── QIYIN (5 ta) ────────────────────────────────────────────────────────
  {
    id: 11,
    title: "90 Kun Yugurish",
    description: "90 kun har kuni kamida 3 km yuguring",
    difficulty: "qiyin",
    durationDays: 90,
    task: "Har kuni 3 km yugurub chelengni belgilang",
    reward: {
      type: "frame",
      value: "frame-lightning",
      name: "Chaqmoq Ramkasi",
      description: "Profil atrofida sariq-oq chaqmoq nurli ramka",
      preview: "ring-[5px] ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.8)] animate-pulse",
    },
    icon: "🏃",
    color: "#facc15",
  },
  {
    id: 12,
    title: "200 Pomodoro Ustasi",
    description: "200 ta pomodoro yakunlang",
    difficulty: "qiyin",
    durationDays: 60,
    task: "Pomodoro taymerni yugurib 200 ta yakunlang",
    reward: {
      type: "paint",
      value: "paint-crimson",
      name: "Qirmizi Bo'yog'i",
      description: "Profil rangini qirmizi-qora gotik rangga o'zgartiradi",
      preview: "linear-gradient(135deg, #7f1d1d, #ef4444, #991b1b)",
    },
    icon: "🔥",
    color: "#dc2626",
  },
  {
    id: 13,
    title: "60 Kun To'xtamasdan",
    description: "60 kun ketma-ket bitta odatni davom ettiring",
    difficulty: "qiyin",
    durationDays: 60,
    task: "Har kun bitta odatni bajarib chelengni belgilang",
    reward: {
      type: "border",
      value: "border-mythic",
      name: "Mifik Chegara",
      description: "Profil kartasida binafsha-oltin animatsiyali chegara",
      preview: "border-4 border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.7)] animate-pulse",
    },
    icon: "⚡",
    color: "#a855f7",
  },
  {
    id: 14,
    title: "Soat 4 da Tur",
    description: "45 kun ketma-ket soat 04:00 da turing",
    difficulty: "qiyin",
    durationDays: 45,
    task: "Har kuni soat 04:00 da turib chelengni belgilang",
    reward: {
      type: "frame",
      value: "frame-nocturnal",
      name: "Tun Ramkasi",
      description: "Profil atrofida qora-ko'k tun rangdagi ramka",
      preview: "ring-[5px] ring-slate-800 shadow-[0_0_30px_rgba(15,23,42,0.9),0_0_15px_rgba(99,102,241,0.5)]",
    },
    icon: "🌙",
    color: "#475569",
  },
  {
    id: 15,
    title: "100 Kun Sog'lom",
    description: "100 kun davomida sport va sog'lom ovqatlanishni birga qiling",
    difficulty: "qiyin",
    durationDays: 100,
    task: "Har kuni sport va sog'lom ovqatlanib ikkalasini ham belgilang",
    reward: {
      type: "paint",
      value: "paint-elite",
      name: "Elite Bo'yog'i",
      description: "Profil rangini oltin-kumush elite gradientiga o'zgartiradi",
      preview: "linear-gradient(135deg, #d4af37, #c0c0c0, #b8860b)",
    },
    icon: "🏆",
    color: "#d4af37",
  },

  // ─── IRODA (3 ta - juda ham qiyin) ───────────────────────────────────────
  {
    id: 16,
    title: "IRODA: 90 Kun Odat",
    description: "90 kun ketma-ket bitta odatni uzmasdan davom ettiring. Hech qanday uzr qabul qilinmaydi.",
    difficulty: "iroda",
    durationDays: 90,
    task: "Har kuni odatni bajarib chelengni belgilang — 90 kun to'liq",
    reward: {
      type: "frame",
      value: "frame-iroda-gold",
      name: "Iroda Oltin Ramkasi",
      description: "Profil atrofida oltin-qizil animatsiyali maxsus IRODA ramkasi — barcha leaderboard'da ko'rinadi",
      preview: "ring-[6px] ring-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.9)] animate-pulse",
    },
    icon: "👑",
    color: "#f59e0b",
  },
  {
    id: 17,
    title: "IRODA: 200 Pomodoro + 90 Kun",
    description: "Bir vaqtning o'zida 200 ta pomodoro yakunlang VA 90 kun ketma-ket odat saqlang. Ikkalasi ham bajarilishi shart.",
    difficulty: "iroda",
    durationDays: 120,
    task: "Har kuni pomodoro yakunlang VA odatni belgilang — 120 kun davomida",
    reward: {
      type: "paint",
      value: "paint-iroda-fire",
      name: "Iroda Olov Bo'yog'i",
      description: "Profil rangini animatsiyali qizil-sariq yonuvchi olov rangiga o'zgartiradi — leaderboard'da alohida ko'rinadi",
      preview: "linear-gradient(135deg, #7c2d12, #dc2626, #f97316, #eab308)",
    },
    icon: "🔱",
    color: "#dc2626",
  },
  {
    id: 18,
    title: "IRODA: Abadiy Chempion",
    description: "365 kun ketma-ket streak saqlang. Bu dunyo miqyosidagi eng qiyin cheleng. Faqat haqiqiy irodali odamlar uchun.",
    difficulty: "iroda",
    durationDays: 365,
    task: "365 kun to'liq streak saqlang — hech qanday uzilish bo'lmasligi kerak",
    reward: {
      type: "frame",
      value: "frame-immortal-champion",
      name: "Abadiy Chempion Ramkasi",
      description: "Butun saytda faqat siz ko'rinadigan IMMORTAL ramka — profil, leaderboard va barcha joylarda ko'rinadi. Hamma sizni taniydi.",
      preview: "ring-[7px] ring-red-500 shadow-[0_0_50px_rgba(239,68,68,1),0_0_100px_rgba(239,68,68,0.5)] animate-pulse",
    },
    icon: "⚔️",
    color: "#ef4444",
  },
]

export const ADMIN_CREDENTIALS = {
  // Client-side faqat registration ni bloklash uchun ishlatiladi
  // Haqiqiy autentifikatsiya server-side (API route) da amalga oshiriladi
  email: "admin@mail.com",
  password: "admin123",
}

export const LEVEL_THRESHOLDS = {
  BEGINNER: { min: 1, max: 4, name: "Beginner" },
  DISCIPLINE: { min: 5, max: 9, name: "Discipline" },
  ATOMIC_MAN: { min: 10, max: 19, name: "Atomic Man" },
  IRON_MIND: { min: 20, max: 29, name: "Iron Mind" },
  ELITE: { min: 30, max: Number.POSITIVE_INFINITY, name: "Elite" },
} as const

export const XP_REWARDS = {
  completed: 10,
  partial: 5,
  missed: -15, // Missed days now have -15 XP penalty
} as const

export const AVAILABLE_AVATARS = [
  { id: "default", name: "Default", url: "", requiresTask: false },
  { id: "golden", name: "Golden Shield", url: "🛡️", requiresTask: true, taskId: 1 },
  { id: "fire", name: "Fire Spirit", url: "🔥", requiresTask: true, taskId: 5 },
  { id: "star", name: "Star Power", url: "⭐", requiresTask: true, taskId: 10 },
  { id: "diamond", name: "Diamond", url: "💎", requiresTask: true, taskId: 15 },
  { id: "crown", name: "Crown", url: "👑", requiresTask: true, taskId: 20 },
] as const

export const AVAILABLE_THEMES = [
  { id: "default", name: "Default", colors: { primary: "#8b5cf6", secondary: "#3b82f6" }, requiresTask: false },
  { id: "fire", name: "Fire", colors: { primary: "#ef4444", secondary: "#f97316" }, requiresTask: true, taskId: 3 },
  { id: "ocean", name: "Ocean", colors: { primary: "#06b6d4", secondary: "#0ea5e9" }, requiresTask: true, taskId: 7 },
  {
    id: "forest",
    name: "Forest",
    colors: { primary: "#10b981", secondary: "#22c55e" },
    requiresTask: true,
    taskId: 12,
  },
  {
    id: "sunset",
    name: "Sunset",
    colors: { primary: "#f59e0b", secondary: "#ec4899" },
    requiresTask: true,
    taskId: 18,
  },
] as const

export const AVAILABLE_BADGES = [
  { id: "none", name: "No Badge", icon: "", requiresTask: false },
  { id: "starter", name: "Starter", icon: "✨", requiresTask: true, taskId: 1 },
  { id: "beginner", name: "Beginner", icon: "🌱", requiresTask: true, taskId: 2 },
  { id: "warrior", name: "Warrior", icon: "⚔️", requiresTask: true, taskId: 6 },
  { id: "master", name: "Master", icon: "🎯", requiresTask: true, taskId: 11 },
  { id: "legend", name: "Legend", icon: "🏆", requiresTask: true, taskId: 16 },
  { id: "tiny-green-dot", name: "Tiny Green Dot", icon: "🟢", requiresTask: true, taskId: 1 },
  { id: "mini-flame", name: "Mini Flame 🔥", icon: "🔥", requiresTask: true, taskId: 2 },
  { id: "lightning", name: "Lightning ⚡", icon: "⚡", requiresTask: true, taskId: 7 },
  { id: "shield", name: "Shield 🛡", icon: "🛡️", requiresTask: true, taskId: 11 },
  { id: "halo", name: "Animated Halo", icon: "🌟", requiresTask: true, taskId: 21 },
  { id: "star", name: "Profile Star ⭐", icon: "⭐", requiresTask: true, taskId: 24 },
] as const

export const AVAILABLE_BORDERS = [
  { id: "none", name: "No Border", style: "border-2 border-border", requiresTask: false },
  { id: "silver", name: "Silver Border", style: "border-4 border-gray-400", requiresTask: true, taskId: 3 },
  { id: "gold", name: "Gold Border", style: "border-4 border-yellow-500", requiresTask: true, taskId: 7 },
  {
    id: "rainbow",
    name: "Rainbow Border",
    style: "border-4 border-transparent bg-gradient-to-r from-red-500 via-purple-500 to-blue-500",
    requiresTask: true,
    taskId: 11,
  },
  {
    id: "glow",
    name: "Glow Border",
    style: "border-4 border-purple-500 shadow-lg shadow-purple-500/50",
    requiresTask: true,
    taskId: 16,
  },
  {
    id: "elite",
    name: "Elite Border",
    style: "border-4 border-transparent bg-gradient-to-r from-yellow-500 via-purple-500 to-blue-500",
    requiresTask: true,
    taskId: 22,
  },
  {
    id: "legendary",
    name: "Legendary Border",
    style: "border-4 border-transparent bg-gradient-to-r from-yellow-400 via-red-500 to-purple-600",
    requiresTask: true,
    taskId: 23,
  },
] as const

export const AVAILABLE_FRAMES = [
  { id: "none", name: "No Frame", style: "", requiresTask: false },
  { id: "soft-circle", name: "Soft Circle Frame", style: "ring-4 ring-purple-300", requiresTask: true, taskId: 4 },
  { id: "silver-line", name: "Silver Line", style: "ring-2 ring-gray-400", requiresTask: true, taskId: 6 },
  {
    id: "double-ring",
    name: "Double Ring Frame",
    style: "ring-4 ring-offset-2 ring-blue-500",
    requiresTask: true,
    taskId: 8,
  },
  {
    id: "doppler-karambit",
    name: "Doppler Karambit Frame",
    style: "ring-4 ring-offset-2 ring-gradient-to-r from-purple-500 via-pink-500 to-blue-500",
    requiresTask: true,
    taskId: 9,
    animation: "rotation",
  },
  {
    id: "neon-edge",
    name: "Neon Edge Effect",
    style: "ring-4 ring-cyan-400 shadow-lg shadow-cyan-400/50",
    requiresTask: true,
    taskId: 10,
  },
  {
    id: "shadow-frame",
    name: "Shadow Frame",
    style: "ring-4 ring-gray-800 shadow-2xl",
    requiresTask: true,
    taskId: 13,
    animation: "pulse",
  },
  {
    id: "crimson-karambit",
    name: "Crimson Karambit Frame",
    style: "ring-4 ring-offset-2 ring-gradient-to-r from-red-600 via-red-500 to-pink-500",
    requiresTask: true,
    taskId: 16,
    animation: "rotation",
  },
  {
    id: "dark-doppler",
    name: "Dark Doppler Frame",
    style: "ring-4 ring-offset-2 ring-gradient-to-r from-purple-900 via-indigo-800 to-purple-700",
    requiresTask: true,
    taskId: 19,
    animation: "slow-rotation",
  },
  {
    id: "mythic",
    name: "Mythic Frame",
    style: "ring-4 ring-offset-2 ring-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500",
    requiresTask: true,
    taskId: 20,
    animation: "shimmer",
  },
  {
    id: "ultimate-karambit",
    name: "Ultimate Karambit Frame",
    style: "ring-4 ring-offset-4 ring-gradient-to-r from-yellow-400 via-pink-500 to-purple-600",
    requiresTask: true,
    taskId: 23,
    animation: "spin",
  },
  {
    id: "immortal",
    name: "Immortal Frame",
    style: "ring-4 ring-offset-4 ring-gradient-to-r from-white via-purple-300 to-white animate-pulse",
    requiresTask: true,
    taskId: 25,
    animation: "glow",
  },
] as const

export const AVAILABLE_BACKGROUNDS = [
  { id: "default", name: "Default", colors: { primary: "#0f172a", secondary: "#1e293b" }, requiresTask: false },
  {
    id: "soft-gradient",
    name: "Soft Gradient",
    colors: { primary: "#8b5cf6", secondary: "#3b82f6" },
    requiresTask: true,
    taskId: 3,
  },
  {
    id: "animated-lines",
    name: "Animated Lines",
    colors: { primary: "#1e293b", secondary: "#334155" },
    requiresTask: true,
    taskId: 14,
    animated: true,
  },
  {
    id: "elite-theme",
    name: "Elite Profile Theme",
    colors: { primary: "#7c3aed", secondary: "#ec4899" },
    requiresTask: true,
    taskId: 22,
    animated: true,
  },
] as const

export const TASKS: Task[] = [
  // Easy (1-5)
  {
    id: 1,
    title: "Birinchi qadam",
    description: "1 ta odatni 1 kun bajarish",
    requirement: { type: "completed_days", value: 1 },
    reward: {
      type: "badge",
      value: "tiny-green-dot",
      name: "Tiny Green Dot",
      visualDescription: "Kichik yashil nuqta avatar yonida",
    },
    difficulty: "easy",
    category: "daily",
    animation: "fade-in",
  },
  {
    id: 2,
    title: "Boshlovchi",
    description: "3 kun ketma-ket kamida 1 odat",
    requirement: { type: "consecutive_days", value: 3 },
    reward: {
      type: "badge",
      value: "mini-flame",
      name: "Mini Flame 🔥",
      visualDescription: "Avatar atrofida mayda olov effekti",
    },
    difficulty: "easy",
    category: "streak",
    animation: "sparkle",
  },
  {
    id: 3,
    title: "Intizom",
    description: "5 kun ketma-ket yashil",
    requirement: { type: "consecutive_days", value: 5 },
    reward: {
      type: "background",
      value: "soft-gradient",
      name: "Soft Gradient Background",
      visualDescription: "Avatar orqasida yumshoq gradient",
    },
    difficulty: "easy",
    category: "streak",
    animation: "glow",
  },
  {
    id: 4,
    title: "Birinchi hafta",
    description: "7 kun ketma-ket",
    requirement: { type: "consecutive_days", value: 7 },
    reward: {
      type: "frame",
      value: "soft-circle",
      name: "Soft Circle Frame",
      visualDescription: "Yumaloq ramka avatar atrofida",
    },
    difficulty: "easy",
    category: "streak",
    animation: "pulse",
  },
  {
    id: 5,
    title: "Pomidor boshlanishi",
    description: "25 🍅 yig'ish",
    requirement: { type: "pomodoro", value: 25 },
    reward: {
      type: "badge",
      value: "tomato-seed",
      name: "Tomato Seed",
      visualDescription: "Qizil pomidor badge avatar yonida",
    },
    difficulty: "easy",
    category: "pomodoro",
    animation: "bounce",
  },

  // Medium (6-12)
  {
    id: 6,
    title: "Barqarorlik",
    description: "10 kun ketma-ket",
    requirement: { type: "consecutive_days", value: 10 },
    reward: {
      type: "frame",
      value: "silver-line",
      name: "Silver Line",
      visualDescription: "Yupqa kumush ramka",
    },
    difficulty: "medium",
    category: "streak",
    animation: "shimmer",
  },
  {
    id: 7,
    title: "Bir kunda ko'p ish",
    description: "1 kunda 3 odat bajarish",
    requirement: { type: "habits", value: 3 },
    reward: {
      type: "badge",
      value: "lightning",
      name: "Lightning ⚡",
      visualDescription: "Kichik lightning icon",
    },
    difficulty: "medium",
    category: "daily",
    animation: "flash",
  },
  {
    id: 8,
    title: "Odat ustasi",
    description: "3 odatni 7 kun davomida",
    requirement: { type: "habits", value: 3 },
    reward: {
      type: "frame",
      value: "double-ring",
      name: "Double Ring Frame",
      visualDescription: "Ikki ramka bir-biriga o'ralgan",
    },
    difficulty: "medium",
    category: "habits",
    animation: "rotation",
  },
  {
    id: 9,
    title: "Pomidor yig'uvchi",
    description: "50 🍅 yig'ish",
    requirement: { type: "pomodoro", value: 50 },
    reward: {
      type: "frame",
      value: "doppler-karambit",
      name: "Doppler Karambit Frame 🔪",
      visualDescription: "Karambit shaklida, ranglar Doppler",
    },
    difficulty: "medium",
    category: "pomodoro",
    animation: "rotation",
  },
  {
    id: 10,
    title: "Ikki hafta",
    description: "14 kun ketma-ket",
    requirement: { type: "consecutive_days", value: 14 },
    reward: {
      type: "frame",
      value: "neon-edge",
      name: "Neon Edge Effect",
      visualDescription: "Neon rangli qirralar",
    },
    difficulty: "medium",
    category: "streak",
    animation: "pulse",
  },
  {
    id: 11,
    title: "Intizomli",
    description: "20 kun ichida 15 kun bajarish",
    requirement: { type: "completed_days", value: 15 },
    reward: {
      type: "badge",
      value: "shield",
      name: "Shield 🛡",
      visualDescription: "Shield icon avatar yonida",
    },
    difficulty: "medium",
    category: "daily",
    animation: "glow",
  },
  {
    id: 12,
    title: "100 pomidor",
    description: "100 🍅",
    requirement: { type: "pomodoro", value: 100 },
    reward: {
      type: "badge",
      value: "golden-tomato",
      name: "Golden Tomato Badge",
      visualDescription: "Oltin rang pomidor",
    },
    difficulty: "medium",
    category: "pomodoro",
    animation: "sparkle",
  },

  // Hard (13-20)
  {
    id: 13,
    title: "Uzoq yo'l",
    description: "21 kun streak",
    requirement: { type: "consecutive_days", value: 21 },
    reward: {
      type: "frame",
      value: "shadow-frame",
      name: "Shadow Frame",
      visualDescription: "Shadow effekt bilan qora ramka",
    },
    difficulty: "hard",
    category: "streak",
    animation: "pulse",
  },
  {
    id: 14,
    title: "Barqaror mashina",
    description: "30 kun ichida 25 kun",
    requirement: { type: "completed_days", value: 25 },
    reward: {
      type: "background",
      value: "animated-lines",
      name: "Animated Lines Background",
      visualDescription: "Animatsiyalangan chiziqlar fon",
    },
    difficulty: "hard",
    category: "daily",
    animation: "shimmer",
  },
  {
    id: 15,
    title: "Odatlar ustasi",
    description: "5 odatni 14 kun",
    requirement: { type: "habits", value: 5 },
    reward: {
      type: "badge",
      value: "crown",
      name: "Crown 👑",
      visualDescription: "Crown badge avatar tepasida",
    },
    difficulty: "hard",
    category: "habits",
    animation: "sparkle",
  },
  {
    id: 16,
    title: "200 pomidor",
    description: "200 🍅",
    requirement: { type: "pomodoro", value: 200 },
    reward: {
      type: "frame",
      value: "crimson-karambit",
      name: "Crimson Karambit Frame",
      visualDescription: "Red Doppler, metallic effect",
    },
    difficulty: "hard",
    category: "pomodoro",
    animation: "rotation",
  },
  {
    id: 17,
    title: "Intizom afsonasi",
    description: "30 kun streak",
    requirement: { type: "consecutive_days", value: 30 },
    reward: {
      type: "badge",
      value: "halo",
      name: "Animated Halo",
      visualDescription: "Profile glow: Animated halo",
    },
    difficulty: "hard",
    category: "streak",
    animation: "glow",
  },
  {
    id: 18,
    title: "To'xtamasdan",
    description: "45 kun ichida 40 kun",
    requirement: { type: "completed_days", value: 40 },
    reward: {
      type: "badge",
      value: "brain",
      name: "Brain 🧠",
      visualDescription: "Brain icon avatar yonida",
    },
    difficulty: "hard",
    category: "daily",
    animation: "pulse",
  },
  {
    id: 19,
    title: "Temir iroda",
    description: "60 kun streak",
    requirement: { type: "consecutive_days", value: 60 },
    reward: {
      type: "frame",
      value: "dark-doppler",
      name: "Dark Doppler Frame",
      visualDescription: "Qora Doppler effekt",
    },
    difficulty: "hard",
    category: "streak",
    animation: "slow-rotation",
  },
  {
    id: 20,
    title: "500 pomidor",
    description: "500 🍅",
    requirement: { type: "pomodoro", value: 500 },
    reward: {
      type: "frame",
      value: "mythic",
      name: "Mythic Frame",
      visualDescription: "Golden shimmer effekt",
    },
    difficulty: "hard",
    category: "pomodoro",
    animation: "shimmer",
  },

  // Very Hard / Expert (21-25)
  {
    id: 21,
    title: "Afsona",
    description: "90 kun streak",
    requirement: { type: "consecutive_days", value: 90 },
    reward: {
      type: "badge",
      value: "legendary",
      name: "Legendary Badge",
      visualDescription: "+300 XP va Legendary badge",
    },
    difficulty: "expert",
    category: "streak",
    animation: "sparkle",
  },
  {
    id: 22,
    title: "O'zgarmas",
    description: "120 kun ichida 110 kun",
    requirement: { type: "completed_days", value: 110 },
    reward: {
      type: "background",
      value: "elite-theme",
      name: "Elite Profile Theme",
      visualDescription: "Background color shift animatsiyasi",
    },
    difficulty: "expert",
    category: "daily",
    animation: "shimmer",
  },
  {
    id: 23,
    title: "1000 pomidor",
    description: "1000 🍅",
    requirement: { type: "pomodoro", value: 1000 },
    reward: {
      type: "frame",
      value: "ultimate-karambit",
      name: "Ultimate Karambit Frame",
      visualDescription: "Doppler + gold + spin effekt",
    },
    difficulty: "expert",
    category: "pomodoro",
    animation: "spin",
  },
  {
    id: 24,
    title: "Mukammallik",
    description: "150 kun streak",
    requirement: { type: "consecutive_days", value: 150 },
    reward: {
      type: "badge",
      value: "star",
      name: "Profile Star ⭐",
      visualDescription: "Star avatar yonida",
    },
    difficulty: "expert",
    category: "streak",
    animation: "sparkle",
  },
  {
    id: 25,
    title: "Tizim xo'jayini",
    description: "365 kun streak",
    requirement: { type: "consecutive_days", value: 365 },
    reward: {
      type: "frame",
      value: "immortal",
      name: "Immortal Frame",
      visualDescription: "Full profile glow - barcha foydalanuvchilar ko'radi",
    },
    difficulty: "expert",
    category: "streak",
    animation: "glow",
  },
]
