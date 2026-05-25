"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import type { User, Habit, DayStatus } from "@/types/user"
import { HabitCard } from "@/components/habit-card"
import { StreakShareCard } from "@/components/streak-share-card"
import { HabitTemplatesModal } from "@/components/habit-templates-modal"
import { FriendsPage } from "@/components/friends-page"
import { ChallengesPage } from "@/components/challenges-page"
import { AddHabitModal } from "@/components/add-habit-modal"
import { ProfilePage } from "@/components/profile-page"
import { PlannedHabitsModal } from "@/components/planned-habits-modal"
import { PomodoroPage } from "@/components/pomodoro-page"
import { LeaderboardPage } from "@/components/leaderboard-page"
import { StatisticsPage } from "@/components/statistics-page"
import {
  updateHabitStatus, lockOldDays, calculateRanks, calculateLevel,
  recalculatePeriodicXP, earnStreakFreeze, getLevelBadge, getRankEmoji,
} from "@/lib/xp-system"
import { translations } from "@/lib/translations"
import type { Language } from "@/types/language"
import { InfoModal } from "@/components/info-modal"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CommunityPage } from "@/components/community-page"
import { AchievementAnimation } from "@/components/achievement-animation"
import {
  saveUserToMongoDB, addHabitToMongoDB, deleteHabitFromMongoDB,
  savePomodoroToMongoDB, fetchAllUsersFromMongoDB,
} from "@/lib/db-sync"
import { checkAndUnlockTasks } from "@/lib/task-unlock"
import {
  Calendar, Sun, Moon, LogOut, Shield, Target, Plus, Clock, Trophy,
  TrendingUp, Globe, MessageCircle, Users, Flame, Star, BarChart3,
  BookOpen, Zap, ChevronRight, Sword,
} from "lucide-react"

interface MainAppProps {
  currentUser: User
  setCurrentUser: (user: User) => void
  onAdminClick: () => void
  onLogout: () => void
}

type ActivePage =
  | "dashboard" | "leaderboard" | "pomodoro" | "statistics"
  | "community" | "profile" | "friends" | "challenges"

