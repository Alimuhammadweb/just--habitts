"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Bell, BellOff, BellRing, Clock } from "lucide-react"
import { type Language, translations } from "@/lib/translations"
import {
  registerServiceWorker,
  requestNotificationPermission,
  getNotificationPermission,
  setupDailyReminder,
  getReminderTime,
  scheduleLocalNotification,
} from "@/lib/push-notifications"

interface NotificationSettingsProps {
  userId: number
  language: Language
  userName: string
}

export function NotificationSettings({ userId, language, userName }: NotificationSettingsProps) {
  const t = translations[language]
  const [permission, setPermission] = useState<string>("default")
  const [reminderTime, setReminderTime] = useState("20:00")
  const [isEnabled, setIsEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    registerServiceWorker()
    setPermission(getNotificationPermission())
    const saved = getReminderTime(userId)
    if (saved) {
      setReminderTime(saved)
      setIsEnabled(true)
    }
  }, [userId])

  const handleEnable = async () => {
    setLoading(true)
    const granted = await requestNotificationPermission()
    setPermission(getNotificationPermission())

    if (granted) {
      const msg = t.notificationReminderMessage?.replace("{name}", userName) ||
        `${userName}, bugun odatlaringizni bajardingizmi? 💪`
      setupDailyReminder(userId, reminderTime, msg)
      setIsEnabled(true)

      // Show test notification
      await scheduleLocalNotification(
        "Just Habits ✅",
        t.notificationTestMessage || "Eslatmalar yoqildi! Siz belgilagan vaqtda xabar olasiz.",
        0
      )
    }
    setLoading(false)
  }

  const handleDisable = () => {
    const w = window as Window & { _habitReminderTimer?: ReturnType<typeof setTimeout> }
    if (w._habitReminderTimer) clearTimeout(w._habitReminderTimer)
    setIsEnabled(false)
  }

  const handleTimeChange = (newTime: string) => {
    setReminderTime(newTime)
    if (isEnabled && permission === "granted") {
      const msg = t.notificationReminderMessage?.replace("{name}", userName) ||
        `${userName}, bugun odatlaringizni bajardingizmi? 💪`
      setupDailyReminder(userId, newTime, msg)
    }
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">{t.notifications || "Bildirishnomalar"}</h3>
      </div>

      {permission === "denied" ? (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg">
          <BellOff className="w-4 h-4 shrink-0" />
          <span>{t.notificationDenied || "Bildirishnomalar brauzer tomonidan bloklangan. Brauzer sozlamalaridan ruxsat bering."}</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Time picker */}
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">
                {t.notificationTime || "Eslatma vaqti"}
              </p>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Enable/Disable button */}
          {isEnabled && permission === "granted" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 p-2 rounded-lg">
                <Bell className="w-3 h-3" />
                <span>{t.notificationEnabled?.replace("{time}", reminderTime) || `Har kuni soat ${reminderTime} da eslatma yuboriladi`}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisable}
                className="w-full text-xs h-8 border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <BellOff className="w-3 h-3 mr-1" />
                {t.notificationDisable || "O'chirish"}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleEnable}
              disabled={loading}
              className="w-full text-xs h-9"
            >
              <Bell className="w-3 h-3 mr-1" />
              {loading
                ? (t.notificationEnabling || "Yoqilmoqda...")
                : (t.notificationEnable || "Eslatmalarni yoqish")}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
