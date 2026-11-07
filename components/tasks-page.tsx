"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Trophy, Lock, CheckCircle2, Target, Zap, Flame, Star, Crown } from "lucide-react"
import type { User } from "@/types/user"
import { TASKS } from "@/types/user"
import { calculateTaskProgress, isTaskCompleted } from "@/lib/tasks-system"
import { translations, type Language } from "@/lib/translations"
import { AchievementAnimation } from "./achievement-animation"

interface TasksPageProps {
  currentUser: User
  onBack: () => void
  language: Language
}

export function TasksPage({ currentUser, onBack, language }: TasksPageProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all")
  const [showAnimation, setShowAnimation] = useState<"snow" | "confetti" | "sparkles" | "fireworks" | "stars" | null>(
    null,
  )
  const t = translations[language]

  const progressMap = calculateTaskProgress(currentUser)

  const filteredTasks = TASKS.filter((task) => {
    const categoryMatch = filterCategory === "all" || task.category === filterCategory
    const difficultyMatch = filterDifficulty === "all" || task.difficulty === filterDifficulty
    return categoryMatch && difficultyMatch
  })

  const completedTasks = TASKS.filter((task) => isTaskCompleted(currentUser, task.id))
  const completionPercentage = Math.round((completedTasks.length / TASKS.length) * 100)

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-500/10 text-green-500 border-green-500/30"
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
      case "hard":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30"
      case "expert":
        return "bg-red-500/10 text-red-500 border-red-500/30"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/30"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "xp":
        return <Zap className="h-4 w-4" />
      case "habits":
        return <Target className="h-4 w-4" />
      case "streak":
        return <Flame className="h-4 w-4" />
      case "level":
        return <Crown className="h-4 w-4" />
      default:
        return <Star className="h-4 w-4" />
    }
  }

  const getRewardIcon = (type: string) => {
    switch (type) {
      case "avatar": return "👤"
      case "theme": return "🎨"
      case "badge": return "🏅"
      case "border": return "🔲"
      case "frame": return "🖼️"
      case "background": return "🌅"
      default: return "🎁"
    }
  }

  const getRewardTypeLabel = (type: string) => {
    const labels: Record<string, Record<string, string>> = {
      avatar: { uz: "Avatar", ru: "Аватар", en: "Avatar" },
      theme: { uz: "Mavzu", ru: "Тема", en: "Theme" },
      badge: { uz: "Nishon", ru: "Значок", en: "Badge" },
      border: { uz: "Chegara", ru: "Граница", en: "Border" },
      frame: { uz: "Ramka", ru: "Рамка", en: "Frame" },
      background: { uz: "Fon", ru: "Фон", en: "Background" },
    }
    return labels[type]?.[language] || type
  }

  const handleTaskClick = (task: (typeof TASKS)[0]) => {
    const completed = isTaskCompleted(currentUser, task.id)
    if (completed) {
      const animationTypes: Record<string, typeof showAnimation> = {
        easy: "sparkles",
        medium: "confetti",
        hard: "fireworks",
        expert: "snow",
      }
      const animation = animationTypes[task.difficulty] || "sparkles"
      setShowAnimation(animation)
      setTimeout(() => setShowAnimation(null), 5000)
    }
  }

  // Track previously seen completions in state (no localStorage needed)
  const [seenTaskCount, setSeenTaskCount] = useState((currentUser.completedTasks || []).length)

  useEffect(() => {
    const currentCount = (currentUser.completedTasks || []).length
    if (currentCount > seenTaskCount) {
      setShowAnimation("confetti")
      setTimeout(() => setShowAnimation(null), 5000)
      setSeenTaskCount(currentCount)
    }
  }, [currentUser.completedTasks, seenTaskCount])

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      {showAnimation && <AchievementAnimation type={showAnimation} />}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 sm:h-10 sm:w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">
            {language === "uz" ? "Topshiriqlar" : language === "ru" ? "Задачи" : "Tasks"}
          </h1>
        </div>

        {/* Progress Overview */}
        <Card className="p-4 sm:p-6 mb-4 sm:mb-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-500/30">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
              <Trophy className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-bold mb-1">
                {language === "uz"
                  ? "Sizning Yutuqlaringiz"
                  : language === "ru"
                    ? "Ваши Достижения"
                    : "Your Achievements"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {completedTasks.length} / {TASKS.length}{" "}
                {language === "uz"
                  ? "topshiriq bajarildi"
                  : language === "ru"
                    ? "заданий выполнено"
                    : "tasks completed"}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl sm:text-4xl font-bold text-purple-500">{completionPercentage}%</div>
            </div>
          </div>
          <Progress value={completionPercentage} className="h-3" />
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
          <Button
            variant={filterCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterCategory("all")}
          >
            {language === "uz" ? "Hammasi" : language === "ru" ? "Все" : "All"}
          </Button>
          <Button
            variant={filterCategory === "xp" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterCategory("xp")}
          >
            <Zap className="h-4 w-4 mr-1" />
            XP
          </Button>
          <Button
            variant={filterCategory === "habits" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterCategory("habits")}
          >
            <Target className="h-4 w-4 mr-1" />
            {language === "uz" ? "Odatlar" : language === "ru" ? "Привычки" : "Habits"}
          </Button>
          <Button
            variant={filterCategory === "streak" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterCategory("streak")}
          >
            <Flame className="h-4 w-4 mr-1" />
            {language === "uz" ? "Ketma-ketlik" : language === "ru" ? "Серия" : "Streak"}
          </Button>
          <Button
            variant={filterCategory === "level" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterCategory("level")}
          >
            <Crown className="h-4 w-4 mr-1" />
            {language === "uz" ? "Daraja" : language === "ru" ? "Уровень" : "Level"}
          </Button>
        </div>

        {/* Difficulty Filter */}
        <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
          <Badge
            variant={filterDifficulty === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterDifficulty("all")}
          >
            {language === "uz" ? "Barcha qiyinlik" : language === "ru" ? "Все сложности" : "All Difficulties"}
          </Badge>
          <Badge
            variant={filterDifficulty === "easy" ? "default" : "outline"}
            className={`cursor-pointer ${getDifficultyColor("easy")}`}
            onClick={() => setFilterDifficulty("easy")}
          >
            {language === "uz" ? "Oson" : language === "ru" ? "Легко" : "Easy"}
          </Badge>
          <Badge
            variant={filterDifficulty === "medium" ? "default" : "outline"}
            className={`cursor-pointer ${getDifficultyColor("medium")}`}
            onClick={() => setFilterDifficulty("medium")}
          >
            {language === "uz" ? "O'rta" : language === "ru" ? "Средне" : "Medium"}
          </Badge>
          <Badge
            variant={filterDifficulty === "hard" ? "default" : "outline"}
            className={`cursor-pointer ${getDifficultyColor("hard")}`}
            onClick={() => setFilterDifficulty("hard")}
          >
            {language === "uz" ? "Qiyin" : language === "ru" ? "Сложно" : "Hard"}
          </Badge>
          <Badge
            variant={filterDifficulty === "expert" ? "default" : "outline"}
            className={`cursor-pointer ${getDifficultyColor("expert")}`}
            onClick={() => setFilterDifficulty("expert")}
          >
            {language === "uz" ? "Ekspert" : language === "ru" ? "Эксперт" : "Expert"}
          </Badge>
        </div>

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {filteredTasks.map((task) => {
            const progress = progressMap.get(task.id) || 0
            const completed = isTaskCompleted(currentUser, task.id)

            return (
              <Card
                key={task.id}
                onClick={() => handleTaskClick(task)}
                className={`p-4 sm:p-5 transition-all hover:shadow-lg cursor-pointer ${
                  completed
                    ? "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/50"
                    : "border border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-xl sm:text-2xl ${
                        completed ? "bg-green-500/20" : "bg-muted"
                      }`}
                    >
                      {completed ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : getCategoryIcon(task.category)}
                    </div>
                    <div>
                      <h3 className="font-bold text-base sm:text-lg">{task.title}</h3>
                      <Badge className={`text-xs ${getDifficultyColor(task.difficulty)}`}>
                        {task.difficulty.charAt(0).toUpperCase() + task.difficulty.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  {!completed && progress < 100 && <Lock className="h-5 w-5 text-muted-foreground" />}
                </div>

                <p className="text-sm text-muted-foreground mb-4">{task.description}</p>

                {/* Progress Bar */}
                {!completed && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        {language === "uz" ? "Jarayon" : language === "ru" ? "Прогресс" : "Progress"}
                      </span>
                      <span className="font-semibold">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {/* Reward */}
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg ${
                    completed ? "bg-green-500/20 border border-green-500/30" : "bg-muted/50"
                  }`}
                >
                  <span className="text-2xl">{getRewardIcon(task.reward.type)}</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">
                      {getRewardTypeLabel(task.reward.type)}
                    </p>
                    <p className="text-sm font-semibold">{task.reward.name}</p>
                    {task.reward.visualDescription && (
                      <p className="text-xs text-muted-foreground mt-0.5">{task.reward.visualDescription}</p>
                    )}
                  </div>
                  {completed && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </div>
              </Card>
            )
          })}
        </div>

        {filteredTasks.length === 0 && (
          <Card className="p-8 sm:p-12 text-center">
            <Trophy className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {language === "uz"
                ? "Bu filtr bo'yicha topshiriqlar topilmadi"
                : language === "ru"
                  ? "Задач по этому фильтру не найдено"
                  : "No tasks found for this filter"}
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
