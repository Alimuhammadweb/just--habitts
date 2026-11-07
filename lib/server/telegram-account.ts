import { db, big, newNumericId, prismaCode } from "@/lib/prisma"
import { hashPassword } from "@/lib/server/password"
import { randomToken } from "@/lib/server/google"
import { revokeAllRefreshTokensForUser } from "@/lib/refresh-tokens"
import type { TelegramMiniAppIdentity } from "@/lib/server/telegram"

export type TelegramLoginResult =
  | { ok: true; id: number; isAdmin: boolean; created: boolean }
  | { ok: false; error: "blocked" | "failed" }

/** Telegram'ning ichki "email"i: haqiqiy emas (.invalid — maxsus, hech qachon mavjud bo'lmaydigan domen). Kirish faqat telegramId orqali. */
export const telegramEmail = (id: number, suffix = "") => `tg_${id}${suffix}@telegram.invalid`

/** Telegram bergan profil ma'lumotlari. Faqat telegram* ustunlari — ilovadagi name/firstName/avatarUrl ga tegmaydi. */
const profileColumns = (t: TelegramMiniAppIdentity) => ({
  telegramUsername: t.username ?? null,
  telegramFirstName: t.firstName ?? null,
  telegramLastName: t.lastName ?? null,
  telegramPhotoUrl: t.photoUrl ?? null,
  telegramLanguageCode: t.languageCode ?? null,
})
const clearedProfileColumns = { telegramId: null, telegramUsername: null, telegramFirstName: null, telegramLastName: null, telegramPhotoUrl: null, telegramLanguageCode: null }

/**
 * Tasdiqlangan Telegram identifikatsiyasi → ilova hisobi.
 *  - telegramId bo'yicha topilsa — kirish (profil ma'lumotlari yangilanadi).
 *  - topilmasa — yangi ODDIY foydalanuvchi (isAdmin=false). Mavjud (email/Google) hisobga ism yoki username bo'yicha HECH QACHON
 *    avtomatik qo'shilmaydi: ular egasi tomonidan, imzolangan ulash havolasi orqali (linkTelegram) ulanadi.
 */
export async function resolveTelegramLogin(t: TelegramMiniAppIdentity): Promise<TelegramLoginResult> {
  const select = { id: true, isActive: true, isAdmin: true } as const
  let user = await db().user.findUnique({ where: { telegramId: big(t.id) }, select })
  let created = false
  if (user) {
    if (user.isActive) await db().user.update({ where: { id: user.id }, data: profileColumns(t) }).catch((e) => console.warn("[Telegram] profil yangilanmadi:", e))
  } else {
    const now = Date.now()
    for (let attempt = 0; attempt < 2 && !user; attempt++) {
      try {
        user = await db().user.create({
          data: {
            id: big(newNumericId()), name: t.name, email: telegramEmail(t.id, attempt ? `_${randomToken(4)}` : ""),
            password: hashPassword(randomToken(32)), // parol bilan kirish uchun yaroqsiz tasodifiy xesh
            telegramId: big(t.id), ...profileColumns(t), isActive: true, isAdmin: false,
            firstName: t.firstName ?? null, lastName: t.lastName ?? null,
            avatarUrl: t.photoUrl ?? null, createdAt: new Date(now), xpLastUpdated: big(now), streakFreezes: 1,
          },
          select,
        })
        created = true
      } catch (e) {
        if (prismaCode(e) !== "P2002") throw e
        // Unique buzilishi: parallel so'rov telegramId bilan hisob ochib bo'ldi (ikki marta tez ochish) — shuni olamiz; aks holda email to'qnashuvi, qayta urinamiz.
        user = await db().user.findUnique({ where: { telegramId: big(t.id) }, select })
        if (user) break
      }
    }
    if (!user) return { ok: false, error: "failed" }
  }
  if (!user.isActive) return { ok: false, error: "blocked" }
  return { ok: true, id: Number(user.id), isAdmin: user.isAdmin, created }
}

