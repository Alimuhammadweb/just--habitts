import { type NextRequest, NextResponse } from "next/server"
import { findUserByEmail, sanitizeUser } from "@/lib/server/user-store"
import { updateUserColumns } from "@/lib/server/user-store"
import { hashPassword, verifyPassword, burnTime } from "@/lib/server/password"
import { hit, clear, clientIp } from "@/lib/server/rate-limit"
import type { User } from "@/types/user"
import {
  createAccessToken,
  createRefreshToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
} from "@/lib/auth"
import { newTokenId } from "@/lib/auth-refresh"
import { storeRefreshToken } from "@/lib/refresh-tokens"

const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

async function issueTokens(res: NextResponse, id: number, isAdmin: boolean) {
  const access = await createAccessToken({ id, isAdmin })
  const jti = newTokenId()
  const refresh = await createRefreshToken({ id, isAdmin }, jti)
  // Admin (id 0) bazada saqlanmagani uchun refresh tokenini ham
  // DB'ga yozmaymiz - faqat imzosi orqali tekshiriladi.
  if (id !== 0) {
    await storeRefreshToken(jti, id, refresh, REFRESH_MAX_AGE_SECONDS)
  }
  res.cookies.set(ACCESS_COOKIE, access, ACCESS_COOKIE_OPTIONS)
  res.cookies.set(REFRESH_COOKIE, refresh, REFRESH_COOKIE_OPTIONS)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)

    if (!body) {
      return NextResponse.json({ error: "So'rov tanasi noto'g'ri" }, { status: 400 })
    }

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: "Email va parol kiritilishi shart" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Admin tekshiruvi
    // Productionda admin faqat ADMIN_EMAIL va ADMIN_PASSWORD o'rnatilgan bo'lsa ishlaydi (standart parol yo'q).
    const adminConfigured = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD)
    const adminAllowed = adminConfigured || process.env.NODE_ENV !== "production"
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@mail.com").toLowerCase().trim()
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123"

    // Brute-force'dan himoya: email+IP bo'yicha 15 daqiqada 10 ta urinish
    const limiterKey = `login:${normalizedEmail}:${clientIp(request.headers)}`
    try {
      const rl = await hit(limiterKey, 10, 15 * 60)
      if (!rl.allowed) return NextResponse.json({ error: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urinib ko'ring.", code: "RATE_LIMITED" }, { status: 429 })
    } catch { /* limiter ishlamasa, kirishni to'smaymiz */ }

    if (adminAllowed && normalizedEmail === adminEmail && password === adminPassword) {
      const adminUser: User = {
        id: 0, name: "Admin", email: adminEmail, password: "",
        createdAt: new Date().toISOString(), isActive: true, isAdmin: true,
        habits: [], stats: { totalHabits: 0, completedDays: 0, currentStreak: 0, longestStreak: 0 },
        pomodoroData: { sessions: [], totalPomodoros: 0 },
        xpData: { totalXP: 0, level: 1, rank: null, weeklyXP: 0, monthlyXP: 0, xpHistory: [], currentXP: 0, lastUpdated: Date.now() },
        publicProfile: false, unlockedAvatars: [], unlockedThemes: [], unlockedBadges: [],
        unlockedBorders: [], unlockedFrames: [], unlockedBackgrounds: [],
        completedTasks: [], plannedHabits: [], streakFreezes: 3, totalFreezesUsed: 0,
        friends: [], friendRequests: [], sentRequests: [],
      }
      const res = NextResponse.json(adminUser)
      await issueTokens(res, 0, true)
      return res
    }

    let user
    try {
      user = await findUserByEmail(normalizedEmail)
    } catch (dbErr) {
      console.error("[Auth] Ma'lumotlar bazasiga ulanish xatosi:", dbErr)
      if (/does not exist|P2021/i.test(String((dbErr as Error)?.message) + String((dbErr as { code?: string })?.code))) {
        console.error("[DB] Jadvallar topilmadi — migratsiya qo'llanmagan. `npm run db:migrate` ni ishga tushiring.")
      }
      return NextResponse.json({ error: "Serverga ulanib bo'lmadi", code: "DB_CONNECT_ERROR" }, { status: 503 })
    }

    if (!user) {
      burnTime(password) // vaqt bo'yicha foydalanuvchi mavjudligini sezdirmaslik
      return NextResponse.json({ error: "Email yoki parol noto'g'ri" }, { status: 401 })
    }

    if (user.isActive === false) {
      return NextResponse.json({ error: "Akkaunt bloklangan" }, { status: 403 })
    }

    // Parol tekshiruvi: scrypt, eski sha256+salt yoki eski oddiy matn. Eski formatlar kirishda scrypt'ga o'tkaziladi.
    const check = verifyPassword(password, { password: user.password, salt: user.salt })
    const passwordMatch = check.valid
    if (passwordMatch && check.needsUpgrade) {
      try {
        await updateUserColumns(user.id, { password: hashPassword(password), salt: null })
      } catch (upgradeErr) {
        console.warn("[Auth] Parolni yangilab bo'lmadi:", upgradeErr)
      }
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: "Email yoki parol noto'g'ri" }, { status: 401 })
    }

    // Parol va salt'ni mijozga yubormaymiz
    const cleanUser = sanitizeUser(user)
    clear(limiterKey)

    const res = NextResponse.json(cleanUser)
    await issueTokens(res, user.id, Boolean(user.isAdmin))
    return res

  } catch (error) {
    console.error("[Auth] Login xato:", error)
    return NextResponse.json(
      {
        error: "Server xatosi",
        code: "SERVER_ERROR"
      },
      { status: 500 }
    )
  }
}
