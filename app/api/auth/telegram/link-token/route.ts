import type { NextRequest } from "next/server"
import { createTelegramLinkToken } from "@/lib/auth"
import { newTokenId } from "@/lib/auth-refresh"
import { db, big } from "@/lib/prisma"
import { dbErrorResponse, fail, json, requireSession } from "@/lib/server/api"
import { hit } from "@/lib/server/rate-limit"
import { encodeLinkParam, telegramConfigured, telegramLaunchUrl } from "@/lib/server/telegram"

// POST /api/auth/telegram/link-token — HOZIR kirgan foydalanuvchi o'z hisobini Telegram'ga ulash havolasini oladi (middleware sessiyani tekshiradi).
// Havola Mini App'ni `startapp=l_<token>` bilan ochadi; ulash Mini App ichida, Telegram imzosi va foydalanuvchi tasdig'i bilan bajariladi.
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  if (!telegramConfigured()) return fail(501, "Telegram bilan kirish bu serverda sozlanmagan", "TELEGRAM_UNAVAILABLE")
  if (auth.session.id === 0) return fail(400, "Admin akkauntga Telegram ulanmaydi", "NOT_SUPPORTED")
  try {
    const rl = await hit(`telegram-link-token:${auth.session.id}`, 10, 10 * 60)
    if (!rl.allowed) return fail(429, "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.", "RATE_LIMITED")
  } catch { /* limiter ishlamasa to'smaymiz */ }
  try {
    const me = await db().user.findUnique({ where: { id: big(auth.session.id) }, select: { isActive: true, telegramId: true } })
    if (!me || !me.isActive) return fail(403, "Akkaunt faol emas")
    if (me.telegramId != null) return fail(409, "Telegram allaqachon ulangan", "ALREADY_LINKED")
    const jwt = await createTelegramLinkToken(auth.session.id, newTokenId())
    return json({ url: telegramLaunchUrl(encodeLinkParam(jwt)) })
  } catch (e) {
    return dbErrorResponse(e, "Telegram.linkToken")
  }
}
