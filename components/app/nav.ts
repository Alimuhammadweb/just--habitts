import { BarChart3, CalendarDays, LayoutDashboard, LifeBuoy, ListChecks, MessageCircle, Settings, Swords, Target, Timer, Trophy, User, Users, type LucideIcon } from "lucide-react"

export type PageId =
  | "dashboard" | "habits" | "planner" | "tasks" | "pomodoro" | "statistics" | "leaderboard"
  | "challenges" | "friends" | "community" | "feedback" | "profile" | "settings"

export interface NavItem { id: PageId; label: string; icon: LucideIcon; group: "main" | "more" }

export const NAV: NavItem[] = [
  { id: "dashboard", label: "Bosh sahifa", icon: LayoutDashboard, group: "main" },
  { id: "habits", label: "Odatlar", icon: ListChecks, group: "main" },
  { id: "planner", label: "Haftalik reja", icon: CalendarDays, group: "main" },
  { id: "tasks", label: "Vazifalar", icon: Target, group: "main" },
  { id: "pomodoro", label: "Pomodoro", icon: Timer, group: "main" },
  { id: "statistics", label: "Statistika", icon: BarChart3, group: "main" },
  { id: "leaderboard", label: "Reyting", icon: Trophy, group: "main" },
  { id: "challenges", label: "Chelenglar", icon: Swords, group: "main" },
  { id: "friends", label: "Do'stlar", icon: Users, group: "more" },
  { id: "community", label: "Jamiyat", icon: MessageCircle, group: "more" },
  { id: "feedback", label: "Fikr-mulohaza", icon: LifeBuoy, group: "more" },
  { id: "profile", label: "Profil", icon: User, group: "more" },
  { id: "settings", label: "Sozlamalar", icon: Settings, group: "more" },
]

export const MOBILE_PRIMARY: PageId[] = ["dashboard", "habits", "planner", "leaderboard"]
export const isPageId = (v: string): v is PageId => NAV.some((n) => n.id === v)
