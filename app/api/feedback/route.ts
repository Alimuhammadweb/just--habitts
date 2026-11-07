import type { NextRequest } from "next/server"
import { db, big } from "@/lib/prisma"
import { dbErrorResponse, fail, json, readJson, requireSession } from "@/lib/server/api"
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
  }
}
