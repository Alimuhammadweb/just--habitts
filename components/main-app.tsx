"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import type { User, Habit, DayStatus } from "@/types/user"
import type { Language } from "@/types/language"
import { AppShell } from "@/components/app/app-shell"
import { isPageId, type PageId } from "@/components/app/nav"
import { DashboardPage } from "@/components/dashboard/dashboard-page"
import { HabitsPage } from "@/components/habits/habits-page"
import { PlannerPage } from "@/components/planner/planner-page"
import { StatisticsView } from "@/components/stats/statistics-view"
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view"
import { ChallengesView } from "@/components/challenges/challenges-view"
import { SettingsPage } from "@/components/settings/settings-page"
import { TasksPage } from "@/components/tasks-page"
import { PomodoroPage } from "@/components/pomodoro-page"
import { FriendsPage } from "@/components/friends-page"
import { CommunityPage } from "@/components/community-page"
import { FeedbackPage } from "@/components/feedback/feedback-page"
import { ProfilePage } from "@/components/profile-page"
import { HabitTemplatesModal } from "@/components/habit-templates-modal"
import { AddHabitModal } from "@/components/add-habit-modal"
import { PlannedHabitsModal } from "@/components/planned-habits-modal"
import { AchievementAnimation } from "@/components/achievement-animation"
import { calculateLevel } from "@/lib/xp-system"
import { authFetch } from "@/lib/api-client"
import { ApiError, completePomodoro, createHabit, removeHabit, setHabitStatus, syncHabits, updateProfile } from "@/lib/client-api"

interface MainAppProps {
  currentUser: User
  setCurrentUser: (user: User) => void
  onLogout: () => void
}

const errText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Noma'lum xato")

