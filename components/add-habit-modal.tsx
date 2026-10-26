"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import type { Habit } from "@/types/user"
import { X } from "lucide-react"
import { translations, type Language } from "@/lib/translations"

interface AddHabitModalProps {
  onClose: () => void
  onAdd: (habit: Habit) => void
  onSchedule: (habit: Habit) => void
  language: Language
}

export function AddHabitModal({ onClose, onAdd, onSchedule, language }: AddHabitModalProps) {
  const [name, setName] = useState("")
  const [why, setWhy] = useState("")
  const [duration, setDuration] = useState("30")
  const [time, setTime] = useState("")
  const [enableNotifications, setEnableNotifications] = useState(false)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")

  const t = translations[language]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const habitDuration = Number.parseInt(duration)
    if (isNaN(habitDuration) || habitDuration < 1 || habitDuration > 100) {
      alert("Iltimos, 1 dan 100 gacha kun sonini kiriting!")
      return
    }

    let habitTime: { hour: number; minute: number } | null = null
    if (time) {
      const [hours, minutes] = time.split(":").map(Number)
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        alert("Iltimos, to'g'ri vaqt formatida kiriting (masalan: 09:00)")
        return
      }
      habitTime = { hour: hours, minute: minutes }
    }

    if (isScheduled) {
      if (!scheduledDate || !scheduledTime) {
        alert("Iltimos, boshlanish sanasi va vaqtini kiriting!")
        return
      }

      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`)
      const now = new Date()

      if (scheduledDateTime <= now) {
        alert("Boshlanish vaqti kelajakda bo'lishi kerak!")
        return
      }

      const habit: Habit = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name,
        why: why || undefined,
        duration: habitDuration,
        days: {},
        missReasons: {},
        time: habitTime,
        notifications: enableNotifications,
        startDate: {
          day: scheduledDateTime.getDate(),
          month: scheduledDateTime.getMonth() + 1,
          year: scheduledDateTime.getFullYear(),
          timestamp: scheduledDateTime.getTime(),
        },
        scheduledStartTime: scheduledDateTime.getTime(),
      }

      onSchedule(habit)
    } else {
      const now = new Date()
      const habit: Habit = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name,
        why: why || undefined,
        duration: habitDuration,
        days: {},
        missReasons: {},
        time: habitTime,
        notifications: enableNotifications,
        startDate: {
          day: now.getDate(),
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          timestamp: now.getTime(),
        },
      }

      onAdd(habit)
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">{t.addHabit}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="habit-name">{t.habitName} *</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.habitNamePlaceholder}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="habit-why">{t.whyField}</Label>
            <Input
              id="habit-why"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder={t.whyPlaceholder}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">{t.whyHint}</p>
          </div>

          <div>
            <Label htmlFor="habit-duration">{t.duration} *</Label>
            <Input
              id="habit-duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              max="100"
              required
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">1 - 100</p>
          </div>

          <div>
            <Label htmlFor="habit-time">{t.reminderTime}</Label>
            <Input
              id="habit-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1"
            />
          </div>

          {time && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notifications"
                checked={enableNotifications}
                onCheckedChange={(checked) => setEnableNotifications(checked as boolean)}
              />
              <label
                htmlFor="notifications"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t.enableNotifications}
              </label>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2 border-t border-border">
            <Checkbox
              id="schedule-habit"
              checked={isScheduled}
              onCheckedChange={(checked) => setIsScheduled(checked as boolean)}
            />
            <label
              htmlFor="schedule-habit"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {language === "uz" ? "Kelajakda boshlash" : language === "ru" ? "Начать в будущем" : "Start in future"}
            </label>
          </div>

          {isScheduled && (
            <div className="space-y-3 pl-6 border-l-2 border-primary">
              <div>
                <Label htmlFor="scheduled-date">{t.startDate}</Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1"
                  required={isScheduled}
                />
              </div>
              <div>
                <Input
                  id="scheduled-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="mt-1"
                  required={isScheduled}
                />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full">
            {isScheduled ? t.scheduleButton : t.addButton}
          </Button>
        </form>
      </div>
    </div>
  )
}
