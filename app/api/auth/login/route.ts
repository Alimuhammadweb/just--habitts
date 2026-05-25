import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { createHash } from "crypto"
import type { User } from "@/types/user"

// Password hashing with built-in crypto
function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(password + salt).digest("hex")
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
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@mail.com").toLowerCase().trim()
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123"

    if (normalizedEmail === adminEmail && password === adminPassword) {
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
      return NextResponse.json(adminUser)
    }

    // MongoDB ulanish
    let db
    try {
      db = await getDb()
    } catch (dbErr) {
      console.error("[Auth] MongoDB ulanish xatosi:", dbErr)
      const errMsg = dbErr instanceof Error ? dbErr.message : "Noma'lum"
      // MongoDB ulanmasa, aniq xato qaytaramiz
      return NextResponse.json(
        {
          error: "Serverga ulanib bo'lmadi",
          message: errMsg,
          code: "DB_CONNECT_ERROR"
        },
        { status: 503 }
      )
    }

    const user = await db.collection("users").findOne({ email: normalizedEmail })

    if (!user) {
      return NextResponse.json({ error: "Email yoki parol noto'g'ri" }, { status: 401 })
    }

    if (user.isActive === false) {
      return NextResponse.json({ error: "Akkaunt bloklangan" }, { status: 403 })
    }

    // Parol tekshiruvi (hash yoki plain text)
    let passwordMatch = false
    if (user.salt) {
      // Yangi hash tizimi
      passwordMatch = hashPassword(password, user.salt) === user.password
    } else {
      // Eski plain text parollar - kirish ruxsat beriladi va hash'ga o'tkaziladi
      passwordMatch = user.password === password
      if (passwordMatch) {
        try {
          const salt = createHash("sha256").update(String(Date.now() + Math.random())).digest("hex").substring(0, 16)
          const hashed = hashPassword(password, salt)
          await db.collection("users").updateOne(
            { id: user.id },
            { $set: { password: hashed, salt } }
          )
        } catch (upgradeErr) {
          // Hash'ga o'tkaza olmasak ham, kirishga ruxsat beramiz
          console.warn("[Auth] Parolni hash'ga o'tkaza olmadi:", upgradeErr)
        }
      }
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: "Email yoki parol noto'g'ri" }, { status: 401 })
    }

    // Parol va salt'ni mijozga yubormaymiz
    const { _id, password: _pw, salt: _salt, ...cleanUser } = user as typeof user & { _id?: unknown; salt?: string }
    return NextResponse.json(cleanUser)

  } catch (error) {
    console.error("[Auth] Login xato:", error)
    return NextResponse.json(
      {
        error: "Server xatosi",
        message: error instanceof Error ? error.message : "Noma'lum",
        code: "SERVER_ERROR"
      },
      { status: 500 }
    )
  }
}
