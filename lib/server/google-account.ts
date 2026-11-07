import { db, big, newNumericId, prismaCode } from "@/lib/prisma"
import { hashPassword } from "@/lib/server/password"
import { adminEmail } from "@/lib/server/session"
import { randomToken, type GoogleIdentity } from "@/lib/server/google"

export type GoogleLoginResult =
  | { ok: true; id: number; isAdmin: boolean; created: boolean }
  | { ok: false; error: "google_link_required" | "google_failed" | "blocked" }

/**
 * Tasdiqlangan Google identifikatsiyasi → ilova hisobi.
 *  1) `sub` bo'yicha topilsa — kirish.
 *  2) `sub` yo'q, lekin shu email bilan (parol orqali ochilgan) hisob bor — AVTOMATIK ULANMAYDI (google_link_required).
 *     Ilovada email tasdiqlash yo'qligi sababli, birovning emaili bilan oldindan hisob ochgan shaxs keyin Google egasining
 *     hisobiga kirib olishi mumkin edi. Egasi parol bilan kirib, Profil'dan o'zi ulaydi.
 *  3) Aks holda — yangi ODDIY foydalanuvchi (isAdmin=false) yaratiladi.
 */
export async function resolveGoogleLogin(g: GoogleIdentity): Promise<GoogleLoginResult> {
  let user = await db().user.findUnique({ where: { googleSub: g.sub }, select: { id: true, isActive: true, isAdmin: true } })
  let created = false

  if (!user) {
    const byEmail = await db().user.findUnique({ where: { email: g.email }, select: { id: true } })
    if (byEmail) return { ok: false, error: "google_link_required" }
    if (g.email === adminEmail()) return { ok: false, error: "google_failed" } // .env admin emailini band qilib bo'lmaydi

    const now = Date.now()
    try {
      user = await db().user.create({
        data: {
          id: big(newNumericId()), name: g.name, email: g.email,
          // Parol bilan kirish uchun yaroqsiz tasodifiy xesh; keyin "Parolni unutdim" orqali parol o'rnatish mumkin.
          password: hashPassword(randomToken(32)),
          googleSub: g.sub, isActive: true, isAdmin: false, // yangi foydalanuvchi HECH QACHON admin emas
          avatarUrl: g.picture ?? null, createdAt: new Date(now), xpLastUpdated: big(now), streakFreezes: 1,
        },
        select: { id: true, isActive: true, isAdmin: true },
      })
      created = true
    } catch (e) {
      if (prismaCode(e) === "P2002") return { ok: false, error: "google_link_required" } // parallel so'rov / email band
      throw e
    }
  }
  if (!user.isActive) return { ok: false, error: "blocked" }
  return { ok: true, id: Number(user.id), isAdmin: user.isAdmin, created }
}
