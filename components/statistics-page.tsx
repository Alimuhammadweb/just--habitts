"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, TrendingUp, Calendar, Award, Target, Flame, Trophy, Zap, Star } from "lucide-react"
import { translations, type Language } from "@/lib/translations"
import type { Habit, User } from "@/types/user"
import { getLevelName, getXPForNextLevel } from "@/lib/xp-system"
import { TasksPage } from "./tasks-page"

interface StatisticsPageProps {
  onBack: () => void
  language: Language
  habits: Habit[]
  currentUser: User
}

export function StatisticsPage({ onBack, language, habits, currentUser }: StatisticsPageProps) {
  const [showTasks, setShowTasks] = useState(false)
  const t = translations[language]

  if (showTasks) {
    return <TasksPage currentUser={currentUser} onBack={() => setShowTasks(false)} language={language} />
  }

  const { totalXP, level, rank, weeklyXP, monthlyXP, currentXP } = currentUser.xpData
  const xpForNextLevel = getXPForNextLevel(level)
  const levelName = getLevelName(level)
  const progressToNextLevel = ((currentXP % 100) / 100) * 100

  // Calculate weekly stats
  const getWeeklyStats = () => {
    const today = new Date()
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    let weeklyCompleted = 0
    let weeklyPartial = 0
    let weeklyMissed = 0

    habits.forEach((habit) => {
      Object.entries(habit.days).forEach(([dayIndex, status]) => {
        const dayDate = new Date(habit.startDate.timestamp)
        dayDate.setDate(dayDate.getDate() + Number(dayIndex))

        if (dayDate >= weekAgo && dayDate <= today) {
          if (status === "completed") weeklyCompleted++
          else if (status === "partial") weeklyPartial++
          else if (status === "missed") weeklyMissed++
        }
      })
    })

    return { weeklyCompleted, weeklyPartial, weeklyMissed }
  }

  // Calculate monthly stats
  const getMonthlyStats = () => {
    const today = new Date()
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    let monthlyCompleted = 0
    let monthlyPartial = 0
    let monthlyMissed = 0

    habits.forEach((habit) => {
      Object.entries(habit.days).forEach(([dayIndex, status]) => {
        const dayDate = new Date(habit.startDate.timestamp)
        dayDate.setDate(dayDate.getDate() + Number(dayIndex))

        if (dayDate >= monthAgo && dayDate <= today) {
          if (status === "completed") monthlyCompleted++
          else if (status === "partial") monthlyPartial++
          else if (status === "missed") monthlyMissed++
        }
      })
    })

    return { monthlyCompleted, monthlyPartial, monthlyMissed }
  }

  // Calculate best streak (safe version)
  const getBestStreak = () => {
    let maxStreak = 0

    habits.forEach((habit) => {
      if (!habit.days) return
      const sortedDays = Object.keys(habit.days)
        .map(Number)
        .sort((a, b) => a - b)

      let currentStreak = 0

      sortedDays.forEach((dayNum) => {
        if (habit.days[dayNum] === "completed") {
          currentStreak++
          maxStreak = Math.max(maxStreak, currentStreak)
        } else if (habit.days[dayNum] === "missed") {
          currentStreak = 0
        }
        // partial doesn't break streak
      })
    })

    return maxStreak
  }

  // Calculate completion rate
  const getCompletionRate = () => {
    let totalDays = 0
    let completedDays = 0

    habits.forEach((habit) => {
      const days = Object.values(habit.days)
      totalDays += days.length
      completedDays += days.filter((s) => s === "completed").length
    })

    return totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0
  }

  const { weeklyCompleted, weeklyPartial, weeklyMissed } = getWeeklyStats()
  const { monthlyCompleted, monthlyPartial, monthlyMissed } = getMonthlyStats()
  const bestStreak = getBestStreak()
  const completionRate = getCompletionRate()

  const totalCompleted = habits.reduce(
    (sum, h) => sum + Object.values(h.days).filter((s) => s === "completed").length,
    0,
  )

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 sm:h-10 sm:w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">{t.statistics}</h1>
          <Button variant="outline" size="sm" onClick={() => setShowTasks(true)} className="ml-auto gap-2">
            <Trophy className="h-4 w-4" />
            {language === "uz" ? "Topshiriqlar" : language === "ru" ? "Задачи" : "Tasks"}
          </Button>
        </div>

        <Card className="p-4 sm:p-6 mb-4 sm:mb-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-500/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl sm:text-3xl font-bold text-white shadow-lg">
                {level}
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">{levelName}</h2>
                <p className="text-sm text-muted-foreground">
                  {language === "uz" ? "Daraja" : language === "ru" ? "Уровень" : "Level"} {level}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl sm:text-4xl font-bold text-purple-500">{totalXP}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                {language === "uz" ? "Jami XP" : language === "ru" ? "Всего XP" : "Total XP"}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {language === "uz"
                  ? "Keyingi darajagacha"
                  : language === "ru"
                    ? "До следующего уровня"
                    : "Next level progress"}
              </span>
              <span className="font-semibold">{currentXP % 100} / 100 XP</span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                style={{ width: `${progressToNextLevel}%` }}
              />
            </div>
          </div>

          {rank && (
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="font-semibold">
                  {language === "uz" ? "Reyting" : language === "ru" ? "Рейтинг" : "Rank"}
                </span>
              </div>
              <div className="text-2xl font-bold text-yellow-500">#{rank}</div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <Card className="p-3 sm:p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-green-500">{totalCompleted}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t.totalCompleted}</div>
          </Card>

          <Card className="p-3 sm:p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-orange-500">{bestStreak}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t.bestStreak}</div>
          </Card>

          <Card className="p-3 sm:p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Award className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-500">{completionRate}%</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t.completionRate}</div>
          </Card>

          <Card className="p-3 sm:p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-purple-500">{habits.length}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t.activeHabits}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card className="p-4 sm:p-5 border-2 border-blue-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-blue-500" />
              <h3 className="text-base sm:text-lg font-semibold">
                {language === "uz" ? "Haftalik XP" : language === "ru" ? "Недельный XP" : "Weekly XP"}
              </h3>
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-blue-500 mb-2">{weeklyXP}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {language === "uz"
                ? "Oxirgi 7 kun ichida yig'ilgan"
                : language === "ru"
                  ? "Заработано за последние 7 дней"
                  : "Earned in last 7 days"}
            </div>
          </Card>

          <Card className="p-4 sm:p-5 border-2 border-purple-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Star className="h-5 w-5 text-purple-500" />
              <h3 className="text-base sm:text-lg font-semibold">
                {language === "uz" ? "Oylik XP" : language === "ru" ? "Месячный XP" : "Monthly XP"}
              </h3>
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-purple-500 mb-2">{monthlyXP}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {language === "uz"
                ? "Oxirgi 30 kun ichida yig'ilgan"
                : language === "ru"
                  ? "Заработано за последние 30 дней"
                  : "Earned in last 30 days"}
            </div>
          </Card>
        </div>

        {/* Weekly Stats */}
        <Card className="p-4 sm:p-6 mb-3 sm:mb-4 border border-border">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <h2 className="text-base sm:text-xl font-semibold">{t.weeklyStats}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <div className="text-xl sm:text-2xl font-bold text-green-600">{weeklyCompleted}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t.completed}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-500/10">
              <div className="text-xl sm:text-2xl font-bold text-yellow-600">{weeklyPartial}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t.partial}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10">
              <div className="text-xl sm:text-2xl font-bold text-red-600">{weeklyMissed}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                {language === "uz" ? "O'tkazib yuborildi" : language === "ru" ? "Пропущено" : "Missed"}
              </div>
            </div>
          </div>
        </Card>

        {/* Monthly Stats */}
        <Card className="p-4 sm:p-6 border border-border">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <h2 className="text-base sm:text-xl font-semibold">{t.monthlyStats}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <div className="text-xl sm:text-2xl font-bold text-green-600">{monthlyCompleted}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t.completed}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-500/10">
              <div className="text-xl sm:text-2xl font-bold text-yellow-600">{monthlyPartial}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">{t.partial}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10">
              <div className="text-xl sm:text-2xl font-bold text-red-600">{monthlyMissed}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                {language === "uz" ? "O'tkazib yuborildi" : language === "ru" ? "Пропущено" : "Missed"}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
