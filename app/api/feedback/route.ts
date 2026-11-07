import type { NextRequest } from "next/server"
import { db, big } from "@/lib/prisma"
import { dbErrorResponse, fail, json, readJson, requireSession } from "@/lib/server/api"
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
  }
}
