import type { NextRequest } from "next/server"
import { z } from "zod"
import { fail, json, readJson, requireSession, dbErrorResponse } from "@/lib/server/api"
import { mutateUser, sanitizeUser } from "@/lib/server/user-store"
import { db, big } from "@/lib/prisma"

const MAX_HABITS = 100
const Time = z.object({ hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59) }).nullable()
const NewHabit = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1, "Odat nomi kerak").max(100),
  why: z.string().trim().max(500).optional(),
  duration: z.number().int().min(1).max(365),
  time: Time.default(null),
  notifications: z.boolean().default(false),
  startDate: z.object({ timestamp: z.number() }).passthrough(),
})

// POST - odat qo'shish. Natijalar (days/dayLocks/missReasons) mijozdan QABUL QILINMAYDI - har doim bo'sh boshlanadi.
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const body = (await readJson(request)) as { habit?: unknown } | null
  const parsed = NewHabit.safeParse(body?.habit)
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  const h = parsed.data

  try {
    const now = Date.now()
    // Boshlanish vaqti kelajakda bo'lmasligi va juda eski bo'lmasligi kerak (rejalashtirilgan odat ochilishi kechiksa 3 kungacha)
    const ts = Math.min(Math.max(h.startDate.timestamp, now - 3 * 86_400_000), now)
    const d = new Date(ts)
    let created: unknown = null
    let limitHit = false
    const out = await mutateUser(auth.session.id, (doc) => {
      const habits = doc.habits || []
      if (habits.length >= MAX_HABITS) { limitHit = true; return null }
      const id = h.id && !habits.some((x) => x.id === h.id) ? h.id : now * 1000 + Math.floor(Math.random() * 1000)
      if (habits.some((x) => x.name === h.name && x.startDate.timestamp === ts)) { created = habits.find((x) => x.name === h.name && x.startDate.timestamp === ts); return null } // takroriy so'rov
      const habit = {
        id, name: h.name, why: h.why ?? "", duration: h.duration, time: h.time, notifications: h.notifications,
        days: {}, dayLocks: {}, missReasons: {},
        startDate: { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(), timestamp: ts },
      }
      created = habit
      return { user: { ...doc, habits: [...habits, habit] }, result: habit }
    })
    if (limitHit) return fail(409, `Odatlar soni ${MAX_HABITS} tadan oshmasligi kerak`, "LIMIT")
    if (!out.found) return fail(404, "Foydalanuvchi topilmadi")
    return json({ success: true, habit: created, user: sanitizeUser(out.user) }, 201)
  } catch (err) {
    return dbErrorResponse(err, "Habits.POST")
  }
}

// PUT - faqat tahrirlanadigan maydonlar. Natijalarni (days, dayLocks) bu yerdan o'zgartirib bo'lmaydi.
const Edit = z.object({
  habitId: z.number().int(),
  updates: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    why: z.string().trim().max(500).optional(),
    time: Time.optional(),
    notifications: z.boolean().optional(),
  }).strict(),
})

export async function PUT(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const parsed = Edit.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, "So'rov noto'g'ri", "VALIDATION")
  const { habitId, updates } = parsed.data
  const data: Record<string, unknown> = {}
  if (updates.name !== undefined) data.name = updates.name
  if (updates.why !== undefined) data.why = updates.why
  if (updates.notifications !== undefined) data.notifications = updates.notifications
  if (updates.time !== undefined) {
    data.timeHour = updates.time ? updates.time.hour : null
    data.timeMinute = updates.time ? updates.time.minute : null
  }
  if (!Object.keys(data).length) return json({ success: true })
  try {
    const userId = big(auth.session.id)
    // rev oshiriladi: shu paytda parallel ishlayotgan mutateUser() so'rovi qayta urinadi va tahrirni ustidan yozib yubormaydi
    const count = await db().$transaction(async (tx) => {
      const r = await tx.habit.updateMany({ where: { id: big(habitId), userId }, data: data as never })
      if (r.count > 0) await tx.user.update({ where: { id: userId }, data: { rev: { increment: 1 } } })
      return r.count
    })
    if (count === 0) return fail(404, "Odat topilmadi")
    return json({ success: true })
  } catch (err) {
    return dbErrorResponse(err, "Habits.PUT")
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const body = (await readJson(request)) as { habitId?: unknown } | null
  if (typeof body?.habitId !== "number") return fail(400, "habitId kerak", "VALIDATION")
  try {
    const userId = big(auth.session.id)
    await db().$transaction(async (tx) => {
      const r = await tx.habit.deleteMany({ where: { id: big(body.habitId as number), userId } }) // HabitDay yozuvlari CASCADE bilan o'chadi
      if (r.count > 0) await tx.user.update({ where: { id: userId }, data: { rev: { increment: 1 } } })
    })
    return json({ success: true })
  } catch (err) {
    return dbErrorResponse(err, "Habits.DELETE")
  }
}
