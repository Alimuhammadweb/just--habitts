import type { NextRequest } from "next/server"
import { fail, json, readJson, requireSession, dbErrorResponse } from "@/lib/server/api"
import { UpdateTask, parseTaskId, toClient } from "@/lib/server/weekly-tasks"
import { db, big } from "@/lib/prisma"

type Ctx = { params: Promise<{ id: string }> }

// Har bir amalda filtrga userId qo'shiladi: boshqa foydalanuvchining vazifasi "topilmadi" (404) bo'ladi.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const id = parseTaskId((await params).id)
  if (!id) return fail(400, "ID noto'g'ri", "VALIDATION")
  const parsed = UpdateTask.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  const { completed, ...fields } = parsed.data
  try {
    const userId = big(auth.session.id)
    const existing = await db().weeklyTask.findFirst({ where: { id, userId } })
    if (!existing) return fail(404, "Vazifa topilmadi", "NOT_FOUND")

    const now = new Date()
    const data: Record<string, unknown> = { ...fields, updatedAt: now }
    if (completed !== undefined && completed !== existing.completed) {
      data.completed = completed
      data.completedAt = completed ? now : null // bajarilgan vaqt faqat holat o'zgarganda yoziladi (takroriy so'rov uni o'zgartirmaydi)
    }
    if (Object.keys(data).length === 1) return json({ task: toClient(existing) })
    const r = await db().weeklyTask.updateMany({ where: { id, userId }, data: data as never })
    if (r.count === 0) return fail(404, "Vazifa topilmadi", "NOT_FOUND")
    const updated = await db().weeklyTask.findFirst({ where: { id, userId } })
    if (!updated) return fail(404, "Vazifa topilmadi", "NOT_FOUND")
    return json({ task: toClient(updated) })
  } catch (err) {
    return dbErrorResponse(err, "WeeklyTasks.PATCH")
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const id = parseTaskId((await params).id)
  if (!id) return fail(400, "ID noto'g'ri", "VALIDATION")
  try {
    const r = await db().weeklyTask.deleteMany({ where: { id, userId: big(auth.session.id) } })
    if (r.count === 0) return fail(404, "Vazifa topilmadi", "NOT_FOUND")
    return json({ success: true })
  } catch (err) {
    return dbErrorResponse(err, "WeeklyTasks.DELETE")
  }
}
