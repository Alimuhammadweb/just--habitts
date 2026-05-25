"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import type { Habit, DayStatus } from "@/types/user"
import { Trash2, Calendar, TrendingUp, Trophy, Lock, Clock } from "lucide-react"
import { translations, type Language } from "@/lib/translations"
import MissReasonModal from "@/components/miss-reason-modal"
import { getCurrentDateString, getNextAvailableDay, getExpectedDateForDay } from "@/lib/xp-system"
import { useToast } from "@/hooks/use-toast"
import { getDeleteConfirmation } from "@/lib/delete-confirmation"

interface HabitCardProps {
  habit: Habit
  onDelete: (id: number) => void
  onUpdateDay: (habitId: number, dayIndex: number, status: DayStatus | "none", reason?: string) => void
  language: Language
}

const calculateRank = (days: Record<number, DayStatus>, language: Language): { rank: string; emoji: string } => {
  const dayIndices = Object.keys(days)
    .map(Number)
    .sort((a, b) => a - b)

  let maxConsecutiveGreen = 0
  let currentConsecutiveGreen = 0
  let maxConsecutiveYellow = 0
  let currentConsecutiveYellow = 0
  let maxConsecutiveRed = 0
  let currentConsecutiveRed = 0

  for (const index of dayIndices) {
    const status = days[index]

    if (status === "completed") {
      currentConsecutiveGreen++
      maxConsecutiveGreen = Math.max(maxConsecutiveGreen, currentConsecutiveGreen)
      currentConsecutiveYellow = 0
      currentConsecutiveRed = 0
    } else if (status === "partial") {
      currentConsecutiveYellow++
      maxConsecutiveYellow = Math.max(maxConsecutiveYellow, currentConsecutiveYellow)
      currentConsecutiveGreen = 0
      currentConsecutiveRed = 0
    } else if (status === "frozen") {
      // frozen = streak preserved, count as green
      currentConsecutiveGreen++
      maxConsecutiveGreen = Math.max(maxConsecutiveGreen, currentConsecutiveGreen)
      currentConsecutiveYellow = 0
      currentConsecutiveRed = 0
    } else if (status === "missed") {
      currentConsecutiveRed++
      maxConsecutiveRed = Math.max(maxConsecutiveRed, currentConsecutiveRed)
      currentConsecutiveGreen = 0
      currentConsecutiveYellow = 0
    } else {
      currentConsecutiveGreen = 0
      currentConsecutiveYellow = 0
      currentConsecutiveRed = 0
    }
  }

  const t = translations[language]

  if (maxConsecutiveGreen >= 30) return { rank: t.rank.disciplined, emoji: "👑" }
  if (maxConsecutiveGreen >= 10) return { rank: t.rank.determined, emoji: "🔥" }
  if (maxConsecutiveGreen >= 5) return { rank: t.rank.active, emoji: "💪" }
  if (maxConsecutiveYellow >= 2) return { rank: t.rank.weak, emoji: "😔" }
  if (maxConsecutiveRed >= 2) return { rank: t.rank.lazy, emoji: "😴" }

  return { rank: t.rank.beginner, emoji: "🌱" }
}

