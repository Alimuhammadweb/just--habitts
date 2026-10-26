import { type NextRequest, NextResponse } from "next/server"
import { findUserByEmail, sanitizeUser } from "@/lib/server/user-store"
import { updateUserColumns } from "@/lib/server/user-store"
import { buildEnvAdminUser, issueTokens, markLogin } from "@/lib/server/session"
import { hashPassword, verifyPassword, burnTime } from "@/lib/server/password"
import { hit, clear, clientIp } from "@/lib/server/rate-limit"

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
      const adminUser = buildEnvAdminUser()
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
    await markLogin(user.id)
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
