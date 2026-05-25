import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

export async function GET() {
  const startTime = Date.now()

  const mongoUri = process.env.MONGODB_URI || ""
  const hasUri = !!mongoUri
  // Parolni yashirish
  const uriPreview = mongoUri
    ? mongoUri.replace(/:[^:@]+@/, ":***@")
    : "YO'Q - Vercel Environment Variables ga qo'shing!"

  if (!hasUri) {
    return NextResponse.json({
      status: "error",
      error: "MONGODB_URI Vercel da sozlanmagan!",
      fix: "Vercel Dashboard > Project > Settings > Environment Variables > MONGODB_URI qo'shing",
      uriPreview,
    }, { status: 503 })
  }

  try {
    const db = await getDb()
    await db.command({ ping: 1 })
    const ms = Date.now() - startTime

    return NextResponse.json({
      status: "ok",
      message: "MongoDB ulanish muvaffaqiyatli!",
      database: db.databaseName,
      responseTime: `${ms}ms`,
      uriPreview,
    })
  } catch (err) {
    const ms = Date.now() - startTime
    const message = err instanceof Error ? err.message : "Noma'lum xato"

    return NextResponse.json({
      status: "error",
      error: "MongoDB ga ulanib bo'lmadi",
      message,
      uriPreview,
      responseTime: `${ms}ms`,
      suggestions: [
        "MongoDB Atlas > Network Access > 0.0.0.0/0 qo'shilganmi?",
        "MONGODB_URI Vercel Environment Variables da to'g'rimi?",
        "Atlas cluster ishlayaptimi? (Paused holatda emas?)",
        "Username/password to'g'rimi?",
      ],
    }, { status: 503 })
  }
}
