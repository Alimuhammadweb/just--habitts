import { createHash, randomBytes } from "crypto"
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose"
import type { NextRequest } from "next/server"

// Google OAuth 2.0 / OpenID Connect — "authorization code" oqimi + PKCE (S256), butunlay SERVER tomonida.
// Mijozga faqat Google'ning avtorizatsiya URL'i beriladi; client_secret va kodni almashtirish serverda qoladi.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"]

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

const isDev = () => process.env.NODE_ENV !== "production"

/**
 * Saytning asosiy manzili.
 *  - `next dev` (lokal): HAR DOIM brauzer ochgan manzil (masalan http://localhost:3000). APP_URL lokal .env'ga
 *    productiondan ko'chirilgan bo'lsa ham, Google'ga production manzili ketib qolmaydi (redirect_uri_mismatch sababi).
 *  - production (Vercel, yoki lokal `next start`): APP_URL, bo'lmasa so'rov manzili.
 */
export function appBase(request: NextRequest): string {
  if (isDev()) return request.nextUrl.origin
  return (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, "")
}

/** Google Cloud Console'dagi "Authorized redirect URI" bilan BELGIMA-BELGI bir xil bo'lishi shart. */
export function redirectUri(request: NextRequest): string {
  return process.env.GOOGLE_REDIRECT_URI || `${appBase(request)}/api/auth/google/callback`
}

/** Faqat server logi uchun: redirect_uri maxfiy emas, lekin client_id/secret hech qachon yozilmaydi. */
export function logRedirectUri(request: NextRequest) {
  const uri = redirectUri(request)
  console.info(`[Google] redirect_uri = ${uri}  (Google Cloud Console'dagi "Authorized redirect URIs" ro'yxatida AYNAN shu bo'lishi kerak)`)
  const appUrl = process.env.APP_URL
  if (!isDev() && appUrl && new URL(appUrl).host !== request.nextUrl.host && !process.env.GOOGLE_REDIRECT_URI) {
    console.warn(`[Google] OGOHLANTIRISH: APP_URL (${new URL(appUrl).origin}) brauzer manzili (${request.nextUrl.origin}) dan farq qiladi. Lokal \`next start\` uchun .env'da APP_URL=${request.nextUrl.origin} qiling.`)
  }
}

const b64url = (b: Buffer) => b.toString("base64url")
export const randomToken = (bytes = 32) => b64url(randomBytes(bytes))
export const pkceChallenge = (verifier: string) => b64url(createHash("sha256").update(verifier).digest())

export function buildAuthUrl(request: NextRequest, p: { state: string; nonce: string; verifier: string }): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    nonce: p.nonce,
    code_challenge: pkceChallenge(p.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  })
  return `${AUTH_URL}?${q.toString()}`
}

export interface GoogleIdentity { sub: string; email: string; name: string; picture?: string }

let keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(JWKS_URL))
/** FAQAT testlar uchun (ALLOW_TEST_HOOKS=1 bo'lmasa ishlamaydi): Google kalitlari o'rniga mahalliy kalitni qo'yish. */
export function __setKeyResolverForTests(r: JWTVerifyGetKey) {
  if (process.env.ALLOW_TEST_HOOKS !== "1") throw new Error("test hook o'chiq")
  keys = r
}

/** Kodni token'ga almashtiradi va id_token'ni Google'ning ochiq kalitlari bilan to'liq tekshiradi. */
export async function exchangeAndVerify(request: NextRequest, code: string, verifier: string, nonce: string): Promise<GoogleIdentity> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(request), grant_type: "authorization_code", code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`token_exchange_${res.status}`)
  const tok = (await res.json()) as { id_token?: string }
  if (!tok.id_token) throw new Error("no_id_token")

  const { payload } = await jwtVerify(tok.id_token, keys, { issuer: ISSUERS, audience: process.env.GOOGLE_CLIENT_ID! })
  if (payload.nonce !== nonce) throw new Error("nonce_mismatch")
  const sub = typeof payload.sub === "string" ? payload.sub : ""
  const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : ""
  // Google email'ni tasdiqlagan bo'lishi shart: tasdiqlanmagan email bo'yicha hech qachon hisob yaratilmaydi/bog'lanmaydi.
  const verified = payload.email_verified === true || payload.email_verified === "true"
  if (!sub || !email || !verified) throw new Error("email_not_verified")
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0]
  const picture = typeof payload.picture === "string" && /^https:\/\//.test(payload.picture) ? payload.picture : undefined
  return { sub, email, name: name.slice(0, 60), ...(picture ? { picture } : {}) }
}