/**
 * Telegram orqali avtomatik ochilgan, hali ISHLATILMAGAN hisobmi? Faqat shunday hisob ulash paytida bo'shatilishi mumkin
 * (ya'ni foydalanuvchi ulashdan oldin Mini App'ni ochib qo'ygan). Birorta ham foydali yozuvi bo'lsa — hech qachon tegilmaydi.
 */
export async function isPristineTelegramAccount(userId: number): Promise<boolean> {
  const id = big(userId)
  const u = await db().user.findUnique({
    where: { id },
    select: {
      email: true, googleSub: true, isAdmin: true, totalXP: true, pomodoroTotal: true, statsTotalHabits: true, statsCompletedDays: true,
      completedTasks: true, completedChallenges: true, unlockedAvatars: true, unlockedThemes: true, unlockedBadges: true,
      unlockedBorders: true, unlockedFrames: true, unlockedBackgrounds: true, plannedHabits: true,
      _count: { select: { habits: true, xpHistory: true, pomodoroSessions: true, pomodoroRuns: true, activeChallenges: true, weeklyTasks: true, feedback: true, friendships: true, friendOf: true, sentRequests: true, receivedRequests: true } },
    },
  })
  if (!u || !u.email.endsWith("@telegram.invalid") || u.googleSub || u.isAdmin) return false
  if (u.totalXP || u.pomodoroTotal || u.statsTotalHabits || u.statsCompletedDays) return false
  if (u.completedTasks.length || u.completedChallenges.length || u.unlockedAvatars.length || u.unlockedThemes.length || u.unlockedBadges.length
    || u.unlockedBorders.length || u.unlockedFrames.length || u.unlockedBackgrounds.length) return false
  if (Array.isArray(u.plannedHabits) && u.plannedHabits.length) return false
  if (Object.values(u._count).some((n) => n > 0)) return false
  // Jamiyat yozuvlari User bilan relation orqali bog'lanmagan — alohida tekshiramiz
  const [posts, comments, reactions] = await Promise.all([
    db().communityPost.count({ where: { userId: id } }), db().comment.count({ where: { userId: id } }), db().reaction.count({ where: { userId: id } }),
  ])
  return posts + comments + reactions === 0
}

export type TelegramLinkResult = { ok: true } | { ok: false; error: "in_use" | "already_linked" | "blocked" }

/**
 * Kirgan foydalanuvchi (userId) hisobiga TASDIQLANGAN Telegram identifikatsiyasini ulaydi.
 * Chaqiruvchi ikki narsani isbotlagan bo'lishi shart: (1) hisob egasi ulash tokenini olgan, (2) Telegram imzosi to'g'ri.
 */
export async function linkTelegram(userId: number, t: TelegramMiniAppIdentity): Promise<TelegramLinkResult> {
  const me = await db().user.findUnique({ where: { id: big(userId) }, select: { telegramId: true, isActive: true } })
  if (!me || !me.isActive) return { ok: false, error: "blocked" }
  if (me.telegramId != null && Number(me.telegramId) !== t.id) return { ok: false, error: "already_linked" }

  const owner = await db().user.findUnique({ where: { telegramId: big(t.id) }, select: { id: true } })
  try {
    if (owner && Number(owner.id) !== userId) {
      // Bu Telegram boshqa hisobda. Faqat u bo'sh (ishlatilmagan) avto-hisob bo'lsa bo'shatamiz — hech narsa O'CHIRILMAYDI.
      if (!(await isPristineTelegramAccount(Number(owner.id)))) return { ok: false, error: "in_use" }
      await db().$transaction([
        db().user.update({ where: { id: owner.id }, data: clearedProfileColumns }),
        db().user.update({ where: { id: big(userId) }, data: { telegramId: big(t.id), ...profileColumns(t) } }),
      ])
      await revokeAllRefreshTokensForUser(Number(owner.id)).catch(() => {})
    } else {
      await db().user.update({ where: { id: big(userId) }, data: { telegramId: big(t.id), ...profileColumns(t) } })
    }
  } catch (e) {
    if (prismaCode(e) === "P2002") return { ok: false, error: "in_use" } // parallel so'rov ushbu Telegram'ni boshqa hisobga ulab ulgurdi
    throw e
  }
  return { ok: true }
}