export function HabitCard({ habit, onDelete, onUpdateDay, language }: HabitCardProps) {
  const [activeColorPicker, setActiveColorPicker] = useState<number | null>(null)
  const [showWhyModal, setShowWhyModal] = useState(false)
  const [showMissReasonModal, setShowMissReasonModal] = useState(false)
  const [selectedDayForSkip, setSelectedDayForSkip] = useState<number | null>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const t = translations[language]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setActiveColorPicker(null)
      }
    }

    if (activeColorPicker !== null) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [activeColorPicker])

  const completedDays = Object.values(habit.days).filter((status) => status === "completed").length
  const progressPercentage = Math.round((completedDays / habit.duration) * 100)

  const { rank, emoji } = calculateRank(habit.days, language)

  const startDate = new Date(habit.startDate.timestamp)
  const formattedDate = `${startDate.getDate().toString().padStart(2, "0")}.${(startDate.getMonth() + 1).toString().padStart(2, "0")}.${startDate.getFullYear()}`

  const getDayBoxClass = (status: DayStatus | undefined, isLocked: boolean) => {
    const baseClass = isLocked ? "cursor-not-allowed opacity-60" : ""

    if (!status) return `border-border bg-background text-foreground hover:border-muted-foreground ${baseClass}`
    if (status === "completed") return `bg-green-600 text-white border-green-600 ${baseClass}`
    if (status === "partial") return `bg-yellow-500 text-white border-yellow-500 ${baseClass}`
    if (status === "missed") return `bg-red-600 text-white border-red-600 ${baseClass}`
    if (status === "frozen") return `bg-blue-400 text-white border-blue-400 ${baseClass}`
    return `border-border bg-background text-foreground hover:border-muted-foreground ${baseClass}`
  }

  const availableDayInfo = getNextAvailableDay(habit, habit.duration)
  const nextAvailableDay = availableDayInfo.dayIndex
  const hoursRemaining = availableDayInfo.hoursRemaining

  const isDayLocked = (dayIndex: number): boolean => {
    const dayLock = habit.dayLocks?.[dayIndex]
    if (!dayLock) return false

    const currentDate = getCurrentDateString()
    return currentDate !== dayLock.dateString
  }

  const canMarkDay = (dayIndex: number): { allowed: boolean; reason?: string } => {
    const status = habit.days[dayIndex]
    const currentDate = getCurrentDateString()
    const expectedDate = getExpectedDateForDay(habit.startDate.timestamp, dayIndex)

    // If day is already marked
    if (status) {
      if (isDayLocked(dayIndex)) {
        return { allowed: false, reason: t.statusLocked }
      }
      return { allowed: true }
    }

    // Check if the expected calendar date has arrived
    if (currentDate < expectedDate) {
      const expectedDateObj = new Date(expectedDate)
      const dateStr = `${expectedDateObj.getDate()}.${expectedDateObj.getMonth() + 1}.${expectedDateObj.getFullYear()}`

      return {
        allowed: false,
        reason: `📅 ${language === "uz" ? "Bu kun" : language === "ru" ? "Этот день" : "This day"} ${dateStr} ${language === "uz" ? "kuni ochiladi" : language === "ru" ? "откроется" : "will open"}`,
      }
    }

    // Check if this is the next sequential day
    if (nextAvailableDay === null || dayIndex !== nextAvailableDay) {
      return { allowed: false, reason: t.markInOrder }
    }

    return { allowed: true }
  }

  const handleSkipDay = (dayIndex: number) => {
    setSelectedDayForSkip(dayIndex)
    setShowMissReasonModal(true)
    setActiveColorPicker(null)
  }

  const confirmSkipWithReason = (reason: string) => {
    if (selectedDayForSkip !== null) {
      onUpdateDay(habit.id, selectedDayForSkip, "missed", reason)
      setShowMissReasonModal(false)
      setSelectedDayForSkip(null)
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 text-foreground break-words line-clamp-2">
            {habit.name}
          </h3>

          {habit.why && (
            <button
              onClick={() => setShowWhyModal(true)}
              className="text-xs text-muted-foreground italic hover:text-foreground transition-colors mb-2 text-left line-clamp-2"
            >
              💡 {habit.why.length > 50 ? habit.why.substring(0, 50) + "..." : habit.why}
            </button>
          )}

          <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                {t.startedOn}: {formattedDate}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                {t.progress}: {completedDays}/{habit.duration} ({progressPercentage}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                {emoji} {rank}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (confirm(getDeleteConfirmation())) {
              onDelete(habit.id)
            }
          }}
          className="text-red-500 hover:text-red-600 hover:bg-red-500/10 flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-1.5 sm:gap-2">
        {Array.from({ length: habit.duration }, (_, index) => {
          const status = habit.days[index]
          const isLocked = isDayLocked(index)
          const markCheck = canMarkDay(index)
          const isNextAvailable = index === nextAvailableDay && !status

          return (
            <div key={index} className="relative">
              <button
                onClick={() => {
                  if (!markCheck.allowed) {
                    toast({
                      title: t.cannotMarkYet,
                      description: markCheck.reason,
                      variant: "destructive",
                      duration: 5000,
                    })
                    return
                  }

                  setActiveColorPicker(activeColorPicker === index ? null : index)
                }}
                className={`w-full min-h-[40px] sm:min-h-[32px] rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all relative ${getDayBoxClass(status, isLocked)} ${!markCheck.allowed && !status ? "cursor-not-allowed opacity-60" : ""} ${isNextAvailable ? "ring-2 ring-primary ring-offset-2" : ""}`}
                disabled={!markCheck.allowed}
              >
                {index + 1}
                {isLocked && <Lock className="absolute top-0 right-0 h-3 w-3 text-white opacity-70" />}
                {!status && !markCheck.allowed && hoursRemaining !== null && hoursRemaining > 0 && (
                  <Clock className="absolute top-0 right-0 h-3 w-3 text-orange-500 opacity-70" />
                )}
              </button>

              {activeColorPicker === index && markCheck.allowed && (
                <div
                  ref={colorPickerRef}
                  className="fixed sm:absolute top-1/2 left-1/2 sm:top-full sm:left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-y-0 sm:mt-2 bg-card border-2 border-border rounded-lg p-3 sm:p-2 shadow-xl z-50 flex gap-3 sm:gap-2"
                >
                  <button
                    onClick={() => {
                      onUpdateDay(habit.id, index, "completed")
                      setActiveColorPicker(null)
                    }}
                    className="w-12 h-12 sm:w-8 sm:h-8 rounded bg-green-600 hover:bg-green-700 transition-colors flex-shrink-0"
                    title={t.completed}
                  />
                  <button
                    onClick={() => {
                      onUpdateDay(habit.id, index, "partial")
                      setActiveColorPicker(null)
                    }}
                    className="w-12 h-12 sm:w-8 sm:h-8 rounded bg-yellow-500 hover:bg-yellow-600 transition-colors flex-shrink-0"
                    title={t.partial}
                  />
                  <button
                    onClick={() => handleSkipDay(index)}
                    className="w-12 h-12 sm:w-8 sm:h-8 rounded bg-red-600 hover:bg-red-700 transition-colors flex-shrink-0"
                    title={t.skipped}
                  />
                  {status && (
                    <button
                      onClick={() => {
                        onUpdateDay(habit.id, index, "none")
                        setActiveColorPicker(null)
                      }}
                      className="w-12 h-12 sm:w-8 sm:h-8 rounded bg-muted hover:bg-muted/70 transition-colors flex-shrink-0 border border-border"
                      title={language === "uz" ? "Tozalash" : language === "ru" ? "Очистить" : "Clear"}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showWhyModal && habit.why && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setShowWhyModal(false)}
        >
          <div className="bg-card border border-border rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-3">{t.whyDoingThis}</h3>
            <p className="text-muted-foreground mb-4">{habit.why}</p>
            <Button onClick={() => setShowWhyModal(false)} className="w-full">
              {t.close}
            </Button>
          </div>
        </div>
      )}

      <MissReasonModal
        isOpen={showMissReasonModal}
        onClose={() => {
          setShowMissReasonModal(false)
          setSelectedDayForSkip(null)
        }}
        onConfirm={confirmSkipWithReason}
        language={language}
        habitName={habit.name}
      />
    </div>
  )
}
