import type { NextRequest } from "next/server"
import { z } from "zod"
import { db, big } from "@/lib/prisma"
import { audit, requireAdmin } from "@/lib/server/admin"
import { dbErrorResponse, fail, json, readJson } from "@/lib/server/api"
import { revokeAllRefreshTokensForUser } from "@/lib/refresh-tokens"

type Ctx = { params: Promise<{ id: string }> }

const parseId = (raw: string) => { const n = Number.parseInt(raw, 10); return Number.isSafeInteger(n) && n > 0 ? n : null }

// GET — bitta foydalanuvchi haqida batafsil (parol/xesh/tokenlar CHIQMAYDI).
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const id = parseId((await params).id)
  if (!id) return fail(404, "Foydalanuvchi topilmadi")
  try {
    const now = new Date()
    const u = await db().user.findUnique({
      where: { id: big(id) },
      select: {
        id: true, name: true, email: true, firstName: true, lastName: true, avatarUrl: true, timezone: true, createdAt: true, lastLoginAt: true,
        isActive: true, isAdmin: true, googleSub: true, telegramId: true, publicProfile: true, totalXP: true, level: true, weeklyXP: true, monthlyXP: true,
        statsCompletedDays: true, statsCurrentStreak: true, statsLongestStreak: true, pomodoroTotal: true,
        _count: { select: { habits: true, weeklyTasks: true, feedback: true, friendships: true } },
      },
    })
    if (!u) return fail(404, "Foydalanuvchi topilmadi")
    const [sessions, posts, comments, history] = await Promise.all([
      db().refreshToken.count({ where: { userId: big(id), revoked: false, expiresAt: { gt: now } } }),
      db().communityPost.count({ where: { userId: big(id) } }),
      db().comment.count({ where: { userId: big(id) } }),
      db().auditLog.findMany({ where: { targetType: "user", targetId: String(id) }, orderBy: { createdAt: "desc" }, take: 10 }),
    ])
    return json({
      id: Number(u.id), name: u.name, email: u.email, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl, timezone: u.timezone,
      createdAt: u.createdAt.toISOString(), lastLoginAt: u.lastLoginAt?.toISOString() ?? null, isActive: u.isActive, isAdmin: u.isAdmin,
      provider: u.googleSub ? "google" : u.telegramId != null ? "telegram" : "password", publicProfile: u.publicProfile,
      xp: { total: u.totalXP, level: u.level, weekly: u.weeklyXP, monthly: u.monthlyXP },
      stats: { completedDays: u.statsCompletedDays, currentStreak: u.statsCurrentStreak, longestStreak: u.statsLongestStreak, pomodoros: u.pomodoroTotal },
      counts: { habits: u._count.habits, weeklyTasks: u._count.weeklyTasks, feedback: u._count.feedback, friends: u._count.friendships, posts, comments, activeSessions: sessions },
      history: history.map((h) => ({ id: h.id, action: h.action, actorName: h.actorName, createdAt: h.createdAt.toISOString(), meta: h.meta })),
    })
  } catch (err) {
    return dbErrorResponse(err, "Admin.user")
  }
}

const Patch = z.object({ isActive: z.boolean().optional(), isAdmin: z.boolean().optional() }).strict()
  .refine((v) => v.isActive !== undefined || v.isAdmin !== undefined, "O'zgartirish uchun maydon yo'q")

// PATCH — hisobni faollashtirish/bloklash va rolni boshqarish. Har bir amal serverda tekshiriladi va jurnalga yoziladi.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const id = parseId((await params).id)
  if (!id) return fail(404, "Foydalanuvchi topilmadi")
  const parsed = Patch.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  const { isActive, isAdmin } = parsed.data

  // O'z hisobingizni bloklash yoki o'z rolingizni o'zgartirish taqiqlangan (tasodifan tizimdan chiqib ketmaslik va o'zini ko'tarmaslik uchun).
  if (id === auth.admin.id) return fail(400, "O'z hisobingizning holati yoki rolini o'zgartira olmaysiz", "SELF_FORBIDDEN")

  try {
    const target = await db().user.findUnique({ where: { id: big(id) }, select: { isActive: true, isAdmin: true, email: true } })
    if (!target) return fail(404, "Foydalanuvchi topilmadi")

    const nextAdmin = isAdmin ?? target.isAdmin
    const nextActive = isActive ?? target.isActive
    // Admin akkauntini avval oddiy foydalanuvchiga tushirmay bloklab bo'lmaydi; bloklangan akkauntni admin qilib bo'lmaydi.
    if (nextAdmin && !nextActive) return fail(409, "Admin hisobini bloklash uchun avval adminlikni olib tashlang", "ADMIN_BLOCK_FORBIDDEN")

    const changes: Record<string, { from: boolean; to: boolean }> = {}
    if (nextActive !== target.isActive) changes.isActive = { from: target.isActive, to: nextActive }
    if (nextAdmin !== target.isAdmin) changes.isAdmin = { from: target.isAdmin, to: nextAdmin }
    if (!Object.keys(changes).length) return json({ id, isActive: target.isActive, isAdmin: target.isAdmin, unchanged: true })

    await db().user.update({ where: { id: big(id) }, data: { isActive: nextActive, isAdmin: nextAdmin } })
    // Bloklangan foydalanuvchining barcha sessiyalari (refresh tokenlar) bekor qilinadi: yangi access token ololmaydi.
    if (changes.isActive && !nextActive) await revokeAllRefreshTokensForUser(id)
    // Rol o'zgarganda ham sessiyalar yangilanadi (yangi huquq bilan qayta chiqariladi; refresh rolni bazadan oladi)
    for (const [field, v] of Object.entries(changes)) {
      const action = field === "isActive" ? (v.to ? "user.activate" : "user.deactivate") : (v.to ? "user.promote_admin" : "user.demote_admin")
      await audit(auth.admin, action, { type: "user", id }, { email: target.email })
    }
    return json({ id, isActive: nextActive, isAdmin: nextAdmin })
  } catch (err) {
    return dbErrorResponse(err, "Admin.user.patch")
  }
}
