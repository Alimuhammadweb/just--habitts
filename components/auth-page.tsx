"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type User, ADMIN_CREDENTIALS } from "@/types/user"
import { useToast } from "@/hooks/use-toast"

interface AuthPageProps {
  onLogin: (user: User) => void
}

export function AuthPage({ onLogin }: AuthPageProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 503 || (response.status >= 500 && data.code === "DB_CONNECT_ERROR")) {
          // Server bilan bog'lanib bo'lmadi - aniq xabar beramiz
          toast({
            title: "Server bilan bog'lanib bo'lmadi",
            description: "MongoDB ulanish xatosi. Iltimos bir necha soniyadan so'ng qayta urinib ko'ring.",
            variant: "destructive"
          })
          return
        }
        // Noto'g'ri email/parol
        toast({ title: "Xato", description: data.error || "Email yoki parol noto'g'ri!", variant: "destructive" })
        return
      }

      const user = data as User
      const migratedUser = migrateUserData(user)
      onLogin(migratedUser)
      toast({
        title: user.isAdmin ? "Admin panel" : "Xush kelibsiz!",
        description: user.isAdmin ? "Xush kelibsiz, Admin!" : `${migratedUser.name}, tizimga muvaffaqiyatli kirdingiz`,
      })
    } catch (error) {
      console.error("[Login] Network xato:", error)
      toast({
        title: "Internet aloqasi yo'q",
        description: "Server bilan bog'lanib bo'lmadi. Internet aloqangizni tekshiring.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (password !== confirmPassword) {
      toast({ title: "Xato", description: "Parollar mos kelmadi!", variant: "destructive" })
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      toast({ title: "Xato", description: "Parol kamida 6 belgidan iborat bo'lishi kerak!", variant: "destructive" })
      setIsLoading(false)
      return
    }

    if (email === ADMIN_CREDENTIALS.email) {
      toast({
        title: "Xato",
        description: "Bu email admin uchun ajratilgan. Boshqa email kiriting.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    const newUser: User = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name,
      email,
      password,
      createdAt: new Date().toISOString(),
      isActive: true,
      isAdmin: false,
      habits: [],
      stats: { totalHabits: 0, completedDays: 0, currentStreak: 0, longestStreak: 0 },
      pomodoroData: { sessions: [], totalPomodoros: 0 },
      xpData: {
        totalXP: 0,
        level: 1,
        rank: null,
        weeklyXP: 0,
        monthlyXP: 0,
        xpHistory: [],
        currentXP: 0,
        lastUpdated: Date.now(),
      },
      publicProfile: false,
      unlockedAvatars: [],
      unlockedThemes: [],
      unlockedBadges: [],
      unlockedBorders: [],
      unlockedFrames: [],
      unlockedBackgrounds: [],
      completedTasks: [],
      plannedHabits: [],
      streakFreezes: 1,
      totalFreezesUsed: 0,
      friends: [],
      friendRequests: [],
      sentRequests: [],
    }

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 409) {
          toast({ title: "Xato", description: data.error || "Bu email allaqachon ro'yxatdan o'tgan!", variant: "destructive" })
          return
        }
        if (response.status === 503 || data.code === "DB_CONNECT_ERROR") {
          toast({
            title: "Server bilan bog'lanib bo'lmadi",
            description: "MongoDB ulanish xatosi. Iltimos bir necha soniyadan so'ng qayta urinib ko'ring.",
            variant: "destructive"
          })
          return
        }
        toast({ title: "Xato", description: data.error || "Ro'yxatdan o'tish amalga oshmadi!", variant: "destructive" })
        return
      }

      // Serverdan qaytgan clean user'ni ishlatamiz (password yo'q)
      const savedUser = { ...newUser, ...data }
      const migratedUser = migrateUserData(savedUser)
      onLogin(migratedUser)
      toast({ title: "Tabriklaymiz!", description: "Ro'yxatdan muvaffaqiyatli o'tdingiz" })
    } catch (error) {
      console.error("[Register] Network xato:", error)
      toast({
        title: "Internet aloqasi yo'q",
        description: "Server bilan bog'lanib bo'lmadi. Internet aloqangizni tekshiring.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-8 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Just</h1>
          <p className="text-muted-foreground text-sm">Odatlar Kuzatuvchisi</p>
        </div>

        <div className="flex border-b border-border mb-6">
          <button
            onClick={() => setActiveTab("login")}
            className={`flex-1 py-3 font-medium transition-colors border-b-2 ${
              activeTab === "login" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            Kirish
          </button>
          <button
            onClick={() => setActiveTab("register")}
            className={`flex-1 py-3 font-medium transition-colors border-b-2 ${
              activeTab === "register"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
          >
            Ro'yxatdan o'tish
          </button>
        </div>

        {activeTab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Parol</Label>
              <Input id="password" name="password" type="password" required className="mt-1" />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Yuklanmoqda..." : "Kirish"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="name">Ism</Label>
              <Input id="name" name="name" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="reg-email">Email</Label>
              <Input id="reg-email" name="email" type="email" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="reg-password">Parol</Label>
              <Input id="reg-password" name="password" type="password" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Parolni tasdiqlash</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" required className="mt-1" />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Yuklanmoqda..." : "Ro'yxatdan o'tish"}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

function migrateUserData(user: User): User {
  const migratedUser = { ...user }

  // Add xpData if missing
  if (!migratedUser.xpData) {
    migratedUser.xpData = {
      totalXP: 0,
      level: 1,
      rank: null,
      weeklyXP: 0,
      monthlyXP: 0,
      xpHistory: [],
      currentXP: 0,
      lastUpdated: Date.now(),
    }
  }

  // Add pomodoroData if missing
  if (!migratedUser.pomodoroData) {
    migratedUser.pomodoroData = { sessions: [], totalPomodoros: 0 }
  }

  // Add publicProfile if missing
  if (migratedUser.publicProfile === undefined) {
    migratedUser.publicProfile = false
  }

  // Ensure habits have dayLocks and missReasons
  if (migratedUser.habits) {
    migratedUser.habits = migratedUser.habits.map((habit) => ({
      ...habit,
      dayLocks: habit.dayLocks || {},
      missReasons: habit.missReasons || {},
    }))
  }

  return migratedUser
}
