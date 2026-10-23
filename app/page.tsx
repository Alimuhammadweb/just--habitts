"use client"

import { useState, useEffect } from "react"
import { AuthPage } from "@/components/auth-page"
import { MainApp } from "@/components/main-app"
import { AdminPanel } from "@/components/admin-panel"
import type { User } from "@/types/user"
import { authFetch } from "@/lib/api-client"

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // localStorage'da faqat foydalanuvchi ID'si saqlanadi (kim tizimga kirgan).
    // Sahifa ochilganda/yangilanganda haqiqiy ma'lumot HAR DOIM ma'lumotlar bazasidan (PostgreSQL)
    // qayta olinadi - shunda ma'lumot doim bazadagi eng so'nggi holatga mos keladi
    // va eskirgan/buzilgan localStorage nusxasi sessiyani buzmaydi.
    async function restoreSession() {
      try {
        let userId = localStorage.getItem("sessionUserId")

        // Eski versiyada butun user obyekti sessionStorage/localStorage'da
        // saqlangan bo'lishi mumkin - shundan ID'ni chiqarib olib, migratsiya qilamiz.
        if (!userId) {
          const legacyRaw = localStorage.getItem("sessionUser") || sessionStorage.getItem("sessionUser")
          if (legacyRaw) {
            try {
              const legacyUser = JSON.parse(legacyRaw)
              if (legacyUser?.id !== undefined && legacyUser?.id !== null) {
                userId = String(legacyUser.id)
              }
            } catch {
              // buzilgan eski ma'lumot - e'tiborsiz qoldiramiz
            }
          }
        }

        if (userId === "0") {
          // Admin akkaunt bazada saqlanmaydi (login paytida .env dan hosil bo'ladi),
          // shuning uchun uni alohida kalitdan tiklaymiz.
          const adminRaw = localStorage.getItem("sessionAdmin")
          if (adminRaw) {
            setCurrentUser(migrateUserData(JSON.parse(adminRaw)))
          } else {
            localStorage.removeItem("sessionUserId")
          }
        } else if (userId) {
          const res = await authFetch(`/api/users/${userId}`, { cache: "no-store" })
          if (res.ok) {
            const freshUser = await res.json()
            setCurrentUser(migrateUserData(freshUser))
            localStorage.setItem("sessionUserId", String(freshUser.id))
          } else {
            // Foydalanuvchi bazada topilmadi yoki bloklangan - sessiyani tozalaymiz
            localStorage.removeItem("sessionUserId")
          }
        }
      } catch (err) {
        console.error("Sessiyani tiklashda xato:", err)
        // Tarmoq xatosi bo'lsa ham foydalanuvchini majburan chiqarib yubormaymiz -
        // shunchaki keyingi safar qayta urinib ko'radi.
      } finally {
        localStorage.removeItem("sessionUser")
        sessionStorage.removeItem("sessionUser")
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  const handleSetUser = (user: User) => {
    setCurrentUser(user)

    if (user.id === 0) {
      // Admin akkaunt bazada yo'q - alohida kalitda saqlaymiz, DB'ga yozmaymiz
      try {
        localStorage.setItem("sessionUserId", "0")
        localStorage.setItem("sessionAdmin", JSON.stringify(user))
      } catch (err) {
        console.error("Sessiyani saqlashda xato:", err)
      }
      return
    }

    try {
      localStorage.setItem("sessionUserId", String(user.id))
    } catch (err) {
      console.error("Sessiyani saqlashda xato:", err)
    }
    // Eslatma: ma'lumotni serverga butun obyekt sifatida YOZMAYMIZ. XP, odatlar va chelenjlar
    // faqat maxsus server endpointlari orqali o'zgaradi.
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setIsAdmin(false)
    localStorage.removeItem("sessionUserId")
    localStorage.removeItem("sessionAdmin")
    localStorage.removeItem("sessionUser")
    sessionStorage.removeItem("sessionUser")
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
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
