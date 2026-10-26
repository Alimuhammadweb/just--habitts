import { createHash, createHmac, timingSafeEqual } from "crypto"

// Telegram Login Widget: https://core.telegram.org/widgets/login#checking-authorization
// Telegram foydalanuvchi ma'lumotlarini brauzer orqali yuboradi, shuning uchun ularni FAQAT imzo (hash) tekshirgandan keyin ishonchli deb hisoblaymiz.
// Imzo: HMAC-SHA256(data_check_string, kalit = SHA256(bot_token)). Bot tokeni faqat serverda turadi.

export const telegramBotToken = () => process.env.TELEGRAM_BOT_TOKEN || ""
export const telegramBotUsername = () => (process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "").replace(/^@/, "")
export const telegramConfigured = () => Boolean(telegramBotToken() && telegramBotUsername())

export interface TelegramAuthData {
  id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string; auth_date: number; hash: string
}
export interface TelegramIdentity { id: number; name: string; photoUrl?: string }

const MAX_AGE_SECONDS = 10 * 60 // eskirgan (qayta yuborilgan) ma'lumot qabul qilinmaydi
const ALLOWED = ["id", "first_name", "last_name", "username", "photo_url", "auth_date"] as const

export type TelegramVerifyResult = { ok: true; identity: TelegramIdentity; hash: string } | { ok: false; reason: "bad_request" | "bad_signature" | "expired" }

/** `raw` — brauzerdan kelgan obyekt. Noma'lum maydonlar e'tiborsiz qoldiriladi (imzoga kiritilmaydi). */
export function verifyTelegramAuth(raw: unknown, botToken: string, now = Date.now()): TelegramVerifyResult {
  if (!raw || typeof raw !== "object" || !botToken) return { ok: false, reason: "bad_request" }
  const d = raw as Record<string, unknown>
  const hash = typeof d.hash === "string" ? d.hash.toLowerCase() : ""
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: "bad_request" }

  const parts: string[] = []
  for (const k of ALLOWED) {
    const v = d[k]
    if (v === undefined || v === null) continue
    if (typeof v !== "string" && typeof v !== "number") return { ok: false, reason: "bad_request" }
    parts.push(`${k}=${v}`)
  }
  const checkString = parts.sort().join("\n")
  const secret = createHash("sha256").update(botToken).digest()
  const expected = createHmac("sha256", secret).update(checkString).digest()
  const given = Buffer.from(hash, "hex")
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" }

  // Imzo to'g'ri — endi qiymatlarni tekshiramiz
  const id = Number(d.id), authDate = Number(d.auth_date)
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(authDate)) return { ok: false, reason: "bad_request" }
  const age = Math.floor(now / 1000) - authDate
  if (age > MAX_AGE_SECONDS || age < -60) return { ok: false, reason: "expired" }

  const first = typeof d.first_name === "string" ? d.first_name.trim() : ""
  const last = typeof d.last_name === "string" ? d.last_name.trim() : ""
  const username = typeof d.username === "string" ? d.username.trim() : ""
  const name = ([first, last].filter(Boolean).join(" ") || username || "Telegram foydalanuvchi").slice(0, 60)
  const photoUrl = typeof d.photo_url === "string" && /^https:\/\//.test(d.photo_url) ? d.photo_url : undefined
  return { ok: true, hash, identity: { id, name, ...(photoUrl ? { photoUrl } : {}) } }
}
