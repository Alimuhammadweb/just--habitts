import { db, big, newNumericId, prismaCode } from "@/lib/prisma"
import { hashPassword } from "@/lib/server/password"
import { randomToken } from "@/lib/server/google"
import type { TelegramIdentity } from "@/lib/server/telegram"

export type TelegramLoginResult =
  | { ok: true; id: number; isAdmin: boolean; created: boolean }
  | { ok: false; error: "blocked" | "failed" }

/** Telegram'ning ichki "email"i: haqiqiy emas (.invalid — maxsus, hech qachon mavjud bo'lmaydigan domen). Kirish faqat telegramId orqali. */
export const telegramEmail = (id: number) => `tg_${id}@telegram.invalid`

/**
 * Tasdiqlangan Telegram identifikatsiyasi → ilova hisobi.
 *  - telegramId bo'yicha topilsa — kirish.
 *  - topilmasa — yangi ODDIY foydalanuvchi (isAdmin=false). Mavjud (email/Google) hisobga avtomatik ulanmaydi:
 *    Telegram email bermaydi, shuning uchun egasi kirib, Profil'dan o'zi ulaydi.
 */
export async function resolveTelegramLogin(t: TelegramIdentity): Promise<TelegramLoginResult> {
  let user = await db().user.findUnique({ where: { telegramId: big(t.id) }, select: { id: true, isActive: true, isAdmin: true } })
  let created = false
  if (!user) {
    const now = Date.now()
    try {
      user = await db().user.create({
        data: {
          id: big(newNumericId()), name: t.name, email: telegramEmail(t.id),
          password: hashPassword(randomToken(32)), // parol bilan kirish uchun yaroqsiz tasodifiy xesh
          telegramId: big(t.id), isActive: true, isAdmin: false,
          avatarUrl: t.photoUrl ?? null, createdAt: new Date(now), xpLastUpdated: big(now), streakFreezes: 1,
        },
        select: { id: true, isActive: true, isAdmin: true },
      })
      created = true
    } catch (e) {
      if (prismaCode(e) === "P2002") return { ok: false, error: "failed" } // parallel so'rov
      throw e
    }
  }
  if (!user.isActive) return { ok: false, error: "blocked" }
  return { ok: true, id: Number(user.id), isAdmin: user.isAdmin, created }
}

export type TelegramLinkResult = { ok: true } | { ok: false; error: "in_use" | "already_linked" | "blocked" }

/** Kirgan foydalanuvchi o'z hisobiga Telegram'ni ulaydi. */
export async function linkTelegram(userId: number, t: TelegramIdentity): Promise<TelegramLinkResult> {
  const owner = await db().user.findUnique({ where: { telegramId: big(t.id) }, select: { id: true } })
  if (owner && Number(owner.id) !== userId) return { ok: false, error: "in_use" }
  const me = await db().user.findUnique({ where: { id: big(userId) }, select: { telegramId: true, isActive: true } })
  if (!me || !me.isActive) return { ok: false, error: "blocked" }
  if (me.telegramId != null && Number(me.telegramId) !== t.id) return { ok: false, error: "already_linked" }
  await db().user.update({ where: { id: big(userId) }, data: { telegramId: big(t.id) } })
  return { ok: true }
}
