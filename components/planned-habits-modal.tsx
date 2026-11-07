"use client"

import { Button } from "@/components/ui/button"
import type { Habit } from "@/types/user"
import { X, Trash2, Calendar, Clock } from "lucide-react"
import { translations, type Language } from "@/lib/translations"

interface PlannedHabitsModalProps {
  plannedHabits: Habit[]
  onClose: () => void
  onDelete: (habitId: number) => void
  language: Language
}

export function PlannedHabitsModal({ plannedHabits, onClose, onDelete, language }: PlannedHabitsModalProps) {
  const t = translations[language]

  const getTimeRemaining = (scheduledTime: number) => {
    const now = Date.now()
    const diff = scheduledTime - now
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    return { days, hours }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold">{t.plannedHabits}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {plannedHabits.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg sm:text-xl text-muted-foreground mb-2">{t.noPlannedHabits}</p>
            <p className="text-sm text-muted-foreground">{t.noPlannedMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {plannedHabits.map((habit) => {
              const { days, hours } = getTimeRemaining(habit.scheduledStartTime!)
              const startDate = new Date(habit.scheduledStartTime!)

              return (
                <div key={habit.id} className="bg-muted/50 border border-border rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base sm:text-lg mb-2">{habit.name}</h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="whitespace-nowrap">{startDate.toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="whitespace-nowrap">
                            {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(habit.id)}
                      className="text-red-500 hover:text-red-600 self-start sm:self-auto"
                    >
                      <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs sm:text-sm">
                    <span className="px-3 py-1.5 bg-primary/20 text-primary rounded-full font-medium break-words max-w-full">
                      {t.startsIn}: {days} {t.daysLeft}
                      {hours > 0 && `, ${hours} ${language === "uz" ? "soat" : language === "ru" ? "ч" : "hrs"}`}
                    </span>
                    <span className="px-3 py-1.5 bg-muted rounded-full whitespace-nowrap">
                      {habit.duration} {t.day}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
