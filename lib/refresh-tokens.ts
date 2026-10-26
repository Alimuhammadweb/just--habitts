import { db, big } from "@/lib/prisma"
import { hashRefreshToken } from "@/lib/auth-refresh"

// Yangi refresh token yozuvini DB'ga saqlaydi (token matnining o'zi emas, hashi).
export async function storeRefreshToken(jti: string, userId: number, token: string, maxAgeSeconds: number) {
  await db().refreshToken.create({
    data: {
      jti,
      userId: big(userId),
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(Date.now() + maxAgeSeconds * 1000),
    },
  })
  // Muddati o'tgan tokenlarni vaqti-vaqti bilan tozalash (TTL indeks o'rniga)
  if (Math.random() < 0.02) db().refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {})
}

// Refresh tokenni tekshiradi: DB'da mavjudmi, bekor qilinmaganmi va hash mos keladimi.
export async function isRefreshTokenValid(jti: string, token: string): Promise<{ valid: boolean; userId?: number }> {
  const doc = await db().refreshToken.findUnique({ where: { jti } })
  if (!doc || doc.revoked) return { valid: false }
  if (doc.expiresAt.getTime() < Date.now()) return { valid: false }
  if (doc.tokenHash !== hashRefreshToken(token)) return { valid: false }
  return { valid: true, userId: Number(doc.userId) }
}

// Rotatsiya: eski tokenni bekor qilib, foydalanuvchi uchun yangisini yozamiz (bitta tranzaksiyada).
export async function rotateRefreshToken(oldJti: string, newJti: string, userId: number, newToken: string, maxAgeSeconds: number) {
  await db().$transaction([
    db().refreshToken.updateMany({ where: { jti: oldJti }, data: { revoked: true } }),
    db().refreshToken.create({
      data: {
        jti: newJti,
        userId: big(userId),
        tokenHash: hashRefreshToken(newToken),
        expiresAt: new Date(Date.now() + maxAgeSeconds * 1000),
      },
    }),
  ])
}

// Bitta tokenni bekor qilish (logout uchun)
export async function revokeRefreshToken(jti: string) {
  await db().refreshToken.updateMany({ where: { jti }, data: { revoked: true } })
}

// Foydalanuvchining barcha tokenlarini bekor qilish (parol o'zgarganda)
export async function revokeAllRefreshTokensForUser(userId: number) {
  await db().refreshToken.updateMany({ where: { userId: big(userId) }, data: { revoked: true } })
}
