import { randomUUID, createHash } from "crypto"

// Bu fayl faqat oddiy Node.js runtime'da ishlaydigan API route'larda
// import qilinishi kerak (login/logout/refresh). Middleware Edge Runtime'da
// ishlaydi va Node.js "crypto" modulini qo'llab-quvvatlamaydi - shuning
// uchun bu funksiyalar lib/auth.ts'dan ATAYLAB ajratilgan.

// Refresh tokenlarni DB'da xom holda emas, hash qilib saqlaymiz - shunda
// DB sizib chiqsa ham tokenlarning o'zi ishlatib bo'lmaydi.
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function newTokenId(): string {
  return randomUUID()
}
