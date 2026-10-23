import type { User } from "@/types/user"

interface WeeklyStats {
  completedDays: number
  totalDays: number
  streakDays: number
  topHabit: string
  xpEarned: number
  freezesUsed: number
}

export function getWeeklyStats(user: User): WeeklyStats {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  let completedDays = 0
  let totalDays = 0
  let streakDays = 0
  let topHabitName = ""
  let topHabitCompleted = 0

  user.habits.forEach((habit) => {
    if (!habit.startDate?.timestamp) return
    let habitCompleted = 0

    Object.entries(habit.days).forEach(([dayIndex, status]) => {
      const dayDate = new Date(habit.startDate.timestamp)
      dayDate.setDate(dayDate.getDate() + Number(dayIndex))

      if (dayDate >= oneWeekAgo) {
        totalDays++
        if (status === "completed" || status === "frozen") completedDays++
        if (status === "completed") habitCompleted++
      }
    })

    if (habitCompleted > topHabitCompleted) {
      topHabitCompleted = habitCompleted
      topHabitName = habit.name
    }
  })

  // Calculate current streak
  const allDays = user.habits.flatMap((h) => Object.values(h.days))
  let streak = 0
  for (let i = allDays.length - 1; i >= 0; i--) {
    if (allDays[i] === "completed" || allDays[i] === "frozen") streak++
    else if (allDays[i] === "missed") break
  }

  const xpEarned = (user.xpData.xpHistory || [])
    .filter((h) => new Date(h.date) >= oneWeekAgo && h.xpEarned > 0)
    .reduce((sum, h) => sum + h.xpEarned, 0)

  return {
    completedDays,
    totalDays,
    streakDays: streak,
    topHabit: topHabitName,
    xpEarned,
    freezesUsed: user.totalFreezesUsed || 0,
  }
}

export function buildWeeklyEmailHtml(user: User): string {
  const stats = getWeeklyStats(user)
  const completionRate = stats.totalDays > 0
    ? Math.round((stats.completedDays / stats.totalDays) * 100)
    : 0

  const emoji = completionRate >= 80 ? "🔥" : completionRate >= 50 ? "💪" : "💡"
  const greeting = completionRate >= 80
    ? "Ajoyib hafta bo'ldi!"
    : completionRate >= 50
      ? "Yaxshi harakat!"
      : "Bu haftada ko'proq harakat qiling!"

  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Just Habits - Haftalik Hisobot</title>
</head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:system-ui,sans-serif;color:#e2e8f0">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="text-align:center;padding:32px 0 24px">
      <div style="font-size:48px;margin-bottom:8px">${emoji}</div>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#fff">Just Habits</h1>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:14px">Haftalik hisobot</p>
    </div>

    <!-- Greeting -->
    <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:16px;text-align:center">
      <p style="margin:0;font-size:18px;font-weight:600;color:#fff">Salom, ${user.name}! ${greeting}</p>
    </div>

    <!-- Stats grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#22c55e">${stats.completedDays}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px">Bajarilgan kunlar</div>
      </div>
      <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#f59e0b">${completionRate}%</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px">Bajarish darajasi</div>
      </div>
      <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#f97316">🔥 ${stats.streakDays}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px">Kunlik seriya</div>
      </div>
      <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#a78bfa">+${stats.xpEarned}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px">XP topildi</div>
      </div>
    </div>

    ${stats.topHabit ? `
    <!-- Top habit -->
    <div style="background:linear-gradient(135deg,#1e3a5f,#1e293b);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #3b82f6">
      <p style="margin:0 0 4px;font-size:12px;color:#60a5fa">⭐ Eng yaxshi odat</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#fff">${stats.topHabit}</p>
    </div>
    ` : ""}

    <!-- Motivation -->
    <div style="background:#1e293b;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center">
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6">
        ${completionRate >= 80
          ? "🌟 Siz top 20% foydalanuvchilar qatorida! Shunday davom eting."
          : completionRate >= 50
            ? "💪 Yarim yo'lda! Har kun biroz ko'proq harakat qiling."
            : "🌱 Boshlash qiyin, davom etish oson. Ertadan yangi boshlanish!"
        }
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://just-habits.vercel.app'}"
         style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600">
        Ilovani ochish →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#475569;font-size:12px">
      <p style="margin:0">Just Habits • Haftalik hisobot</p>
      <p style="margin:4px 0 0">Ushbu xat avtomatik yuborilgan</p>
    </div>
  </div>
</body>
</html>`
}
