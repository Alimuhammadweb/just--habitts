"use client"

import { useState, useEffect } from "react"
import { AuthPage } from "@/components/auth-page"
import { MainApp } from "@/components/main-app"
import { AdminPanel } from "@/components/admin-panel"
import type { User } from "@/types/user"

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // sessionStorage - faqat browser tab ochiq turguncha, localStorage EMAS
    try {
      const sessionUser = sessionStorage.getItem("sessionUser")
      if (sessionUser) {
        const user = migrateUserData(JSON.parse(sessionUser))
        setCurrentUser(user)
      }
    } catch {
      sessionStorage.removeItem("sessionUser")
    }
    setIsLoading(false)
  }, [])

  const handleSetUser = (user: User) => {
    setCurrentUser(user)
    sessionStorage.setItem("sessionUser", JSON.stringify(user))
    // MongoDB ga ham yangilash
    fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    }).catch(console.error)
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setIsAdmin(false)
    sessionStorage.removeItem("sessionUser")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Just Habits yuklanmoqda...</p>
      </div>
    )
  }

  if (isAdmin && currentUser) {
    return <AdminPanel currentUser={currentUser} onBack={() => setIsAdmin(false)} onLogout={handleLogout} />
  }

  if (currentUser) {
    return (
      <MainApp
        currentUser={currentUser}
        setCurrentUser={handleSetUser}
        onAdminClick={() => setIsAdmin(true)}
        onLogout={handleLogout}
      />
    )
  }

  return <AuthPage onLogin={(user) => handleSetUser(migrateUserData(user))} />
}

function migrateUserData(user: User): User {
  const u = { ...user }
  if (!u.xpData) u.xpData = { totalXP: 0, level: 1, rank: null, weeklyXP: 0, monthlyXP: 0, xpHistory: [], currentXP: 0, lastUpdated: Date.now() }
  if (!u.pomodoroData) u.pomodoroData = { sessions: [], totalPomodoros: 0 }
  if (u.publicProfile === undefined) u.publicProfile = false
  if (!u.completedTasks) u.completedTasks = []
  if (!u.unlockedAvatars) u.unlockedAvatars = []
  if (!u.unlockedThemes) u.unlockedThemes = []
  if (!u.unlockedBadges) u.unlockedBadges = []
  if (!u.unlockedBorders) u.unlockedBorders = []
  if (!u.unlockedFrames) u.unlockedFrames = []
  if (!u.unlockedBackgrounds) u.unlockedBackgrounds = []
  if (u.streakFreezes === undefined) u.streakFreezes = 1
  if (!u.totalFreezesUsed) u.totalFreezesUsed = 0
  if (!u.friends) u.friends = []
  if (!u.friendRequests) u.friendRequests = []
  if (!u.sentRequests) u.sentRequests = []
  if (!u.plannedHabits) u.plannedHabits = []
  if (u.habits) {
    u.habits = u.habits.map(h => ({
      ...h,
      dayLocks: h.dayLocks || {},
      missReasons: h.missReasons || {},
      days: h.days || {},
    }))
  }
  return u
}
