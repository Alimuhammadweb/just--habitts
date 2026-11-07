import type { NextRequest } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { requireAdmin } from "@/lib/server/admin"
import { fail, json, readJson, dbErrorResponse } from "@/lib/server/api"
import { listAllUsers, sanitizeUser, createUserRecord, updateUserColumns } from "@/lib/server/user-store"
import { db, big, prismaCode, newNumericId } from "@/lib/prisma"
import { hashPassword, passwordProblems } from "@/lib/server/password"
import { hit, clientIp } from "@/lib/server/rate-limit"
import { isValidTimezone } from "@/lib/dates"
import type { User } from "@/types/user"

// GET - faqat admin paneli uchun to'liq ro'yxat. Oddiy foydalanuvchilar uchun /api/leaderboard va /api/friends bor.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request) // adminlik HAR SAFAR bazadan tasdiqlanadi
  if ("response" in auth) return auth.response
  try {
    const users = await listAllUsers()
    return json(users.map((u) => sanitizeUser(u)))
  } catch (err) {
    return dbErrorResponse(err, "Users.GET")
  }
}

const Register = z.object({
  name: z.string().trim().min(1, "Ism kiritilishi shart").max(60),
  email: z.string().trim().toLowerCase().email("Email noto'g'ri").max(254),
  password: z.string().max(128),
  timezone: z.string().max(64).optional(),
})

// POST - ro'yxatdan o'tish. Hujjat to'liq SERVERDA quriladi: mijoz faqat ism, email, parol (va vaqt zonasi) yuboradi.
// (Avval mijoz yuborgan butun obyekt saqlanardi - jumladan isAdmin va xpData.)
export async function POST(request: NextRequest) {
  const parsed = Register.safeParse(await readJson(request))
  if (!parsed.success) {
    return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  }
  const { name, email, password, timezone } = parsed.data
  const problems = passwordProblems(password)
  if (problems.length) return fail(400, `Parol talablari: ${problems.join(", ")}`, "WEAK_PASSWORD")
  if (email === (process.env.ADMIN_EMAIL || "admin@mail.com").toLowerCase()) return fail(409, "Bu email band", "EMAIL_TAKEN")

  try {
    try {
      const rl = await hit(`register:${clientIp(request.headers)}`, 10, 60 * 60)
      if (!rl.allowed) return fail(429, "Juda ko'p urinish. Keyinroq qayta urinib ko'ring.", "RATE_LIMITED")
    } catch { /* limiter ishlamasa to'smaymiz */ }

    if (await db().user.findUnique({ where: { email }, select: { id: true } })) return fail(409, "Bu email allaqachon ro'yxatdan o'tgan", "EMAIL_TAKEN")

    const now = Date.now()
    const doc: Omit<User, "password"> & { password: string } = {
      id: newNumericId(),
      name, email, password: hashPassword(password),
      createdAt: new Date(now).toISOString(),
      isActive: true, isAdmin: false,
      ...(isValidTimezone(timezone) ? { timezone } : {}),
      habits: [], stats: { totalHabits: 0, completedDays: 0, currentStreak: 0, longestStreak: 0 },
      pomodoroData: { sessions: [], totalPomodoros: 0 },
      xpData: { totalXP: 0, level: 1, rank: null, weeklyXP: 0, monthlyXP: 0, xpHistory: [], currentXP: 0, lastUpdated: now },
      publicProfile: false,
      unlockedAvatars: [], unlockedThemes: [], unlockedBadges: [], unlockedBorders: [], unlockedFrames: [], unlockedBackgrounds: [],
      completedTasks: [], plannedHabits: [], streakFreezes: 1, totalFreezesUsed: 0,
      friends: [], friendRequests: [], sentRequests: [],
    }
    await createUserRecord(doc as never)
    return json(sanitizeUser(doc as never), 201)
  } catch (err) {
    if (prismaCode(err) === "P2002") return fail(409, "Bu email allaqachon ro'yxatdan o'tgan", "EMAIL_TAKEN")
    return dbErrorResponse(err, "Users.POST")
  }
}

// PUT - faqat profil maydonlari. XP, odatlar, chelenjlar, ochilgan mukofotlar, rol va parol bu yerda O'ZGARTIRILMAYDI;
// ular maxsus server endpointlari orqali (habits/status, challenges, pomodoro) boshqariladi.
const url = z.string().max(300_000).refine((v) => /^https?:\/\//.test(v) || /^\/[^/]/.test(v) || /^data:image\/(png|jpeg|webp|gif);base64,/.test(v), "Avatar manzili noto'g'ri")
const short = z.string().max(60)
const PlannedHabit = z.object({
  id: z.number().int(), name: z.string().trim().min(1).max(100), why: z.string().max(500).optional(), duration: z.number().int().min(1).max(365),
  days: z.record(z.any()).optional(), missReasons: z.record(z.any()).optional(), dayLocks: z.record(z.any()).optional(),
  time: z.object({ hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59) }).nullable(),
  notifications: z.boolean(),
  startDate: z.object({ day: z.number(), month: z.number(), year: z.number(), timestamp: z.number() }),
  scheduledStartTime: z.number().optional(),
}).transform((h) => ({ ...h, days: {}, dayLocks: {}, missReasons: {} }))

const ProfileUpdate = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  avatarUrl: z.union([z.literal(""), url]).optional(), // "" = rasmni olib tashlash
  publicProfile: z.boolean().optional(),
  timezone: z.string().refine(isValidTimezone, "Vaqt zonasi noto'g'ri").optional(),
  selectedTheme: short.optional(), selectedBadge: short.optional(), selectedBorder: short.optional(),
  selectedFrame: short.optional(), selectedBackground: short.optional(),
  plannedHabits: z.array(PlannedHabit).max(50).optional(),
}).strict()

export async function PUT(request: NextRequest) {
  const session = getSession(request)
  if (!session) return fail(401, "Avtorizatsiyadan o'tilmagan", "UNAUTHORIZED")
  const body = (await readJson(request)) as Record<string, unknown> | null
  if (!body || typeof body !== "object") return fail(400, "So'rov tanasi noto'g'ri")

  try {
    // Eslatma: boshqa foydalanuvchini tahrirlash (bloklash, rol) endi faqat /api/admin/users/[id] orqali — u yerda
    // adminlik bazadan tasdiqlanadi va amal jurnalga yoziladi. Bu endpoint FAQAT o'z profilingiz uchun.
    // Mijoz boshqa maydonlarni (id, xpData, habits, ...) yuborgan bo'lsa jimgina e'tiborsiz qoldiramiz -
    // eski mijoz versiyalari butun obyektni yuborishi mumkin - faqat ruxsat etilganlarini olamiz.
    const allowedKeys = Object.keys(ProfileUpdate.shape)
    const picked = Object.fromEntries(Object.entries(body).filter(([k, v]) => allowedKeys.includes(k) && v !== undefined))
    const parsed = ProfileUpdate.safeParse(picked)
    if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
    if (!Object.keys(parsed.data).length) return json({ success: true })
    if (session.id === 0) return json({ success: true }) // admin akkaunt bazada yo'q

    const { plannedHabits, ...cols } = parsed.data
    await updateUserColumns(session.id, {
      ...cols,
      ...(cols.avatarUrl === "" ? { avatarUrl: null } : {}),
      ...(plannedHabits !== undefined ? { plannedHabits: plannedHabits as never } : {}),
    })
    return json({ success: true })
  } catch (err) {
    return dbErrorResponse(err, "Users.PUT")
  }
}
