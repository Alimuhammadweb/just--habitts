import type { NextRequest } from "next/server"
import { db } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server/admin"
import { dbErrorResponse, json } from "@/lib/server/api"

const DAY = 86_400_000
const ymd = (d: Date) => d.toISOString().slice(0, 10)

// GET /api/admin/overview — bazadagi HAQIQIY ma'lumotlardan yig'ilgan umumiy ko'rsatkichlar.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  try {
    const now = Date.now()
    const d1 = new Date(now - DAY), d7 = new Date(now - 7 * DAY), d30 = new Date(now - 30 * DAY)
    const startToday = new Date(); startToday.setUTCHours(0, 0, 0, 0)
    const weekAgoKey = ymd(d7)

    const [
      totalUsers, activeUsers, admins, googleUsers, newToday, new7, new30, recent, regRows,
      habits, habitDays, xp7, pom7, tasksTotal, tasksDone,
      posts, comments, reactions, fbOpen, fbUnread, login24, login7,
    ] = await Promise.all([
      db().user.count(),
      db().user.count({ where: { isActive: true } }),
      db().user.count({ where: { isAdmin: true } }),
      db().user.count({ where: { googleSub: { not: null } } }),
      db().user.count({ where: { createdAt: { gte: startToday } } }),
      db().user.count({ where: { createdAt: { gte: d7 } } }),
      db().user.count({ where: { createdAt: { gte: d30 } } }),
      db().user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, email: true, createdAt: true, isActive: true, googleSub: true, telegramId: true } }),
      db().$queryRaw<{ d: Date; c: bigint }[]>`SELECT date_trunc('day', "createdAt") AS d, count(*) AS c FROM "User" WHERE "createdAt" >= ${new Date(now - 13 * DAY)} GROUP BY 1`,
      db().habit.count(),
      db().habitDay.groupBy({ by: ["status"], _count: { _all: true }, where: { status: { not: null } } }),
      db().xpHistory.aggregate({ _sum: { xpEarned: true }, _count: { _all: true }, where: { timestamp: { gte: BigInt(now - 7 * DAY) } } }),
      db().pomodoroSession.aggregate({ _sum: { count: true }, where: { date: { gte: weekAgoKey } } }),
      db().weeklyTask.count(),
      db().weeklyTask.count({ where: { completed: true } }),
      db().communityPost.count(), db().comment.count(), db().reaction.count(),
      db().feedback.count({ where: { status: { in: ["open", "in_progress"] } } }),
      db().feedback.count({ where: { adminUnread: true } }),
      // "Faol" = oxirgi N soatda tizimga kirgan yoki sessiyasini yangilagan (refresh token yozuvlari; ilova ochiq tursa ~15 daqiqada yangilanadi)
      db().refreshToken.findMany({ where: { createdAt: { gte: d1 } }, distinct: ["userId"], select: { userId: true } }),
      db().refreshToken.findMany({ where: { createdAt: { gte: d7 } }, distinct: ["userId"], select: { userId: true } }),
    ])

    const byDay = new Map(regRows.map((r) => [ymd(new Date(r.d)), Number(r.c)]))
    const registrations = Array.from({ length: 14 }, (_, i) => { const k = ymd(new Date(now - (13 - i) * DAY)); return { date: k, count: byDay.get(k) ?? 0 } })
    const hd = Object.fromEntries(habitDays.map((x) => [x.status ?? "none", x._count._all]))

    return json({
      generatedAt: new Date(now).toISOString(),
      users: { total: totalUsers, active: activeUsers, inactive: totalUsers - activeUsers, admins, google: googleUsers, newToday, new7, new30, active24h: login24.length, active7d: login7.length },
      registrations,
      recent: recent.map((u) => ({ id: Number(u.id), name: u.name, email: u.email, createdAt: u.createdAt.toISOString(), isActive: u.isActive, provider: u.googleSub ? "google" : u.telegramId != null ? "telegram" : "password" })),
      usage: {
        habits, completedDays: hd.completed ?? 0, partialDays: hd.partial ?? 0, missedDays: hd.missed ?? 0,
        xpEvents7d: xp7._count._all, xp7d: xp7._sum.xpEarned ?? 0, pomodoros7d: pom7._sum.count ?? 0,
        weeklyTasks: tasksTotal, weeklyTasksDone: tasksDone,
      },
      community: { posts, comments, reactions },
      feedback: { open: fbOpen, unread: fbUnread },
    })
  } catch (err) {
    return dbErrorResponse(err, "Admin.overview")
  }
}
