import type { NextRequest } from "next/server"
import { fail, json, readJson, requireSession, dbErrorResponse } from "@/lib/server/api"
import { CreateTask, LIMITS, dateKey, timezoneOf, toClient } from "@/lib/server/weekly-tasks"
import { diffDays, todayKey } from "@/lib/dates"
import { db, big } from "@/lib/prisma"

// GET /api/weekly-tasks?from=YYYY-MM-DD&to=YYYY-MM-DD  yoki  ?overdue=1
// Faqat joriy foydalanuvchining vazifalari qaytariladi (userId sessiyadan olinadi, so'rovdan emas).
export async function GET(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const sp = request.nextUrl.searchParams
  try {
    const userId = big(auth.session.id)

    if (sp.get("overdue") === "1") {
      const tz = await timezoneOf(auth.session.id)
      const now = Date.now()
      const today = todayKey(tz, now)
      const nowHM = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(now))
      // Kechikkan: bajarilmagan va (sana o'tgan YOKI bugun va vaqti o'tgan)
      const rows = await db().weeklyTask.findMany({
        where: {
          userId, completed: false,
          OR: [{ date: { lt: today } }, { date: today, time: { not: null, lt: nowHM } }],
        },
        orderBy: [{ date: "desc" }, { time: { sort: "desc", nulls: "last" } }],
        take: LIMITS.overdue,
      })
      return json({ tasks: rows.map(toClient), today })
    }

    const from = dateKey.safeParse(sp.get("from")), to = dateKey.safeParse(sp.get("to"))
    if (!from.success || !to.success) return fail(400, "from va to (YYYY-MM-DD) kerak", "VALIDATION")
    const span = diffDays(from.data, to.data)
    if (span < 0 || span > LIMITS.maxRangeDays) return fail(400, `Oraliq 0..${LIMITS.maxRangeDays} kun bo'lishi kerak`, "VALIDATION")
    const rows = await db().weeklyTask.findMany({
      where: { userId, date: { gte: from.data, lte: to.data } },
      orderBy: [{ date: "asc" }, { time: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      take: 2000,
    })
    const tz = await timezoneOf(auth.session.id)
    return json({ tasks: rows.map(toClient), today: todayKey(tz) })
  } catch (err) {
    return dbErrorResponse(err, "WeeklyTasks.GET")
  }
}

export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  if (auth.session.id <= 0) return fail(403, "Admin akkaunt uchun reja mavjud emas")
  const parsed = CreateTask.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  const t = parsed.data
  try {
    const userId = big(auth.session.id)
    const [total, sameDay] = await Promise.all([
      db().weeklyTask.count({ where: { userId } }),
      db().weeklyTask.count({ where: { userId, date: t.date } }),
    ])
    if (total >= LIMITS.perUser) return fail(409, "Vazifalar soni chegaradan oshdi", "LIMIT")
    if (sameDay >= LIMITS.perDay) return fail(409, `Bir kunga ${LIMITS.perDay} tadan ortiq vazifa qo'shib bo'lmaydi`, "LIMIT")
    const row = await db().weeklyTask.create({ data: { userId, ...t } })
    return json({ task: toClient(row) }, 201)
  } catch (err) {
    return dbErrorResponse(err, "WeeklyTasks.POST")
  }
}
