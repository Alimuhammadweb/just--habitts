import { SignJWT, jwtVerify } from "jose"
import type { NextRequest } from "next/server"

// Eski nom bilan moslik uchun saqlab qolinadi (ba'zi joylarda import qilinishi mumkin)
export const SESSION_COOKIE = "access_token"
export const ACCESS_COOKIE = "access_token"
export const REFRESH_COOKIE = "refresh_token"

// Access token qisqa umr ko'radi - o'g'irlansa ham tez eskiradi.
export const ACCESS_MAX_AGE_SECONDS = 60 * 15 // 15 daqiqa
// Refresh token uzoqroq umr ko'radi, lekin DB'da saqlanadi va istalgan
// vaqt bekor qilinishi (revoke) mumkin.
export const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 kun

// Bu fayl Edge Runtime'da (middleware) ham ishlatiladi, shuning uchun
// bu yerda faqat Web Crypto bilan mos "jose" kutubxonasidan foydalanamiz.
// Node.js'ning "crypto" modulini talab qiladigan funksiyalar (refresh token
// hash'lash, jti generatsiya qilish) lib/auth-refresh.ts faylida, chunki u
// faqat oddiy (Node.js) runtime'da ishlaydigan API route'larda kerak.
function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    // Ishlab chiqarishda JWT_SECRET albatta o'rnatilishi kerak.
    // Bo'lmasa, server ishga tushishi bilanoq xato chiqaramiz - shunda
    // xavfsiz bo'lmagan standart kalit bilan production'da ishlab
    // qolish ehtimoli yo'q.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET environment o'zgaruvchisi o'rnatilmagan. Vercel Dashboard > Settings > Environment Variables ga qo'shing.",
      )
    }
    console.warn("[Auth] OGOHLANTIRISH: JWT_SECRET o'rnatilmagan, faqat lokal dev uchun vaqtinchalik kalit ishlatilmoqda.")
    return new TextEncoder().encode("dev-only-insecure-secret-do-not-use-in-production")
  }
  return new TextEncoder().encode(secret)
}

export interface SessionPayload {
  id: number
  isAdmin: boolean
}

export interface RefreshPayload extends SessionPayload {
  jti: string // token identifikatori - DB'da revoke qilish uchun
}

// ---------- ACCESS TOKEN ----------

// Yangi qisqa muddatli access tokeni yaratish
export async function createAccessToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ id: payload.id, isAdmin: payload.isAdmin, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey())
}

// Access tokenni tekshirish
export async function verifyAccessToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (payload.typ !== "access") return null
    if (typeof payload.id !== "number") return null
    return { id: payload.id, isAdmin: Boolean(payload.isAdmin) }
  } catch {
    return null
  }
}

// Eski nom bilan moslik (middleware/route handlerlar shu nomni chaqirishi mumkin edi)
export const createSessionToken = createAccessToken
export const verifySessionToken = verifyAccessToken

// ---------- REFRESH TOKEN (imzo tekshiruvi - Edge-safe) ----------
// Diqqat: bu funksiya faqat JWT imzosini tekshiradi. jti orqali DB'dan
// bekor qilinganini (revoked) tekshirish route handlerning o'zida,
// lib/auth-refresh.ts orqali amalga oshiriladi.
export async function verifyRefreshToken(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (payload.typ !== "refresh") return null
    if (typeof payload.id !== "number" || typeof payload.jti !== "string") return null
    return { id: payload.id, isAdmin: Boolean(payload.isAdmin), jti: payload.jti }
  } catch {
    return null
  }
}

// Refresh token yaratish ham "jose" (Web Crypto) orqali, shuning uchun
// bu yerda qoladi - lekin uni chaqirish uchun kerak bo'lgan jti Node.js
// crypto.randomUUID() bilan lib/auth-refresh.ts'da generatsiya qilinadi.
export async function createRefreshToken(payload: SessionPayload, jti: string): Promise<string> {
  return new SignJWT({ id: payload.id, isAdmin: payload.isAdmin, jti, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey())
}

<<<<<<< HEAD
// ---------- OAuth holat tokeni (Google) ----------
// Google'ga yo'naltirishdan oldin state/nonce/PKCE verifier shu imzolangan, qisqa muddatli
// httpOnly cookie'da saqlanadi - callback'da mijoz yuborgan qiymatlar shu bilan solishtiriladi.
export const OAUTH_COOKIE = "g_oauth"
export const OAUTH_MAX_AGE_SECONDS = 60 * 10

export interface OAuthStatePayload {
  state: string
  nonce: string
  verifier: string
  mode: "login" | "link"
  uid?: number // faqat mode=link: ulanayotgan foydalanuvchi
}

export async function createOAuthStateToken(p: OAuthStatePayload): Promise<string> {
  return new SignJWT({ ...p, typ: "oauth_state" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey())
}

export async function verifyOAuthStateToken(token: string): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (payload.typ !== "oauth_state") return null
    if (typeof payload.state !== "string" || typeof payload.nonce !== "string" || typeof payload.verifier !== "string") return null
    const mode = payload.mode === "link" ? "link" : "login"
    return { state: payload.state, nonce: payload.nonce, verifier: payload.verifier, mode, ...(typeof payload.uid === "number" ? { uid: payload.uid } : {}) }
  } catch {
    return null
  }
}

export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const, // Google'dan qaytishda (top-level GET) cookie yuborilishi uchun
  path: "/api/auth/google",
  maxAge: OAUTH_MAX_AGE_SECONDS,
}

=======
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d
export const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ACCESS_MAX_AGE_SECONDS,
}

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  // Refresh tokeni faqat refresh endpointiga yuborilishi kerak - shunda
  // boshqa har bir so'rov bilan tarmoqqa chiqib yurmaydi.
  path: "/api/auth",
  maxAge: REFRESH_MAX_AGE_SECONDS,
}

// Moslik uchun eski nomlar
export const SESSION_COOKIE_OPTIONS = ACCESS_COOKIE_OPTIONS

// Middleware o'rnatgan ishonchli headerlardan sessiyani o'qish.
// Route handlerlar mijozdan kelgan userId/isAdmin maydonlariga emas,
// shu funksiyaga ishonishi kerak - chunki bu qiymatlar faqat
// tasdiqlangan JWT token asosida middleware tomonidan qo'yiladi.
export function getSession(request: NextRequest): SessionPayload | null {
  const id = request.headers.get("x-user-id")
  const isAdmin = request.headers.get("x-user-admin")
  if (!id) return null
  const parsedId = Number.parseInt(id, 10)
  if (Number.isNaN(parsedId)) return null
  return { id: parsedId, isAdmin: isAdmin === "true" }
}
