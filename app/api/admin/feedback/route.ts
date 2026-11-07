import type { NextRequest } from "next/server"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/prisma"
import { intParam, requireAdmin } from "@/lib/server/admin"
import { dbErrorResponse, json } from "@/lib/server/api"
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, messageToClient } from "@/lib/server/feedback"

// GET /api/admin/feedback?status=&type=&q=&unread=1&page=
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const sp = request.nextUrl.searchParams
  const status = sp.get("status"), type = sp.get("type"), q = sp.get("q")?.trim()
  const page = intParam(sp.get("page"), 1, 1, 10_000), pageSize = intParam(sp.get("pageSize"), 20, 1, 100)
  const where: Prisma.FeedbackWhereInput = {
    ...((FEEDBACK_STATUSES as readonly string[]).includes(status ?? "") ? { status: status! } : {}),
    ...((FEEDBACK_TYPES as readonly string[]).includes(type ?? "") ? { type: type! } : {}),
    ...(sp.get("unread") === "1" ? { adminUnread: true } : {}),
    ...(q ? { OR: [
      { subject: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ] } : {}),
  }
  try {
    const [total, rows, counts] = await Promise.all([
      db().feedback.count({ where }),
      db().feedback.findMany({
        where, orderBy: { lastMessageAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { messages: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
      db().feedback.groupBy({ by: ["status"], _count: { _all: true } }),
    ])
    return json({
      total, page, pageSize,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      items: rows.map((f) => ({
        id: f.id, type: f.type, subject: f.subject, status: f.status, adminUnread: f.adminUnread,
        createdAt: f.createdAt.toISOString(), lastMessageAt: f.lastMessageAt.toISOString(), messageCount: f._count.messages,
        user: { id: Number(f.user.id), name: f.user.name, email: f.user.email },
        lastMessage: f.messages[0] ? messageToClient(f.messages[0]) : null,
      })),
    })
  } catch (err) {
    return dbErrorResponse(err, "Admin.feedback")
  }
}
