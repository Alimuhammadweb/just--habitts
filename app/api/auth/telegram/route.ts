import { NextResponse, type NextRequest } from "next/server"
import { verifyTelegramLinkToken } from "@/lib/auth"
import { db, big } from "@/lib/prisma"
import { fail, readJson } from "@/lib/server/api"
import { hit, clientIp } from "@/lib/server/rate-limit"
import { findUserById, sanitizeUser } from "@/lib/server/user-store"
import { issueTokens, markLogin } from "@/lib/server/session"
import { decodeLinkParam, telegramBotToken, telegramConfigured, verifyTelegramInitData } from "@/lib/server/telegram"
import { linkTelegram, resolveTelegramLogin } from "@/lib/server/telegram-account"

const maskEmail = (email: string) => {
  if (email.endsWith("@telegram.invalid")) return ""
  const [local, domain] = email.split("@")
  return domain ? `${local.slice(0, 1)}***@${domain}` : ""
}

// POST /api/auth/telegram — Telegram Mini App `initData` (xom satr) bilan kirish/ro'yxatdan o'tish.
//   Body: { initData: string, confirmLink?: boolean }
// Brauzerdan kelgan hamma narsa shubhali: avval imzo (bot tokeni bilan HMAC) va yangiligi tekshiriladi, keyingina hisob topiladi/ochiladi.
// Mijoz yuborgan "foydalanuvchi ma'lumotlari" (initDataUnsafe, id, ism…) bu yerda umuman o'qilmaydi — faqat imzolangan initData.
export async function POST(request: NextRequest) {
  if (!telegramConfigured()) return fail(501, "Telegram bilan kirish bu serverda sozlanmagan", "TELEGRAM_UNAVAILABLE")
  try {
    const rl = await hit(`telegram:${clientIp(request.headers)}`, 60, 10 * 60)
    if (!rl.allowed) return fail(429, "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.", "RATE_LIMITED")
  } catch { /* limiter ishlamasa to'smaymiz */ }

  const body = await readJson(request)
  const initData = body && typeof body === "object" ? (body as { initData?: unknown }).initData : undefined
  const confirmLink = Boolean(body && typeof body === "object" && (body as { confirmLink?: unknown }).confirmLink === true)

  const v = verifyTelegramInitData(initData, telegramBotToken())
  if (!v.ok) {
    console.warn(`[Telegram] initData rad etildi: ${v.reason} (uzunligi ${typeof initData === "string" ? initData.length : "yo'q"})`)
    if (v.reason === "expired") return fail(401, "Telegram tasdig'i eskirgan. Ilovani yopib, bot orqali qaytadan oching.", "TELEGRAM_EXPIRED")
    if (v.reason === "bad_signature") return fail(401, "Telegram imzosi mos kelmadi. Serverdagi TELEGRAM_BOT_TOKEN aynan shu Mini App ochilgan botniki ekanini tekshiring.", "TELEGRAM_BAD_SIGNATURE")
    return fail(400, "Telegram ma'lumotlari noto'g'ri formatda", "TELEGRAM_BAD_REQUEST")
  }

  try {
    // ── Mavjud hisobni ulash (start_param = l_<imzolangan bir martalik token>) ──
    const linkJwt = decodeLinkParam(v.startParam)
    if (linkJwt) {
      const tok = await verifyTelegramLinkToken(linkJwt)
      if (!tok) return fail(400, "Ulash havolasi yaroqsiz yoki eskirgan. Profil sahifasidan yangisini oling.", "TELEGRAM_LINK_INVALID")
      const target = await db().user.findUnique({ where: { id: big(tok.uid) }, select: { id: true, name: true, email: true, isActive: true, isAdmin: true, telegramId: true } })
      if (!target || !target.isActive) return fail(403, "Bu akkaunt faol emas", "TELEGRAM_LINK_FAILED")

      // 1-qadam: faqat ko'rsatish. Hech narsa ulanmaydi va sessiya berilmaydi — begona havola orqali sizning Telegram'ingizni
      // boshqa birovning hisobiga jimgina ulab qo'yishning oldi olinadi (foydalanuvchi qaysi hisobga ulanishini ko'rib tasdiqlaydi).
      if (!confirmLink) {
        return NextResponse.json({ linkRequest: { accountName: target.name.slice(0, 60), emailHint: maskEmail(target.email), telegramName: v.identity.name } }, { headers: { "Cache-Control": "no-store" } })
      }

      // 2-qadam: tasdiqlandi. Token bir martalik.
      const used = await hit(`telegram-link:${tok.jti}`, 1, 15 * 60)
      if (!used.allowed) return fail(409, "Bu ulash havolasi allaqachon ishlatilgan. Profil sahifasidan yangisini oling.", "TELEGRAM_LINK_USED")
      const r = await linkTelegram(tok.uid, v.identity)
      if (!r.ok) {
        const msg = { in_use: "Bu Telegram hisobi boshqa Just Habits hisobiga ulangan va unda ma'lumotlar bor. Avtomatik birlashtirilmaydi.", already_linked: "Bu hisobga boshqa Telegram ulangan", blocked: "Bu akkaunt faol emas" }[r.error]
        return fail(r.error === "blocked" ? 403 : 409, msg, "TELEGRAM_LINK_FAILED")
      }
      const user = await findUserById(tok.uid)
      if (!user) return fail(500, "Foydalanuvchi topilmadi")
      await markLogin(tok.uid)
      const res = NextResponse.json({ ...sanitizeUser(user), linked: true }, { headers: { "Cache-Control": "no-store" } })
      await issueTokens(res, tok.uid, target.isAdmin)
      return res
    }

    // ── Oddiy kirish / avtomatik ro'yxatdan o'tish ──
    const r = await resolveTelegramLogin(v.identity)
    if (!r.ok) return r.error === "blocked" ? fail(403, "Bu akkaunt bloklangan") : fail(409, "Telegram bilan kirib bo'lmadi. Qayta urinib ko'ring.", "TELEGRAM_FAILED")
    const user = await findUserById(r.id)
    if (!user) return fail(500, "Foydalanuvchi topilmadi")
    await markLogin(r.id)
    const res = NextResponse.json(sanitizeUser(user), { status: r.created ? 201 : 200, headers: { "Cache-Control": "no-store" } })
    await issueTokens(res, r.id, r.isAdmin)
    return res
  } catch (e) {
    console.error("[Telegram] kirish xatosi:", e)
    return fail(500, "Server xatosi", "SERVER_ERROR")
  }
}
