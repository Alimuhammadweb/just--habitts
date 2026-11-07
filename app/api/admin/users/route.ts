import type { NextRequest } from "next/server"
import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/prisma"
import { intParam, requireAdmin } from "@/lib/server/admin"
import { dbErrorResponse, json } from "@/lib/server/api"

// GET /api/admin/users?q=&status=active|inactive&role=admin|user&provider=google|telegram|password&sort=newest|oldest|login|xp&page=&pageSize=
// Faqat xavfsiz maydonlar: parol, xesh, refresh token va maxfiy ma'lumotlar HECH QACHON tanlanmaydi.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const sp = request.nextUrl.searchParams
  const q = sp.get("q")?.trim().slice(0, 100)
  const status = sp.get("status"), role = sp.get("role"), provider = sp.get("provider"), sort = sp.get("sort") ?? "newest"
  const page = intParam(sp.get("page"), 1, 1, 100_000), pageSize = intParam(sp.get("pageSize"), 20, 1, 100)

  const where: Prisma.UserWhereInput = {
    ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
    ...(role === "admin" ? { isAdmin: true } : role === "user" ? { isAdmin: false } : {}),
    ...(provider === "google" ? { googleSub: { not: null } } : provider === "telegram" ? { telegramId: { not: null } } : provider === "password" ? { googleSub: null, telegramId: null } : {}),
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      ...(/^\d{1,18}$/.test(q) ? [{ id: BigInt(q) }] : []),
    ] } : {}),
  }
  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    sort === "oldest" ? [{ createdAt: "asc" }] : sort === "login" ? [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
    : sort === "xp" ? [{ totalXP: "desc" }] : [{ createdAt: "desc" }]

  try {
    const [total, rows] = await Promise.all([
      db().user.count({ where }),
      db().user.findMany({
        where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
        select: {
          id: true, name: true, email: true, createdAt: true, lastLoginAt: true, isActive: true, isAdmin: true, googleSub: true, telegramId: true,
          avatarUrl: true, totalXP: true, level: true, statsCurrentStreak: true, _count: { select: { habits: true } },
        },
      }),
    ])
    return json({
      total, page, pageSize,
      users: rows.map((u) => ({
        id: Number(u.id), name: u.name, email: u.email, createdAt: u.createdAt.toISOString(), lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        isActive: u.isActive, isAdmin: u.isAdmin, provider: u.googleSub ? "google" : u.telegramId != null ? "telegram" : "password", avatarUrl: u.avatarUrl,
        totalXP: u.totalXP, level: u.level, streak: u.statsCurrentStreak, habits: u._count.habits,
      })),
    })
  } catch (err) {
    return dbErrorResponse(err, "Admin.users")
  }
}
