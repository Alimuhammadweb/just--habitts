"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import type { User } from "@/types/user"
import { ArrowLeft, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { fetchAllUsersFromMongoDB, saveUserToMongoDB } from "@/lib/db-sync"
import { CommunityManagement } from "@/components/community-management"
import { MessageCircle } from "lucide-react"

interface AdminPanelProps {
  currentUser: User
  onBack: () => void
  onLogout: () => void
}

export function AdminPanel({ currentUser, onBack, onLogout }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"users" | "community">("users")

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const mongoUsers = await fetchAllUsersFromMongoDB()
      setUsers(mongoUsers)
    } catch (err) {
      console.error("[Admin] Foydalanuvchilarni yuklashda xato:", err)
      toast({ title: "Xato", description: "MongoDB dan foydalanuvchilarni yuklashda xato", variant: "destructive" })
    }
    setIsLoading(false)
  }

  const toggleUserStatus = async (userId: number) => {
    const updatedUsers = users.map((user) => {
      if (user.id === userId) {
        return { ...user, isActive: !user.isActive }
      }
      return user
    })
    setUsers(updatedUsers)
    const user = updatedUsers.find((u) => u.id === userId)
    if (user) {
      await saveUserToMongoDB(user)
      toast({
        title: "Muvaffaqiyatli!",
        description: `Foydalanuvchi ${user.isActive ? "blokdan olindi" : "bloklandi"}`,
      })
    }
  }

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive).length,
    totalHabits: users.reduce((sum, user) => sum + (user.habits?.length || 0), 0),
    todayRegistrations: users.filter((u) => {
      const regDate = new Date(u.createdAt)
      const today = new Date()
      return regDate.toDateString() === today.toDateString()
    }).length,
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <header className="flex items-center justify-between pb-6 mb-8 border-b border-border">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-purple-500" />
              <h1 className="text-3xl font-bold">Admin Panel</h1>
            </div>
          </div>
          <Button variant="ghost" onClick={onLogout} className="text-red-500 hover:text-red-600">
            Chiqish
          </Button>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold mb-1 text-purple-500">{stats.totalUsers}</div>
            <div className="text-sm text-muted-foreground">Jami foydalanuvchilar</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold mb-1 text-green-500">{stats.activeUsers}</div>
            <div className="text-sm text-muted-foreground">Faol foydalanuvchilar</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold mb-1 text-blue-500">{stats.totalHabits}</div>
            <div className="text-sm text-muted-foreground">Jami odatlar</div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold mb-1 text-orange-500">{stats.todayRegistrations}</div>
            <div className="text-sm text-muted-foreground">Bugun ro'yxatdan o'tgan</div>
          </div>
        </div>

        {/* Tabs for Users and Community */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "users"
                ? "border-b-2 border-purple-500 text-purple-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Foydalanuvchilar
          </button>
          <button
            onClick={() => setActiveTab("community")}
            className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
              activeTab === "community"
                ? "border-b-2 border-purple-500 text-purple-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            Community Boshqaruvi
          </button>
        </div>

        {activeTab === "users" ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Users Table */}
            <div className="p-4 border-b border-border">
              <h2 className="text-xl font-semibold">Foydalanuvchilar ro'yxati</h2>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Yuklanmoqda...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Hali foydalanuvchilar yo'q</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Ism</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Ro'yxatdan o'tgan</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((user, index) => {
                      const regDate = new Date(user.createdAt)
                      const formattedDate = `${regDate.getDate().toString().padStart(2, "0")}.${(regDate.getMonth() + 1).toString().padStart(2, "0")}.${regDate.getFullYear()}`

                      return (
                        <tr key={user.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium">{user.name}</td>
                          <td className="px-4 py-3 text-sm">{user.email}</td>
                          <td className="px-4 py-3 text-sm">{formattedDate}</td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                              }`}
                            >
                              {user.isActive ? "Faol" : "Nofaol"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Button
                              onClick={() => toggleUserStatus(user.id)}
                              variant={user.isActive ? "destructive" : "default"}
                              size="sm"
                            >
                              {user.isActive ? "Bloklash" : "Blokdan olish"}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <CommunityManagement currentUser={currentUser} />
        )}
      </div>
    </div>
  )
}
