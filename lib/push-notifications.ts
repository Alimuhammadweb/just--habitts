"use client"

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null

  try {
    const reg = await navigator.serviceWorker.register("/sw.js")
    console.log("[SW] Service worker registered")
    return reg
  } catch (err) {
    console.error("[SW] Registration failed:", err)
    return null
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false

  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false

  const permission = await Notification.requestPermission()
  return permission === "granted"
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
  return Notification.permission
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  delayMinutes: number = 0
): Promise<void> {
  if (!(await requestNotificationPermission())) return

  const reg = await registerServiceWorker()
  if (!reg) return

  if (delayMinutes === 0) {
    reg.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon-dark-32x32.png",
      tag: "habit-reminder",
    })
    return
  }

  // Schedule via setTimeout (works while tab is open)
  setTimeout(() => {
    reg.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon-dark-32x32.png",
      tag: "habit-reminder",
    })
  }, delayMinutes * 60 * 1000)
}

export function saveReminderTime(userId: number, time: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(`reminder_time_${userId}`, time)
}

export function getReminderTime(userId: number): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(`reminder_time_${userId}`)
}

export function setupDailyReminder(userId: number, reminderTime: string, message: string): void {
  if (typeof window === "undefined") return

  // Clear existing reminders
  const existingTimer = (window as Window & { _habitReminderTimer?: ReturnType<typeof setTimeout> })._habitReminderTimer
  if (existingTimer) clearTimeout(existingTimer)

  const scheduleNext = () => {
    const now = new Date()
    const [hours, minutes] = reminderTime.split(":").map(Number)

    const next = new Date()
    next.setHours(hours, minutes, 0, 0)

    // If time already passed today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }

    const delay = next.getTime() - now.getTime()

    const timer = setTimeout(async () => {
      await scheduleLocalNotification("Just Habits ⏰", message, 0)
      scheduleNext() // Schedule next day
    }, delay)

    ;(window as Window & { _habitReminderTimer?: ReturnType<typeof setTimeout> })._habitReminderTimer = timer
  }

  saveReminderTime(userId, reminderTime)
  scheduleNext()
}
