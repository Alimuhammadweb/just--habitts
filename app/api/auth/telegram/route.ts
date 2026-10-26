import { NextResponse, type NextRequest } from "next/server"
import { fail, readJson } from "@/lib/server/api"
import { hit, clientIp } from "@/lib/server/rate-limit"
import { findUserById, sanitizeUser } from "@/lib/server/user-store"
import { issueTokens, markLogin } from "@/lib/server/session"
import { telegramBotToken, telegramConfigured, verifyTelegramAuth } from "@/lib/server/telegram"
import { resolveTelegramLogin } from "@/lib/server/telegram-account"

// POST /api/auth/telegram — Telegram Login Widget ma'lumotlari (id, first_name, …, auth_date, hash).
// Brauzerdan kelgan hamma narsa shubhali: avval imzo (bot tokeni bilan HMAC) va yangiligi tekshiriladi, keyingina hisob ochiladi/topiladi.
export async function POST(request: NextRequest) {
  if (!telegramConfigured()) return fail(501, "Telegram bilan kirish bu serverda sozlanmagan", "TELEGRAM_UNAVAILABLE")
  try {
    const rl = await hit(`telegram:${clientIp(request.headers)}`, 30, 10 * 60)
    if (!rl.allowed) return fail(429, "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.", "RATE_LIMITED")
  } catch { /* limiter ishlamasa to'smaymiz */ }

  const v = verifyTelegramAuth(await readJson(request), telegramBotToken())
  if (!v.ok) return fail(v.reason === "bad_request" ? 400 : 401, v.reason === "expired" ? "Telegram tasdig'i eskirgan. Qaytadan urinib ko'ring." : "Telegram ma'lumotlari tasdiqlanmadi", "TELEGRAM_INVALID")

  // Bir xil imzoni ikkinchi marta ishlatib bo'lmaydi (tutib olingan so'rovni qayta yuborishdan himoya)
  try {
    const replay = await hit(`telegram-hash:${v.hash}`, 1, 10 * 60)
    if (!replay.allowed) return fail(401, "Bu tasdiq allaqachon ishlatilgan. Qaytadan urinib ko'ring.", "TELEGRAM_REPLAY")
  } catch { /* limiter ishlamasa to'smaymiz */ }

  try {
    const r = await resolveTelegramLogin(v.identity)
    if (!r.ok) return r.error === "blocked" ? fail(403, "Bu akkaunt bloklangan") : fail(409, "Telegram bilan kirib bo'lmadi. Qayta urinib ko'ring.", "TELEGRAM_FAILED")
    const user = await findUserById(r.id)
    if (!user) return fail(500, "Foydalanuvchi topilmadi")
    await markLogin(r.id)
    const res = NextResponse.json(sanitizeUser(user), { status: r.created ? 201 : 200 })
    await issueTokens(res, r.id, r.isAdmin)
    return res
  } catch (e) {
    console.error("[Telegram] kirish xatosi:", e)
    return fail(500, "Server xatosi", "SERVER_ERROR")
  }
}
