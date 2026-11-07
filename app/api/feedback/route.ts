import type { NextRequest } from "next/server"
import { db, big } from "@/lib/prisma"
import { dbErrorResponse, fail, json, readJson, requireSession } from "@/lib/server/api"
<<<<<<< HEAD
import { NewFeedback, messageToClient } from "@/lib/server/feedback"
import { hit } from "@/lib/server/rate-limit"

// GET — foydalanuvchining O'Z murojaatlari. Adminlik talab qilinmaydi.
export async function GET(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  if (auth.session.id === 0) return json({ items: [], unread: 0 })
  try {
    const rows = await db().feedback.findMany({
      where: { userId: big(auth.session.id) },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: { _count: { select: { messages: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    })
    const items = rows.map((f) => ({
      id: f.id, type: f.type, subject: f.subject, status: f.status, userUnread: f.userUnread,
      createdAt: f.createdAt.toISOString(), lastMessageAt: f.lastMessageAt.toISOString(),
      messageCount: f._count.messages, lastMessage: f.messages[0] ? messageToClient(f.messages[0]) : null,
    }))
    return json({ items, unread: items.filter((i) => i.userUnread).length })
  } catch (err) {
    return dbErrorResponse(err, "Feedback.GET")
  }
}

// POST — yangi fikr / taklif / xatolik haqida xabar. Oddiy foydalanuvchi yubora oladi (admin huquqi shart EMAS).
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  if (auth.session.id === 0) return fail(400, "Admin akkaunt murojaat yubormaydi", "NOT_SUPPORTED")
  const parsed = NewFeedback.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  const { type, subject, message } = parsed.data
  try {
    try {
      const rl = await hit(`feedback:${auth.session.id}`, 5, 60 * 60)
      if (!rl.allowed) return fail(429, "Juda ko'p murojaat. Bir soatdan keyin urinib ko'ring.", "RATE_LIMITED")
    } catch { /* limiter ishlamasa to'smaymiz */ }

    const me = await db().user.findUnique({ where: { id: big(auth.session.id) }, select: { isActive: true } })
    if (!me || !me.isActive) return fail(403, "Akkaunt faol emas")

    const f = await db().feedback.create({
      data: {
        userId: big(auth.session.id), type, subject, status: "open", adminUnread: true, userUnread: false,
        messages: { create: { senderRole: "user", senderId: big(auth.session.id), body: message } },
      },
      select: { id: true },
    })
    return json({ id: f.id }, 201)
  } catch (err) {
    return dbErrorResponse(err, "Feedback.POST")
=======
import { ReplyBody, messageToClient } from "@/lib/server/feedback"
import { hit } from "@/lib/server/rate-limit"

type Ctx = { params: Promise<{ id: string }> }

// Faqat suhbat egasi. Begonaning murojaati mavjudligi ham sezdirilmaydi (404).
async function ownThread(id: string, userId: number) {
  return db().feedback.findFirst({ where: { id, userId: big(userId) }, include: { messages: { orderBy: { createdAt: "asc" } } } })
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  try {
    const { id } = await params
    const f = await ownThread(id, auth.session.id)
    if (!f) return fail(404, "Murojaat topilmadi")
    if (f.userUnread) await db().feedback.update({ where: { id: f.id }, data: { userUnread: false } })
    return json({
      id: f.id, type: f.type, subject: f.subject, status: f.status,
      createdAt: f.createdAt.toISOString(), messages: f.messages.map(messageToClient),
    })
  } catch (err) {
    return dbErrorResponse(err, "Feedback.thread")
  }
}

// POST — foydalanuvchi o'z suhbatiga javob yozadi.
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const parsed = ReplyBody.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  try {
    const { id } = await params
    const f = await ownThread(id, auth.session.id)
    if (!f) return fail(404, "Murojaat topilmadi")
    if (f.status === "closed") return fail(409, "Bu murojaat yopilgan. Yangi murojaat yuboring.", "CLOSED")
    try {
      const rl = await hit(`feedback-reply:${auth.session.id}`, 20, 60 * 60)
      if (!rl.allowed) return fail(429, "Juda ko'p xabar. Birozdan keyin urinib ko'ring.", "RATE_LIMITED")
    } catch { /* ruxsat */ }

    const now = new Date()
    const [m] = await db().$transaction([
      db().feedbackMessage.create({ data: { feedbackId: f.id, senderRole: "user", senderId: big(auth.session.id), body: parsed.data.body, createdAt: now } }),
      db().feedback.update({
        where: { id: f.id },
        // Yechilgan murojaatga foydalanuvchi javob yozsa, qayta ochiladi
        data: { adminUnread: true, lastMessageAt: now, status: f.status === "resolved" ? "open" : f.status },
      }),
    ])
    return json(messageToClient(m), 201)
  } catch (err) {
    return dbErrorResponse(err, "Feedback.reply")
>>>>>>> origin/main
  }
}