export function MainApp({ currentUser, setCurrentUser, onLogout }: MainAppProps) {
  const { toast } = useToast()
  const [page, setPage] = useState<PageId>("dashboard")
  const [plannerAutoOpen, setPlannerAutoOpen] = useState(false)
  const [language, setLanguage] = useState<Language>("uz")
  const [isDark, setIsDark] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showPlanned, setShowPlanned] = useState(false)
  const [hasNewPin, setHasNewPin] = useState(false)
  const [hasNewReply, setHasNewReply] = useState(false)
  const [anim, setAnim] = useState<"snow" | "confetti" | "sparkles" | "fireworks" | "stars" | null>(null)

  // Har doim eng so'nggi foydalanuvchini ishlatish uchun (async qayta chaqiruvlarda eskirgan closure bo'lmasligi uchun)
  const userRef = useRef(currentUser)
  userRef.current = currentUser
  const applyUser = useCallback((u: User) => setCurrentUser({ ...userRef.current, ...u }), [setCurrentUser])

  const habits = currentUser.habits || []
  const plannedHabits = currentUser.plannedHabits || []

  // ── Pomodoro taymeri (holati brauzerda; yakunlangan seans serverda yoziladi) ──
  const [pomRunning, setPomRunning] = useState(false)
  const [pomLeft, setPomLeft] = useState(25 * 60)
  const [pomDuration, setPomDuration] = useState(25)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Navigatsiya (URL hash bilan sinxron: #planner) ──
  const navigate = useCallback((p: PageId) => { setPage(p); if (location.hash !== `#${p}`) history.pushState(null, "", `#${p}`) }, [])
  useEffect(() => {
    const read = () => { const h = location.hash.slice(1); setPage(isPageId(h) ? h : "dashboard") }
    read(); window.addEventListener("hashchange", read); window.addEventListener("popstate", read)
    return () => { window.removeEventListener("hashchange", read); window.removeEventListener("popstate", read) }
  }, [])

  // ── Boshlang'ich: tema, til, taymer, serverdan sinxronlash ──
  useEffect(() => {
    const dark = localStorage.getItem("habit-theme") !== "light"
    setIsDark(dark); document.documentElement.classList.toggle("dark", dark)
    const lang = localStorage.getItem("habit-language") as Language | null
    if (lang && ["uz", "ru", "en"].includes(lang)) setLanguage(lang)
    try {
      const st = JSON.parse(localStorage.getItem(`timer_${currentUser.id}`) || "null")
      if (st) { setPomRunning(!!st.isRunning); setPomLeft(st.timeLeft); setPomDuration(st.duration || 25) }
    } catch { /* e'tiborsiz */ }
    // O'tgan kunlarni yopish, vaqt zonasi, davr XP - hammasi serverda (idempotent)
    if (currentUser.id !== 0) {
      syncHabits().then((r) => applyUser(r.user)).catch((e) => console.warn("[sync]", errText(e)))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rejalashtirilgan odatlarni faollashtirish ──
  useEffect(() => {
    const check = async () => {
      const now = Date.now()
      const due = (userRef.current.plannedHabits || []).filter((h) => h.scheduledStartTime && h.scheduledStartTime <= now)
      if (!due.length) return
      const remaining = (userRef.current.plannedHabits || []).filter((h) => !due.includes(h))
      try {
        for (const h of due) await createHabit({ ...h, scheduledStartTime: undefined })
        await updateProfile({ plannedHabits: remaining })
        const r = await syncHabits()
        applyUser({ ...r.user, plannedHabits: remaining })
        toast({ title: `${due.length} ta odat boshlandi` })
      } catch (e) { console.warn("[planned]", errText(e)) }
    }
    check(); const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [applyUser, toast])

  // ── Yangi mahkamlangan post belgisi ──
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/community/posts"); if (!res.ok) return
        const posts = await res.json(); if (!Array.isArray(posts)) return
        const pinned = posts.find((p: { isPinned?: boolean; id: number }) => p.isPinned)
        if (pinned && localStorage.getItem(`lastSeenPin_${currentUser.id}`) !== String(pinned.id)) setHasNewPin(true)
      } catch { /* e'tiborsiz */ }
    }
    check(); const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [currentUser.id])
  useEffect(() => { if (page === "community") setHasNewPin(false) }, [page])

  // ── Admindan yangi javob belgisi (faqat bazadagi foydalanuvchilar uchun) ──
  const checkReplies = useCallback(async () => {
    if (currentUser.id === 0) return
    try {
      const res = await authFetch("/api/feedback"); if (!res.ok) return
      const d = await res.json(); setHasNewReply((d?.unread ?? 0) > 0)
    } catch { /* e'tiborsiz */ }
  }, [currentUser.id])
  useEffect(() => { checkReplies(); const id = setInterval(checkReplies, 60_000); return () => clearInterval(id) }, [checkReplies])

  // ── Pomodoro ──
  const handleTimerComplete = useCallback(async () => {
    setPomRunning(false); setPomLeft(pomDuration * 60)
    localStorage.setItem(`timer_${userRef.current.id}`, JSON.stringify({ timeLeft: pomDuration * 60, isRunning: false, duration: pomDuration }))
    try { const r = await completePomodoro(); applyUser(r.user); toast({ title: "Pomodoro yakunlandi 🍅" }) }
    catch (e) { toast({ title: "Pomodoro saqlanmadi", description: errText(e), variant: "destructive" }) }
  }, [pomDuration, applyUser, toast])

  useEffect(() => {
    if (!(pomRunning && pomLeft > 0)) { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } return }
    timerRef.current = setInterval(() => {
      setPomLeft((prev) => {
        const next = prev - 1
        localStorage.setItem(`timer_${userRef.current.id}`, JSON.stringify({ timeLeft: next, isRunning: next > 0, duration: pomDuration }))
        if (next <= 0) queueMicrotask(handleTimerComplete)
        return Math.max(0, next)
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pomRunning, pomDuration, handleTimerComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPomodoroChange = (isRunning: boolean, timeLeft: number, duration?: number) => {
    setPomRunning(isRunning); setPomLeft(timeLeft); if (duration !== undefined) setPomDuration(duration)
    localStorage.setItem(`timer_${currentUser.id}`, JSON.stringify({ timeLeft, isRunning, duration: duration || pomDuration }))
  }
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

  // ── Odatlar (barcha o'zgarishlar serverga yuboriladi; mijoz XPni hisoblamaydi) ──
  const addHabit = async (habit: Habit) => {
    try { const r = await createHabit(habit); applyUser(r.user); toast({ title: "Odat qo'shildi", description: habit.name }) }
    catch (e) { toast({ title: "Odat qo'shilmadi", description: errText(e), variant: "destructive" }) }
  }
  const scheduleHabit = async (habit: Habit) => {
    const updated = [...plannedHabits, { ...habit, days: {}, dayLocks: {}, missReasons: {} }]
    try { await updateProfile({ plannedHabits: updated }); applyUser({ ...currentUser, plannedHabits: updated }); toast({ title: "Odat rejalashtirildi", description: habit.name }) }
    catch (e) { toast({ title: "Rejalashtirib bo'lmadi", description: errText(e), variant: "destructive" }) }
  }
  const deletePlanned = async (id: number) => {
    const updated = plannedHabits.filter((h) => h.id !== id)
    try { await updateProfile({ plannedHabits: updated }); applyUser({ ...currentUser, plannedHabits: updated }) }
    catch (e) { toast({ title: "O'chirib bo'lmadi", description: errText(e), variant: "destructive" }) }
  }
  const deleteHabit = async (id: number) => {
    try { await removeHabit(id); applyUser({ ...currentUser, habits: habits.filter((h) => h.id !== id) }); toast({ title: "Odat o'chirildi" }) }
    catch (e) { toast({ title: "O'chirib bo'lmadi", description: errText(e), variant: "destructive" }) }
  }
  const updateDay = async (habitId: number, dayIndex: number, status: DayStatus | "none", missReason?: string) => {
    if (status === "frozen") return
    try {
      const r = await setHabitStatus(habitId, dayIndex, status, missReason)
      applyUser(r.user)
      if (!r.unchanged && r.xpChange !== 0) toast({ title: `${r.xpChange > 0 ? "+" : ""}${r.xpChange} XP` })
      if (r.newTasks.length) { const a = ["sparkles", "confetti", "fireworks", "stars"] as const; setAnim(a[Math.floor(Math.random() * a.length)]); setTimeout(() => setAnim(null), 5000) }
    } catch (e) { toast({ title: "Belgilab bo'lmadi", description: errText(e), variant: "destructive" }) }
  }

  const handleUpdateProfile = async (updates: Partial<User>) => {
    try { await updateProfile(updates); applyUser({ ...currentUser, ...updates }); toast({ title: "Profil yangilandi" }) }
    catch (e) { toast({ title: "Profilni saqlab bo'lmadi", description: errText(e), variant: "destructive" }) }
  }
  const changeTimezone = async (tz: string) => { await updateProfile({ timezone: tz }); applyUser({ ...currentUser, timezone: tz }) }

  const toggleTheme = () => { const n = !isDark; setIsDark(n); document.documentElement.classList.toggle("dark", n); localStorage.setItem("habit-theme", n ? "dark" : "light") }
  const changeLanguage = (l: Language) => { setLanguage(l); localStorage.setItem("habit-language", l) }

  const displayName = currentUser.firstName && currentUser.lastName ? `${currentUser.firstName} ${currentUser.lastName}` : currentUser.name
  const back = () => navigate("dashboard")

  const content = (() => {
    switch (page) {
      case "habits": return <HabitsPage habits={habits} plannedCount={plannedHabits.length} language={language} onAdd={() => setShowAdd(true)} onTemplates={() => setShowTemplates(true)} onPlanned={() => setShowPlanned(true)} onDelete={deleteHabit} onUpdateDay={updateDay} />
      case "planner": return <PlannerPage timezone={currentUser.timezone} autoOpen={plannerAutoOpen} />
      case "tasks": return <TasksPage currentUser={currentUser} onBack={back} language={language} />
      case "pomodoro": return <PomodoroPage language={language} onBack={back} userId={currentUser.id} isTimerRunning={pomRunning} timerTimeLeft={pomLeft} timerDuration={pomDuration} onTimerStateChange={onPomodoroChange} pomodoroData={currentUser.pomodoroData} />
      case "statistics": return <StatisticsView user={currentUser} />
      case "leaderboard": return <LeaderboardView />
      case "challenges": return <ChallengesView user={currentUser} onUserChange={applyUser} />
      case "friends": return <FriendsPage currentUser={currentUser} language={language} onBack={back} onUpdateUser={applyUser} />
      case "community": return <CommunityPage language={language} currentUser={currentUser} onBack={back} />
      case "feedback": return <FeedbackPage onChanged={checkReplies} />
      case "profile": return <ProfilePage onClose={back} currentUser={currentUser} onUpdateProfile={handleUpdateProfile} language={language} />
      case "settings": return <SettingsPage user={currentUser} language={language} isDark={isDark} onLanguage={changeLanguage} onToggleTheme={toggleTheme} onTimezone={changeTimezone} onLogout={onLogout} />
      default: return <DashboardPage user={currentUser} onNavigate={navigate} onAddHabit={() => setShowAdd(true)} onAddTask={() => { setPlannerAutoOpen(true); navigate("planner") }} />
    }
  })()

  return (
    <>
      {anim && <AchievementAnimation type={anim} />}
      <AppShell page={page} onNavigate={(p) => { if (p !== "planner") setPlannerAutoOpen(false); navigate(p) }} isDark={isDark} onToggleTheme={toggleTheme} onLogout={onLogout} onAdmin={() => location.assign("/admin")}
        user={{ name: displayName, level: calculateLevel(currentUser.xpData?.totalXP || 0), avatarUrl: currentUser.avatarUrl, isAdmin: !!currentUser.isAdmin }}
        pomodoro={{ running: pomRunning, label: fmt(pomLeft) }} badges={{ community: hasNewPin, feedback: hasNewReply }}>
        {content}
      </AppShell>
      {showTemplates && <HabitTemplatesModal language={language} onClose={() => setShowTemplates(false)} onAdd={(h) => { addHabit(h); setShowTemplates(false) }} />}
      {showAdd && <AddHabitModal onClose={() => setShowAdd(false)} onAdd={addHabit} onSchedule={scheduleHabit} language={language} />}
      {showPlanned && <PlannedHabitsModal plannedHabits={plannedHabits} onClose={() => setShowPlanned(false)} onDelete={deletePlanned} language={language} />}
    </>
  )
}
