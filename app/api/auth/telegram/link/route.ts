import type { NextRequest } from "next/server"
import { fail, json, readJson, requireSession } from "@/lib/server/api"
import { hit } from "@/lib/server/rate-limit"
import { telegramBotToken, telegramConfigured, verifyTelegramAuth } from "@/lib/server/telegram"
import { linkTelegram } from "@/lib/server/telegram-account"

// POST /api/auth/telegram/link — HOZIR kirgan foydalanuvchi o'z hisobiga Telegram'ni ulaydi (middleware sessiyani tekshiradi).
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  if (!telegramConfigured()) return fail(501, "Telegram bilan kirish bu serverda sozlanmagan", "TELEGRAM_UNAVAILABLE")
  if (auth.session.id === 0) return fail(400, "Admin akkauntga Telegram ulanmaydi", "NOT_SUPPORTED")

  const v = verifyTelegramAuth(await readJson(request), telegramBotToken())
  if (!v.ok) return fail(v.reason === "bad_request" ? 400 : 401, v.reason === "expired" ? "Telegram tasdig'i eskirgan. Qaytadan urinib ko'ring." : "Telegram ma'lumotlari tasdiqlanmadi", "TELEGRAM_INVALID")
  try {
    const replay = await hit(`telegram-hash:${v.hash}`, 1, 10 * 60)
    if (!replay.allowed) return fail(401, "Bu tasdiq allaqachon ishlatilgan. Qaytadan urinib ko'ring.", "TELEGRAM_REPLAY")
  } catch { /* ruxsat */ }

  try {
    const r = await linkTelegram(auth.session.id, v.identity)
    if (!r.ok) {
      const msg = { in_use: "Bu Telegram hisobi boshqa foydalanuvchiga ulangan", already_linked: "Sizning hisobingizga boshqa Telegram ulangan", blocked: "Akkaunt faol emas" }[r.error]
      return fail(r.error === "blocked" ? 403 : 409, msg, "TELEGRAM_LINK_FAILED")
    }
    return json({ linked: true })
  } catch (e) {
    console.error("[Telegram] ulash xatosi:", e)
    return fail(500, "Server xatosi", "SERVER_ERROR")
  }
}
