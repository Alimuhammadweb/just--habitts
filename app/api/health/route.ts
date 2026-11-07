import { NextResponse } from "next/server"
import { db } from "@/lib/prisma"

// Qaysi kod Vercel'da ishlayotganini bilish uchun: bu belgi javobda ko'rinmasa, eski/boshqa deploy ishlayapti.
const BUILD = { build: "fix-2026-11-07-profile-telegram-405", commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null }

export async function GET() {
  const startTime = Date.now()

  // Ulanish manzili va parol HECH QACHON javobga chiqarilmaydi — faqat sozlanganmi yoki yo'q
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      ...BUILD, status: "error",
      error: "DATABASE_URL sozlanmagan!",
      fix: "Vercel Dashboard > Project > Settings > Environment Variables > DATABASE_URL qo'shing",
    }, { status: 503 })
  }

  try {
    await db().$queryRaw`SELECT 1`
    return NextResponse.json({
      ...BUILD, status: "ok",
      message: "PostgreSQL ulanishi muvaffaqiyatli!",
      responseTime: `${Date.now() - startTime}ms`,
    })
  } catch (err) {
    console.error("[Health] DB xatosi:", err)
    return NextResponse.json({
      ...BUILD, status: "error",
      error: "PostgreSQL ga ulanib bo'lmadi",
      responseTime: `${Date.now() - startTime}ms`,
      suggestions: [
        "DATABASE_URL Vercel Environment Variables da to'g'rimi? (Production uchun belgilanganmi?)",
        "Bazada migratsiyalar qo'llanganmi? (prisma migrate deploy)",
        "Provayder (Neon/Supabase/...) bazasi ishlayaptimi va tashqi ulanishga ruxsat berilganmi?",
        "Foydalanuvchi nomi/parol to'g'rimi? Pooler ishlatilsa, pooled manzil kiritilganmi?",
      ],
    }, { status: 503 })
  }
}
