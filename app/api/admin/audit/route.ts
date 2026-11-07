import type { NextRequest } from "next/server"
import { db } from "@/lib/prisma"
import { intParam, requireAdmin } from "@/lib/server/admin"
import { dbErrorResponse, json } from "@/lib/server/api"

// GET /api/admin/audit?action=&page= — admin amallari jurnali (faqat o'qish).
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const sp = request.nextUrl.searchParams
  const action = sp.get("action")?.trim().slice(0, 60)
  const page = intParam(sp.get("page"), 1, 1, 100_000), pageSize = intParam(sp.get("pageSize"), 25, 1, 100)
  const where = action ? { action: { startsWith: action } } : {}
  try {
    const [total, rows] = await Promise.all([
      db().auditLog.count({ where }),
      db().auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ])
    return json({
      total, page, pageSize,
      items: rows.map((r) => ({
        id: r.id, action: r.action, actorId: Number(r.actorId), actorName: r.actorName,
        targetType: r.targetType, targetId: r.targetId, meta: r.meta, createdAt: r.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    return dbErrorResponse(err, "Admin.audit")
  }
}
