import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto"

// Yangi parollar scrypt bilan (Node o'rnatilgan, qo'shimcha kutubxonasiz). Format: scrypt:<salt>:<hash>
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }).toString("hex")
  return `scrypt:${salt}:${hash}`
}

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export interface StoredCredentials { password?: string; salt?: string }

/** Yangi (scrypt), eski (sha256+salt) va eng eski (oddiy matn) formatlarni tekshiradi. needsUpgrade - eski format. */
export function verifyPassword(input: string, stored: StoredCredentials): { valid: boolean; needsUpgrade: boolean } {
  const pw = stored.password ?? ""
  if (pw.startsWith("scrypt:")) {
    const [, salt, hash] = pw.split(":")
    if (!salt || !hash) return { valid: false, needsUpgrade: false }
    const calc = scryptSync(input, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }).toString("hex")
    return { valid: safeEq(calc, hash), needsUpgrade: false }
  }
  if (stored.salt) {
    const calc = createHash("sha256").update(input + stored.salt).digest("hex")
    return { valid: safeEq(calc, pw), needsUpgrade: true }
  }
  return { valid: pw.length > 0 && safeEq(input, pw), needsUpgrade: true }
}

// Qo'lda tekshiruv uchun soxta xesh: foydalanuvchi topilmaganda ham vaqt taxminan teng bo'lsin
const DUMMY = hashPassword("dummy-password-for-timing")
export const burnTime = (input: string) => verifyPassword(input, { password: DUMMY })

export { PASSWORD_MIN, passwordProblems } from "../password-rules"