export function MainApp({ currentUser, setCurrentUser, onAdminClick, onLogout }: MainAppProps) {
  const { toast } = useToast()

  // ─── State ───────────────────────────────────────────────────────────────
  const [habits, setHabits] = useState<Habit[]>(currentUser.habits || [])
  const [plannedHabits, setPlannedHabits] = useState<Habit[]>([])
  const [activePage, setActivePage] = useState<ActivePage>("dashboard")
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showPlannedModal, setShowPlannedModal] = useState(false)
  const [showShareCard, setShowShareCard] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [hasNewPinnedPost, setHasNewPinnedPost] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [language, setLanguage] = useState<Language>("uz")
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [achievementAnimation, setAchievementAnimation] = useState<
    "snow" | "confetti" | "sparkles" | "fireworks" | "stars" | null
  >(null)

  // Pomodoro timer state
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60)
  const [pomodoroDuration, setPomodoroDuration] = useState(25)
  const [timerJustCompleted, setTimerJustCompleted] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const pendingRef = useRef(false)
  const t = translations[language]

  // ─── Current streak calculation ──────────────────────────────────────────
  const getCurrentStreak = useCallback((): number => {
    if (habits.length === 0) return 0
    // Use the first active habit for streak display
    const activeHabit = habits[0]
    if (!activeHabit?.days) return 0
    const sorted = Object.keys(activeHabit.days).map(Number).sort((a, b) => b - a)
    let streak = 0
    for (const idx of sorted) {
      const s = activeHabit.days[idx]
      if (s === "completed" || s === "frozen") streak++
      else if (s === "missed") break
    }
    return streak
  }, [habits])

  // ─── Stats ───────────────────────────────────────────────────────────────
  const stats = {
    totalHabits: habits.length,
    completedDays: habits.reduce(
      (s, h) => s + Object.values(h.days).filter(d => d === "completed").length, 0),
    partialDays: habits.reduce(
      (s, h) => s + Object.values(h.days).filter(d => d === "partial").length, 0),
    missedDays: habits.reduce(
      (s, h) => s + Object.values(h.days).filter(d => d === "missed").length, 0),
    frozenDays: habits.reduce(
      (s, h) => s + Object.values(h.days).filter(d => d === "frozen").length, 0),
  }

  const completionRate = (stats.completedDays + stats.partialDays + stats.frozenDays) > 0
    ? Math.round((stats.completedDays / Math.max(1, stats.completedDays + stats.missedDays + stats.partialDays)) * 100)
    : 0

  const todayHabits = habits.filter(h => {
    const today = new Date()
    const start = new Date(h.startDate.timestamp)
    const dayDiff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return dayDiff >= 0 && dayDiff < h.duration
  })

  const todayDone = todayHabits.filter(h => {
    const today = new Date()
    const start = new Date(h.startDate.timestamp)
    const dayDiff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return h.days[dayDiff] === "completed" || h.days[dayDiff] === "frozen"
  }).length

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Theme
    const savedTheme = localStorage.getItem("habit-theme")
    if (savedTheme === "light") {
      document.documentElement.classList.remove("dark")
      setIsDarkMode(false)
    } else {
      document.documentElement.classList.add("dark")
      setIsDarkMode(true)
    }

    // Language
    const savedLang = localStorage.getItem("habit-language") as Language
    if (savedLang && ["uz","ru","en"].includes(savedLang)) setLanguage(savedLang)

    // Planned habits - faqat MongoDB dan kelgan ma'lumotlar
    if (currentUser.plannedHabits?.length) {
      setPlannedHabits(currentUser.plannedHabits)
    }

    // Lock old days + recalc XP
    const locked = lockOldDays(currentUser)
    const recalced = recalculatePeriodicXP(locked)
    const { user: withFreeze, earned } = earnStreakFreeze(recalced)
    if (earned) toast({ title: "Yangi muzlatish olindi! 🧊" })

    const changed =
      JSON.stringify(locked.habits) !== JSON.stringify(currentUser.habits) ||
      recalced.xpData.weeklyXP !== currentUser.xpData.weeklyXP ||
      withFreeze.streakFreezes !== currentUser.streakFreezes
    if (changed) {
      saveUserToMongoDB(withFreeze)
      setCurrentUser(withFreeze)
      setHabits(withFreeze.habits)
    }

    // Restore pomodoro timer
    const storedTimer = localStorage.getItem(`timer_${currentUser.id}`)
    if (storedTimer) {
      const { timeLeft, isRunning, duration } = JSON.parse(storedTimer)
      setPomodoroRunning(isRunning)
      setPomodoroTimeLeft(timeLeft)
      setPomodoroDuration(duration || 25)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load all users ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchAllUsersFromMongoDB()
      .then(users => { if (users.length > 0) setAllUsers(users) })
      .catch(err => console.error("[MainApp] Foydalanuvchilarni yuklashda xato:", err))
  }, [currentUser.xpData.totalXP])

  // ─── Check planned habits activation ─────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const now = Date.now()
      const toActivate = plannedHabits.filter(h => h.scheduledStartTime && h.scheduledStartTime <= now)
      const remaining = plannedHabits.filter(h => !h.scheduledStartTime || h.scheduledStartTime > now)
      if (toActivate.length > 0) {
        const updated = [...habits, ...toActivate.map(h => ({ ...h, scheduledStartTime: undefined }))]
        saveHabits(updated)
        setPlannedHabits(remaining)
        saveUserToMongoDB({ ...currentUser, plannedHabits: remaining }).catch(console.error)
        setCurrentUser({ ...currentUser, plannedHabits: remaining })
        toast({ title: `${toActivate.length} ta odat boshlandi!` })
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [plannedHabits]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Check new pinned post ─────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/community/posts")
        if (!res.ok) return
        const posts = await res.json()
        if (!Array.isArray(posts)) return
        const pinned = posts.find((p: {isPinned?: boolean; id: number}) => p.isPinned)
        if (pinned) {
          const seen = localStorage.getItem(`lastSeenPin_${currentUser.id}`)
          if (seen !== String(pinned.id)) setHasNewPinnedPost(true)
        }
      } catch {}
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [currentUser.id])

  // ─── Pomodoro timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (pomodoroRunning && pomodoroTimeLeft > 0) {
      timerRef.current = setInterval(() => {
        setPomodoroTimeLeft(prev => {
          const next = prev - 1
          localStorage.setItem(`timer_${currentUser.id}`, JSON.stringify({
            timeLeft: next, isRunning: true, duration: pomodoroDuration,
          }))
          if (next === 0) handleTimerComplete()
          return next
        })
      }, 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pomodoroRunning, pomodoroDuration, currentUser.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (timerJustCompleted) {
      toast({ title: t.completed, description: t.tomatoCompleted })
      setTimerJustCompleted(false)
    }
  }, [timerJustCompleted]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const toggleTheme = () => {
    const next = !isDarkMode
    setIsDarkMode(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("habit-theme", next ? "dark" : "light")
  }

  const changeLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem("habit-language", lang)
  }

  const saveHabits = (updated: Habit[]) => {
    setHabits(updated)
    const updatedUser = { ...currentUser, habits: updated }
    // Faqat MongoDB ga saqlaymiz - localStorage EMAS
    saveUserToMongoDB(updatedUser).catch(console.error)
    setCurrentUser(updatedUser)
  }

  const addHabit = (habit: Habit) => {
    const h = { ...habit, dayLocks: {}, missReasons: {} }
    const updated = [...habits, h]
    saveHabits(updated)
    addHabitToMongoDB(currentUser.id, h)
    toast({ title: t.habitAdded, description: `${habit.name} ${t.habitAddedSuccess}` })
  }

  const scheduleHabit = (habit: Habit) => {
    const h = { ...habit, dayLocks: {}, missReasons: {} }
    const updated = [...plannedHabits, h]
    setPlannedHabits(updated)
    saveUserToMongoDB({ ...currentUser, plannedHabits: updated }).catch(console.error)
    setCurrentUser({ ...currentUser, plannedHabits: updated })
    const d = new Date(habit.scheduledStartTime!)
    toast({ title: t.habitScheduled, description: `${habit.name} — ${d.toLocaleDateString()} ${d.toLocaleTimeString()}` })
  }

  const deleteHabit = (id: number) => {
    saveHabits(habits.filter(h => h.id !== id))
    deleteHabitFromMongoDB(currentUser.id, id)
    toast({ title: t.habitDeleted, description: t.habitDeletedSuccess })
  }

  const deletePlannedHabit = (id: number) => {
    const updated = plannedHabits.filter(h => h.id !== id)
    setPlannedHabits(updated)
    saveUserToMongoDB({ ...currentUser, plannedHabits: updated }).catch(console.error)
    setCurrentUser({ ...currentUser, plannedHabits: updated })
    toast({ title: t.habitDeleted })
  }

  const updateHabitDay = async (
    habitId: number, dayIndex: number,
    status: DayStatus | "none", missReason?: string,
  ) => {
    pendingRef.current = true
    const result = updateHabitStatus(currentUser, habitId, dayIndex, status as DayStatus, missReason)
    if (!result.success) {
      pendingRef.current = false
      toast({ title: result.message, variant: "destructive" })
      return
    }
    if (result.updatedUser) {
      const withTasks = checkAndUnlockTasks(result.updatedUser)
      const newCompleted = (withTasks.completedTasks || []).filter(
        id => !(currentUser.completedTasks || []).includes(id)
      )
      if (newCompleted.length > 0) {
        const anims = ["sparkles","confetti","fireworks","snow","stars"] as const
        setAchievementAnimation(anims[Math.floor(Math.random() * anims.length)])
        setTimeout(() => setAchievementAnimation(null), 5000)
      }
      setCurrentUser(withTasks)
      setHabits(withTasks.habits)

      if (result.xpChange && result.xpChange !== 0) {
        toast({
          title: result.message,
          description: status === "completed" ? t.habitCompleted
            : status === "partial" ? t.habitPartialCompleted
            : undefined,
        })
      }

      // MongoDB ga saqlash va rank yangilash
      Promise.resolve().then(async () => {
        try {
          await saveUserToMongoDB(withTasks)
          const dbUsers = await fetchAllUsersFromMongoDB()
          if (dbUsers.length > 0) {
            const bIdx = dbUsers.findIndex(u => u.id === withTasks.id)
            if (bIdx === -1) dbUsers.push(withTasks)
            else dbUsers[bIdx] = withTasks
            const ranked = calculateRanks(dbUsers)
            await Promise.all(ranked.map(u => saveUserToMongoDB(u)))
            const me = ranked.find(u => u.id === currentUser.id)
            if (me) { setCurrentUser(me); setHabits(me.habits); setAllUsers(ranked) }
          }
        } catch (e) {
          console.error("[MainApp] Rank sync xato:", e)
        }
        pendingRef.current = false
      })
    }
  }

  const handleTimerComplete = () => {
    setPomodoroRunning(false)
    const today = new Date().toISOString().split("T")[0]
    const session = { id: Date.now(), date: today, count: 1 }
    savePomodoroToMongoDB(currentUser.id, session)
    const sessions = currentUser.pomodoroData?.sessions || []
    const idx = sessions.findIndex(s => s.date === today)
    const updatedSessions = idx >= 0
      ? sessions.map(s => s.date === today ? { ...s, count: s.count + 1 } : s)
      : [...sessions, session]
    const updatedUser = {
      ...currentUser,
      pomodoroData: { sessions: updatedSessions, totalPomodoros: (currentUser.pomodoroData?.totalPomodoros || 0) + 1 },
    }
    saveUserToMongoDB(updatedUser)
    setCurrentUser(updatedUser)
    setPomodoroTimeLeft(pomodoroDuration * 60)
    localStorage.setItem(`timer_${currentUser.id}`, JSON.stringify({
      timeLeft: pomodoroDuration * 60, isRunning: false, duration: pomodoroDuration,
    }))
    setTimerJustCompleted(true)
  }

  const handlePomodoroChange = (isRunning: boolean, timeLeft: number, duration?: number) => {
    setPomodoroRunning(isRunning)
    setPomodoroTimeLeft(timeLeft)
    if (duration !== undefined) setPomodoroDuration(duration)
    localStorage.setItem(`timer_${currentUser.id}`, JSON.stringify({
      timeLeft, isRunning, duration: duration || pomodoroDuration,
    }))
  }

  const handleUpdateProfile = async (updates: Partial<User>) => {
    // id ni majburiy saqlash — updates da bo'lmasa ham currentUser dan olamiz
    const merged: User = { ...currentUser, ...updates, id: currentUser.id }
    if (!merged.id) {
      console.error("[Profile] Cannot update: user has no ID", { currentUser, updates })
      toast({ title: "Xato", description: "Foydalanuvchi ID topilmadi. Qayta kirish kerak." })
      return
    }
    const updated = checkAndUnlockTasks(merged)
    setCurrentUser(updated)
    // Faqat MongoDB ga saqlaymiz
    await saveUserToMongoDB(updated)
    toast({ title: language === "uz" ? "Profil yangilandi ✓" : language === "ru" ? "Профиль обновлён ✓" : "Profile Updated ✓" })
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`

  const level = calculateLevel(currentUser.xpData?.totalXP || 0)
  const levelBadge = getLevelBadge(level)
  const displayName = currentUser.firstName && currentUser.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser.name
  const initials = displayName.split(" ").map(w => w[0]).join("").toUpperCase().substring(0, 2)
  const currentStreak = getCurrentStreak()

  // ─── Page routing ─────────────────────────────────────────────────────────
  if (activePage === "leaderboard") {
    return <LeaderboardPage language={language} onBack={() => setActivePage("dashboard")} currentUserId={currentUser.id} allUsers={allUsers} />
  }
  if (activePage === "pomodoro") {
    return (
      <PomodoroPage
        language={language} onBack={() => setActivePage("dashboard")}
        userId={currentUser.id} isTimerRunning={pomodoroRunning}
        timerTimeLeft={pomodoroTimeLeft} timerDuration={pomodoroDuration}
        onTimerStateChange={handlePomodoroChange} pomodoroData={currentUser.pomodoroData}
      />
    )
  }
  if (activePage === "statistics") {
    return <StatisticsPage onBack={() => setActivePage("dashboard")} language={language} habits={habits} currentUser={currentUser} />
  }
  if (activePage === "community") {
    return <CommunityPage language={language} currentUser={currentUser} onBack={() => setActivePage("dashboard")} />
  }
  if (activePage === "friends") {
    return <FriendsPage currentUser={currentUser} language={language} onBack={() => setActivePage("dashboard")} onUpdateUser={setCurrentUser} />
  }
  if (activePage === "challenges") {
    return <ChallengesPage currentUser={currentUser} language={language} onBack={() => setActivePage("dashboard")} onUpdateUser={setCurrentUser} />
  }
  if (activePage === "profile") {
    return (
      <ProfilePage
        onClose={() => setActivePage("dashboard")}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
        language={language}
      />
    )
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {achievementAnimation && <AchievementAnimation type={achievementAnimation} />}

      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Left: Avatar + Name */}
          <button onClick={() => setActivePage("profile")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center overflow-hidden border-2 border-primary/50">
                {currentUser.avatarUrl?.startsWith("http") ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={currentUser.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-white">{initials}</span>
                )}
              </div>
              {/* Online dot */}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold leading-none">{displayName.split(" ")[0]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{levelBadge} Lv.{level}</p>
            </div>
          </button>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            {pomodoroRunning && (
              <button
                onClick={() => setActivePage("pomodoro")}
                className="flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2.5 py-1 text-xs font-mono mr-1 animate-pulse"
              >
                🍅 {formatTime(pomodoroTimeLeft)}
              </button>
            )}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {currentUser.isAdmin && (
              <Button variant="ghost" size="icon" onClick={onAdminClick} className="h-8 w-8">
                <Shield className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Globe className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage("uz")}>🇺🇿 O'zbek</DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage("ru")}>🇷🇺 Русский</DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage("en")}>🇬🇧 English</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={onLogout} className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">

        {/* ── Hero Card: XP + Streak ── */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-5 text-white shadow-xl">
          {/* Background dots */}
          <div className="absolute inset-0 opacity-10">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="absolute w-1.5 h-1.5 bg-white rounded-full"
                style={{ left: `${(i * 17) % 100}%`, top: `${(i * 23) % 100}%` }} />
            ))}
          </div>

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-blue-200 text-xs font-medium mb-1">
                {language === "uz" ? "Bugungi holat" : language === "ru" ? "Сегодня" : "Today's status"}
              </p>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-black">{todayDone}</span>
                <span className="text-blue-300 text-sm">/ {todayHabits.length}</span>
                <span className="text-blue-200 text-xs">
                  {language === "uz" ? "bajarildi" : language === "ru" ? "выполнено" : "done"}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-40 h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${todayHabits.length > 0 ? (todayDone / todayHabits.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Streak */}
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end mb-1">
                <Flame className="w-5 h-5 text-orange-300" />
                <span className="text-3xl font-black">{currentStreak}</span>
              </div>
              <p className="text-blue-200 text-xs">
                {language === "uz" ? "kunlik seriya" : language === "ru" ? "дней подряд" : "day streak"}
              </p>
              {/* Freeze indicators */}
              <div className="flex gap-0.5 mt-2 justify-end">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={`text-sm ${i < (currentUser.streakFreezes || 0) ? "opacity-100" : "opacity-25"}`}>🧊</span>
                ))}
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div className="relative mt-4 pt-3 border-t border-white/20">
            <div className="flex items-center justify-between text-xs text-blue-200 mb-1.5">
              <span>{currentUser.xpData?.totalXP || 0} XP</span>
              <span>Lv.{level} {levelBadge}</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-300 to-yellow-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, ((currentUser.xpData?.totalXP || 0) % 100))}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Quick Stats Row ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: language === "uz" ? "Odat" : language === "ru" ? "Привычки" : "Habits", value: stats.totalHabits, color: "text-blue-400", icon: <BookOpen className="w-4 h-4" /> },
            { label: language === "uz" ? "Bajarildi" : language === "ru" ? "Готово" : "Done", value: stats.completedDays, color: "text-green-400", icon: <Star className="w-4 h-4" /> },
            { label: language === "uz" ? "Qisman" : language === "ru" ? "Частично" : "Partial", value: stats.partialDays, color: "text-yellow-400", icon: <Zap className="w-4 h-4" /> },
            { label: language === "uz" ? "O'tkazildi" : language === "ru" ? "Пропущено" : "Missed", value: stats.missedDays, color: "text-red-400", icon: <Target className="w-4 h-4" /> },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-2.5 text-center">
              <div className={`${s.color} flex justify-center mb-1`}>{s.icon}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActivePage("challenges")}
            className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all group"
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">
                {language === "uz" ? "Chelenglar" : language === "ru" ? "Челленджи" : "Challenges"}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={() => setActivePage("statistics")}
            className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all group"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-300">
                {language === "uz" ? "Statistika" : language === "ru" ? "Статистика" : "Statistics"}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-green-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={() => setActivePage("pomodoro")}
            className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all group"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-300">
                {language === "uz" ? "Pomodoro" : "Pomodoro"}
                {pomodoroRunning && <span className="ml-1 text-xs">• {formatTime(pomodoroTimeLeft)}</span>}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-red-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={() => setShowShareCard(true)}
            className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all group"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">
                {language === "uz" ? "Ulashish" : language === "ru" ? "Поделиться" : "Share"}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* ── Habits Section Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">
              {language === "uz" ? "Odatlar" : language === "ru" ? "Привычки" : "Habits"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {habits.length > 0
                ? `${habits.length} ${language === "uz" ? "ta faol" : language === "ru" ? "активных" : "active"}`
                : language === "uz" ? "Hali odat yo'q" : language === "ru" ? "Нет привычек" : "No habits yet"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)} className="h-8 text-xs gap-1">
              📋 {language === "uz" ? "Shablon" : language === "ru" ? "Шаблон" : "Template"}
            </Button>
            <Button size="sm" onClick={() => setShowAddModal(true)} className="h-8 text-xs gap-1 bg-primary">
              <Plus className="w-3.5 h-3.5" />
              {language === "uz" ? "Qo'shish" : language === "ru" ? "Добавить" : "Add"}
            </Button>
          </div>
        </div>

        {/* Planned habits badge */}
        {plannedHabits.length > 0 && (
          <button
            onClick={() => setShowPlannedModal(true)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
          >
            <div className="flex items-center gap-2 text-orange-300">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">
                {plannedHabits.length} {language === "uz" ? "ta rejalashtirilgan odat" : language === "ru" ? "запланировано" : "planned habits"}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-orange-400" />
          </button>
        )}

        {/* ── Habits List ── */}
        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">
              {language === "uz" ? "Hali odat yo'q" : language === "ru" ? "Нет привычек" : "No habits yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {language === "uz"
                ? "Birinchi odatingizni qo'shing yoki tayyor shablonlardan tanlang"
                : language === "ru"
                  ? "Добавьте первую привычку или выберите из готовых шаблонов"
                  : "Add your first habit or choose from ready-made templates"}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowTemplates(true)} className="gap-1">
                📋 {language === "uz" ? "Shablonlar" : language === "ru" ? "Шаблоны" : "Templates"}
              </Button>
              <Button onClick={() => setShowAddModal(true)} className="gap-1">
                <Plus className="w-4 h-4" />
                {language === "uz" ? "Qo'shish" : language === "ru" ? "Добавить" : "Add"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {habits.map(habit => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onDelete={deleteHabit}
                onUpdateDay={updateHabitDay}
                language={language}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border">
        <div className="flex items-center justify-around px-2 h-16 max-w-2xl mx-auto">
          {[
            { page: "dashboard" as ActivePage, icon: <BookOpen className="w-5 h-5" />, label: language === "uz" ? "Bosh" : language === "ru" ? "Главная" : "Home" },
            { page: "leaderboard" as ActivePage, icon: <Trophy className="w-5 h-5" />, label: language === "uz" ? "Reyting" : language === "ru" ? "Рейтинг" : "Rank" },
            { page: "community" as ActivePage, icon: <MessageCircle className="w-5 h-5" />, label: "Community", badge: hasNewPinnedPost },
            { page: "challenges" as ActivePage, icon: <Sword className="w-5 h-5" />, label: language === "uz" ? "Cheleng" : language === "ru" ? "Челлендж" : "Challenge" },
            { page: "profile" as ActivePage, icon: <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">{initials[0]}</div>, label: language === "uz" ? "Profil" : language === "ru" ? "Профиль" : "Profile" },
          ].map(item => (
            <button
              key={item.page}
              onClick={() => setActivePage(item.page)}
              className={`relative flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
                activePage === item.page
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {activePage === item.page && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-1 bg-primary rounded-full" />
              )}
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.badge && (
                <span className="absolute top-0 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Modals ── */}
      {showTemplates && (
        <HabitTemplatesModal language={language} onClose={() => setShowTemplates(false)} onAdd={h => { addHabit(h); setShowTemplates(false) }} />
      )}
      {showShareCard && (
        <StreakShareCard user={currentUser} language={language} onClose={() => setShowShareCard(false)} />
      )}
      {showAddModal && (
        <AddHabitModal onClose={() => setShowAddModal(false)} onAdd={addHabit} onSchedule={scheduleHabit} language={language} />
      )}
      {showPlannedModal && (
        <PlannedHabitsModal plannedHabits={plannedHabits} onClose={() => setShowPlannedModal(false)} onDelete={deletePlannedHabit} language={language} />
      )}
      {showRulesModal && (
        <InfoModal title={t.rulesContent.title} onClose={() => setShowRulesModal(false)}>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">{t.rulesContent.intro}</p>
            <p>{t.rulesContent.xpRewards.completed}</p>
            <p>{t.rulesContent.xpRewards.partial}</p>
            <p>{t.rulesContent.xpRewards.missed}</p>
          </div>
        </InfoModal>
      )}

      {/* Footer */}
      <div className="pb-16">
        <div className="text-center py-4 text-xs text-muted-foreground">
          <p>Bu sayt Mr John boshchiligida Lord Team tomonidan yasaldi</p>
          <div className="flex justify-center gap-4 mt-1">
            <a href="https://t.me/webdeveloper_4o4" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">@webdeveloper_4o4</a>
            <a href="https://t.me/just_mind5" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">Asosiy kanal</a>
          </div>
        </div>
      </div>
    </div>
  )
}
