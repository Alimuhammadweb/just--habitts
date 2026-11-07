import type { NextRequest } from "next/server"
import { z } from "zod"
import { db, big } from "@/lib/prisma"
import { audit, requireAdmin } from "@/lib/server/admin"
import { dbErrorResponse, fail, json, readJson } from "@/lib/server/api"
import { AdminReply, FEEDBACK_STATUSES, messageToClient } from "@/lib/server/feedback"

type Ctx = { params: Promise<{ id: string }> }

// GET — suhbatni ochadi va "o'qilmagan" belgisini olib tashlaydi.
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  try {
    const { id } = await params
    const f = await db().feedback.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } }, messages: { orderBy: { createdAt: "asc" } } },
    })
    if (!f) return fail(404, "Murojaat topilmadi")
    if (f.adminUnread) await db().feedback.update({ where: { id }, data: { adminUnread: false } })
    return json({
      id: f.id, type: f.type, subject: f.subject, status: f.status, createdAt: f.createdAt.toISOString(),
      user: { id: Number(f.user.id), name: f.user.name, email: f.user.email, avatarUrl: f.user.avatarUrl },
      messages: f.messages.map(messageToClient),
    })
  } catch (err) {
    return dbErrorResponse(err, "Admin.feedback.thread")
  }
}

// POST — admin javob yozadi (ixtiyoriy: holatni ham o'zgartiradi). Foydalanuvchi buni o'z "Fikr-mulohaza" sahifasida ko'radi.
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const parsed = AdminReply.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  try {
    const { id } = await params
    const f = await db().feedback.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!f) return fail(404, "Murojaat topilmadi")
    const now = new Date()
    const nextStatus = parsed.data.status ?? (f.status === "open" ? "in_progress" : f.status)
    const [m] = await db().$transaction([
      db().feedbackMessage.create({ data: { feedbackId: id, senderRole: "admin", senderId: big(auth.admin.id), body: parsed.data.body, createdAt: now } }),
      db().feedback.update({ where: { id }, data: { userUnread: true, adminUnread: false, lastMessageAt: now, status: nextStatus } }),
    ])
    await audit(auth.admin, "feedback.reply", { type: "feedback", id }, { status: nextStatus })
    return json({ message: messageToClient(m), status: nextStatus }, 201)
  } catch (err) {
    return dbErrorResponse(err, "Admin.feedback.reply")
  }
}

const StatusBody = z.object({ status: z.enum(FEEDBACK_STATUSES) }).strict()

// PATCH — holatni o'zgartirish (ochiq / jarayonda / hal qilindi / yopildi).
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const parsed = StatusBody.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, "Holat noto'g'ri", "VALIDATION")
  try {
    const { id } = await params
    const f = await db().feedback.findUnique({ where: { id }, select: { status: true } })
    if (!f) return fail(404, "Murojaat topilmadi")
    await db().feedback.update({ where: { id }, data: { status: parsed.data.status, ...(f.status !== parsed.data.status ? { userUnread: true } : {}) } })
    await audit(auth.admin, "feedback.status", { type: "feedback", id }, { from: f.status, to: parsed.data.status })
    return json({ status: parsed.data.status })
  } catch (err) {
    return dbErrorResponse(err, "Admin.feedback.status")
  }
}
