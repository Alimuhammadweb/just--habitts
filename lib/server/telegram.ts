import { createHmac, timingSafeEqual } from "crypto"

// Telegram Mini App autentifikatsiyasi: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Mini App ochilganda Telegram `initData` (URL-kodlangan satr) beradi. Brauzerdan kelgan har qanday qiymat shubhali:
// foydalanuvchi FAQAT imzo (hash) serverda tekshirilgandan keyin ishonchli hisoblanadi. `initDataUnsafe` HECH QACHON isbot emas.
//   secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
//   hash       = hex(HMAC_SHA256(key = secret_key, data = data_check_string))
//   data_check_string = `hash`dan boshqa BARCHA maydonlar (jumladan `signature`), kalit bo'yicha saralangan, "key=value" qatorlari "\n" bilan.
// Bot tokeni faqat serverda turadi (NEXT_PUBLIC_ bilan boshlanmaydi).

export const telegramBotToken = () => process.env.TELEGRAM_BOT_TOKEN || ""
// Faqat username kerak, lekin `@JustHabittsBot` yoki `https://t.me/JustHabittsBot` yozib yuborilsa ham to'g'ri ajratib olamiz.
export const telegramBotUsername = () =>
  (process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "")
    .trim().replace(/^(https?:\/\/)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "").split(/[/?#]/)[0]
export const telegramConfigured = () => Boolean(telegramBotToken() && telegramBotUsername())

/** initData qancha vaqt yaroqli (auth_date'dan boshlab). Standart 24 soat; TELEGRAM_INITDATA_MAX_AGE_SECONDS bilan o'zgartiriladi (60 s … 7 kun). */
export const telegramInitDataMaxAge = () => {
  const n = Number(process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS)
  return Number.isFinite(n) && n >= 60 ? Math.min(Math.floor(n), 7 * 24 * 3600) : 24 * 3600
}

export interface TelegramIdentity { id: number; name: string; photoUrl?: string }
/** Mini App'dan olingan tasdiqlangan foydalanuvchi. Username, familiya va rasm har doim ham bo'lavermaydi. */
export interface TelegramMiniAppIdentity extends TelegramIdentity {
  firstName?: string; lastName?: string; username?: string; languageCode?: string
}

export type TelegramVerifyResult =
  | { ok: true; identity: TelegramMiniAppIdentity; authDate: number; startParam?: string }
  | { ok: false; reason: "bad_request" | "bad_signature" | "expired" }

const MAX_INITDATA_LENGTH = 8192
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

/** `raw` — brauzer yuborgan xom `initData` satri (Telegram.WebApp.initData). */
export function verifyTelegramInitData(raw: unknown, botToken: string, now = Date.now(), maxAgeSeconds = telegramInitDataMaxAge()): TelegramVerifyResult {
  if (typeof raw !== "string" || !raw || raw.length > MAX_INITDATA_LENGTH || !botToken) return { ok: false, reason: "bad_request" }

  let params: URLSearchParams
  try { params = new URLSearchParams(raw) } catch { return { ok: false, reason: "bad_request" } }

  const hash = (params.get("hash") ?? "").toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: "bad_request" }

  const pairs: [string, string][] = []
  const seen = new Set<string>()
  for (const [k, v] of params) {
    if (k === "hash") continue
    if (seen.has(k)) return { ok: false, reason: "bad_request" } // takroriy kalit — noaniqlik, rad etamiz
    seen.add(k)
    pairs.push([k, v])
  }
  const checkString = pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\n")

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest()
  const expected = createHmac("sha256", secret).update(checkString).digest()
  const given = Buffer.from(hash, "hex")
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" }

  // Imzo to'g'ri — endi qiymatlarni tekshiramiz (hammasi Telegram imzolagan, lekin shakli noto'g'ri bo'lishi mumkin)
  const authDate = Number(params.get("auth_date"))
  if (!Number.isSafeInteger(authDate) || authDate <= 0) return { ok: false, reason: "bad_request" }
  const age = Math.floor(now / 1000) - authDate
  if (age > maxAgeSeconds || age < -60) return { ok: false, reason: "expired" }

  let u: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(params.get("user") ?? "")
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "bad_request" }
    u = parsed as Record<string, unknown>
  } catch { return { ok: false, reason: "bad_request" } }

  const id = u.id
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || u.is_bot === true) return { ok: false, reason: "bad_request" }

  const firstName = clean(u.first_name, 64)
  const lastName = clean(u.last_name, 64)
  const rawUsername = clean(u.username, 64)
  const username = /^[A-Za-z0-9_]{1,64}$/.test(rawUsername) ? rawUsername : ""
  const rawLang = clean(u.language_code, 12)
  const languageCode = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})?$/.test(rawLang) ? rawLang.toLowerCase() : ""
  const photoUrl = typeof u.photo_url === "string" && /^https:\/\//.test(u.photo_url) && u.photo_url.length <= 1000 ? u.photo_url : ""
  const name = ([firstName, lastName].filter(Boolean).join(" ") || username || "Telegram foydalanuvchi").slice(0, 60)

  const sp = params.get("start_param")
  const startParam = sp && sp.length <= 512 && /^[A-Za-z0-9_-]+$/.test(sp) ? sp : undefined

  return {
    ok: true, authDate, ...(startParam ? { startParam } : {}),
    identity: {
      id, name,
      ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}), ...(username ? { username } : {}),
      ...(languageCode ? { languageCode } : {}), ...(photoUrl ? { photoUrl } : {}),
    },
  }
}

// ── Mavjud hisobni Telegram'ga ulash uchun start_param ──
// Profil sahifasidagi kirgan foydalanuvchi uchun imzolangan, qisqa muddatli bir martalik token yaratiladi va Mini App
// havolasiga `startapp=l_<token>` sifatida qo'shiladi. start_param initData ichida Telegram imzosi bilan keladi — soxtalashtirib bo'lmaydi.
// startapp faqat A-Z a-z 0-9 _ - belgilarini qabul qiladi, JWT esa nuqta ishlatadi, shuning uchun base64url'ga o'raymiz.
export const LINK_PARAM_PREFIX = "l_"
export const encodeLinkParam = (jwt: string) => LINK_PARAM_PREFIX + Buffer.from(jwt, "utf8").toString("base64url")
export function decodeLinkParam(param: string | undefined): string | null {
  if (!param || !param.startsWith(LINK_PARAM_PREFIX)) return null
  const body = param.slice(LINK_PARAM_PREFIX.length)
  if (!/^[A-Za-z0-9_-]+$/.test(body)) return null
  try { return Buffer.from(body, "base64url").toString("utf8") } catch { return null }
}

/** Botning Mini App havolasi. TELEGRAM_MINIAPP_SHORT_NAME bo'lsa t.me/<bot>/<short>, bo'lmasa Asosiy Mini App (t.me/<bot>). */
export function telegramLaunchUrl(startParam?: string): string {
  const bot = telegramBotUsername()
  const short = (process.env.TELEGRAM_MINIAPP_SHORT_NAME || "").replace(/^\/+|\/+$/g, "")
  const base = short ? `https://t.me/${bot}/${short}` : `https://t.me/${bot}`
  return startParam ? `${base}?startapp=${startParam}` : base
}
