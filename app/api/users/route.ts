import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { createHash } from "crypto"
import type { User } from "@/types/user"

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(password + salt).digest("hex")
}

function generateSalt(): string {
  return createHash("sha256").update(String(Date.now() + Math.random())).digest("hex").substring(0, 16)
}

// GET - barcha foydalanuvchilarni olish (leaderboard, do'stlar uchun)
export async function GET() {
  try {
    let db
    try {
      db = await getDb()
    } catch (dbErr) {
      console.error("[Users] GET - MongoDB ulanish xatosi:", dbErr)
      return NextResponse.json(
        { error: "Serverga ulanib bo'lmadi", code: "DB_CONNECT_ERROR" },
        { status: 503 }
      )
    }

    const users = await db.collection("users").find({}).toArray()
    const clean = users.map(({ _id, password, salt, ...rest }) => rest)
    return NextResponse.json(clean, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[Users] GET xato:", error)
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 })
  }
}

// POST - yangi foydalanuvchi ro'yxatdan o'tkazish
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "So'rov tanasi noto'g'ri" }, { status: 400 })
    }

    const user: User & { salt?: string } = body

    if (!user?.email || !user?.password) {
      return NextResponse.json({ error: "Email va parol kerak" }, { status: 400 })
    }

    const normalizedEmail = user.email.toLowerCase().trim()

    // MongoDB ulanish xatosi alohida qayta ishlanadi
    let db
    try {
      db = await getDb()
    } catch (dbErr) {
      console.error("[Users] POST - MongoDB ulanish xatosi:", dbErr)
      const errMsg = dbErr instanceof Error ? dbErr.message : "Noma'lum"
      return NextResponse.json(
        {
          error: "Serverga ulanib bo'lmadi. Iltimos keyinroq urinib ko'ring.",
          message: errMsg,
          code: "DB_CONNECT_ERROR"
        },
        { status: 503 }
      )
    }

    // Takror ro'yxatdan o'tishni tekshirish
    const exists = await db.collection("users").findOne({
      $or: [
        { email: normalizedEmail },
        { id: user.id },
      ],
    })

    if (exists) {
      return NextResponse.json({ error: "Bu email allaqachon ro'yxatdan o'tgan" }, { status: 409 })
    }

    // Parolni hash qilish
    const salt = generateSalt()
    const hashedPassword = hashPassword(user.password, salt)

    const userToSave = {
      ...user,
      email: normalizedEmail,
      password: hashedPassword,
      salt,
      createdAt: new Date().toISOString(),
    }

    await db.collection("users").insertOne(userToSave)

    // Parol va salt'ni qaytarmaymiz
    const { password: _pw, salt: _salt, _id, ...cleanUser } = userToSave as typeof userToSave & { _id?: unknown }
    return NextResponse.json(cleanUser, { status: 201 })

  } catch (error) {
    console.error("[Users] POST xato:", error)
    return NextResponse.json(
      {
        error: "Server xatosi",
        message: error instanceof Error ? error.message : "Noma'lum"
      },
      { status: 500 }
    )
  }
}

// PUT - foydalanuvchi ma'lumotlarini yangilash (odatlar, XP va h.k.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "So'rov tanasi noto'g'ri" }, { status: 400 })
    }

    const user = body
    if (!user?.id) {
      return NextResponse.json({ error: "User ID kerak" }, { status: 400 })
    }

    let db
    try {
      db = await getDb()
    } catch (dbErr) {
      console.error("[Users] PUT - MongoDB ulanish xatosi:", dbErr)
      return NextResponse.json(
        { error: "Serverga ulanib bo'lmadi", code: "DB_CONNECT_ERROR" },
        { status: 503 }
      )
    }

    // Mijozdan kelgan so'rovda parol/salt ni hech qachon yangilamaymiz
    const { _id, password, salt, ...updateData } = user as typeof user & { _id?: unknown; password?: string; salt?: string }

    await db.collection("users").updateOne(
      { id: user.id },
      { $set: updateData },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Users] PUT xato:", error)
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 })
  }
}
