/**
 * Google callback + sessiya (JWT/refresh/logout) testi.
 * Haqiqiy Google chaqirilmaydi: Google'ning token endpoint'i `fetch` stub'i bilan, kalitlari esa mahalliy RSA kalit bilan almashtiriladi.
 * id_token'ni tekshiruvchi KOD (imzo, iss, aud, exp, nonce, email_verified) va callback route'ning o'zi haqiqiy.
 *
 *   ALLOW_TEST_HOOKS=1 BASE_URL=http://localhost:3000 npx tsx scripts/smoke-google-session.ts
 * Server GOOGLE_CLIENT_ID/SECRET va EXTRA_ALLOWED_ORIGIN=$BASE_URL bilan ishlab turishi kerak. Faqat TEST bazasida!
 */
import "dotenv/config"
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from "jose"
import { NextRequest } from "next/server"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"
import { createOAuthStateToken, OAUTH_COOKIE } from "../lib/auth"
import { __setKeyResolverForTests } from "../lib/server/google"
import { GET as callback } from "../app/api/auth/google/callback/route"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const CID = process.env.GOOGLE_CLIENT_ID!
let failed = 0
const ok = (c: unknown, m: string) => { if (c) console.log("ok  ", m); else { failed++; console.error("FAIL", m) } }

// ── Google'ni o'rnini bosuvchi mahalliy kalit va fetch stub ──
let idTokenToReturn = ""
let tokenEndpointCalls = 0
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url
  if (url === "https://oauth2.googleapis.com/token") { tokenEndpointCalls++; return new Response(JSON.stringify({ id_token: idTokenToReturn }), { status: 200 }) }
  return realFetch(input, init)
}) as typeof fetch

async function main() {
  process.env.ALLOW_TEST_HOOKS = "1"
  const { publicKey, privateKey } = await generateKeyPair("RS256")
  const other = await generateKeyPair("RS256")
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" }
  __setKeyResolverForTests(createLocalJWKSet({ keys: [jwk] }))
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 3 }) })
  const stamp = Date.now()

  const mkToken = (o: { sub?: string; email?: string; verified?: boolean | string; aud?: string; iss?: string; nonce?: string; exp?: string; key?: any; name?: string } = {}) =>
    new SignJWT({ email: o.email ?? `g${stamp}@gmail.test`, email_verified: o.verified ?? true, name: o.name ?? "Test Google", nonce: o.nonce ?? "N0NCE" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" }).setSubject(o.sub ?? `sub-${stamp}`).setIssuer(o.iss ?? "https://accounts.google.com")
      .setAudience(o.aud ?? CID).setIssuedAt().setExpirationTime(o.exp ?? "10m").sign(o.key ?? privateKey)

  // Callback'ni Google'dan qaytgandek chaqiradi (state cookie + ?code&state)
  async function runCallback(idToken: string, opts: { state?: string; cookieState?: string; origin?: string } = {}) {
    idTokenToReturn = idToken
    const cookie = await createOAuthStateToken({ state: opts.cookieState ?? "ST", nonce: "N0NCE", verifier: "v".repeat(43), mode: "login" })
    const origin = opts.origin ?? BASE
    const req = new NextRequest(`${origin}/api/auth/google/callback?code=abc&state=${opts.state ?? "ST"}`, { headers: { cookie: `${OAUTH_COOKIE}=${cookie}` } })
    const res = await callback(req)
    const jar = new Map<string, string>()
    for (const sc of res.headers.getSetCookie()) { const [p] = sc.split(";"); const i = p.indexOf("="); const k = p.slice(0, i), v = p.slice(i + 1); if (v) jar.set(k, v); else jar.delete(k) }
    return { location: res.headers.get("location") ?? "", cookies: jar }
  }
  const cookieHeader = (j: Map<string, string>) => [...j].map(([k, v]) => `${k}=${v}`).join("; ")
  const http = async (method: string, path: string, jar: Map<string, string>, body?: unknown) => {
    const r = await realFetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", Origin: BASE, Cookie: cookieHeader(jar) }, body: body ? JSON.stringify(body) : undefined })
    for (const sc of r.headers.getSetCookie()) { const [p] = sc.split(";"); const i = p.indexOf("="); const k = p.slice(0, i), v = p.slice(i + 1); if (v) jar.set(k, v); else jar.delete(k) }
    const t = await r.text(); let d: any = t; try { d = JSON.parse(t) } catch { /* matn */ }
    return { status: r.status, data: d }
  }
  // authFetch (lib/api-client.ts) bilan bir xil mantiq: 401+TOKEN_EXPIRED → refresh → bir marta qayta urinish
  const authFetchLike = async (method: string, path: string, jar: Map<string, string>) => {
    let r = await http(method, path, jar)
    if (r.status === 401 && r.data?.code === "TOKEN_EXPIRED") { const rf = await http("POST", "/api/auth/refresh", jar); if (rf.status === 200) r = await http(method, path, jar) }
    return r
  }

  // ═══ 1. Muvaffaqiyatli Google login ═══
  const good = await runCallback(await mkToken())
  ok(good.location === `${BASE}/?signed_in=google` && good.cookies.has("access_token") && good.cookies.has("refresh_token"), "1. Google login: bosh sahifaga yo'naltirildi, access+refresh cookie berildi")
  ok(!JSON.stringify([...good.cookies]).includes(CID) && !good.location.includes("id_token"), "1. Google id_token / client_id brauzerga chiqmadi (o'z JWT'ingiz berildi)")
  const row = await prisma.user.findUnique({ where: { googleSub: `sub-${stamp}` } })
  ok(row && row.isAdmin === false && row.lastLoginAt !== null, "1. Foydalanuvchi yaratildi, admin emas, lastLoginAt yozildi")
  const me = await http("GET", "/api/auth/me", good.cookies)
  ok(me.status === 200 && me.data.email === `g${stamp}@gmail.test` && me.data.password === undefined, "1. /api/auth/me: cookie bilan sessiya tanildi")
  const prof = await http("GET", `/api/users/${me.data.id}`, good.cookies)
  ok(prof.status === 200, "1. Himoyalangan API (/api/users/:id) ishlaydi")

  // ═══ 2. Noto'g'ri / muddati tugagan tokenlar ═══
  const before = await prisma.user.count()
  const bad: [string, string][] = [
    ["Google id_token muddati tugagan", await mkToken({ sub: "x1", email: `x1${stamp}@g.test`, exp: "-10s" })],
    ["noto'g'ri audience (boshqa client_id)", await mkToken({ sub: "x2", email: `x2${stamp}@g.test`, aud: "boshqa-client" })],
    ["noto'g'ri issuer", await mkToken({ sub: "x3", email: `x3${stamp}@g.test`, iss: "https://evil.example" })],
    ["boshqa kalit bilan soxta imzo", await mkToken({ sub: "x4", email: `x4${stamp}@g.test`, key: other.privateKey })],
    ["nonce mos kelmaydi (replay)", await mkToken({ sub: "x5", email: `x5${stamp}@g.test`, nonce: "BOSHQA" })],
  ]
  for (const [name, tok] of bad) { const r = await runCallback(tok); ok(r.location.includes("auth_error=google_failed") && !r.cookies.has("access_token"), `2. ${name} → rad etildi, sessiya berilmadi`) }
  const unv = await runCallback(await mkToken({ sub: "x6", email: `x6${stamp}@g.test`, verified: false }))
  ok(unv.location.includes("auth_error=google_email_unverified") && !unv.cookies.has("access_token"), "2. email_verified=false → rad etildi")
  ok((await prisma.user.count()) === before, "2. Rad etilgan urinishlar hisob yaratmadi")
  // O'z JWT'ingiz: muddati o'tgan access token → 401 TOKEN_EXPIRED → refresh → davom etadi
  const { SignJWT: S } = await import("jose")
  const expiredAccess = await new S({ id: me.data.id, isAdmin: false }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(Math.floor(Date.now() / 1000) - 3600).setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(new TextEncoder().encode(process.env.JWT_SECRET!))
  const jar2 = new Map(good.cookies); jar2.set("access_token", expiredAccess)
  ok((await http("GET", "/api/auth/me", new Map(jar2))).data?.code === "TOKEN_EXPIRED", "2. Muddati o'tgan o'z access token'i → 401 TOKEN_EXPIRED (kutilgan holat)")
  const healed = await authFetchLike("GET", "/api/auth/me", jar2)
  ok(healed.status === 200 && jar2.get("access_token") !== expiredAccess, "2. authFetch mantig'i: refresh orqali yangi access token olindi, so'rov davom etdi")
  const jar3 = new Map<string, string>([["access_token", "garbage.token.value"]])
  ok((await authFetchLike("GET", "/api/auth/me", jar3)).status === 401, "2. Buzilgan token + refresh yo'q → 401 (login sahifasiga qaytariladi)")
  ok((await http("GET", "/api/auth/me", new Map())).data?.code === "TOKEN_EXPIRED", "2. Sessiyasiz /api/auth/me → TOKEN_EXPIRED (shuning uchun frontend uni endi faqat Google'dan qaytganda chaqiradi)")

  // ═══ 3. Callback URL / state mos kelmasligi ═══
  const st = await runCallback(await mkToken(), { state: "BOSHQA" })
  ok(st.location.includes("auth_error=google_state") && !st.cookies.has("access_token"), "3. state mos kelmasa → rad etildi, sessiya berilmadi")
  const callsBefore = tokenEndpointCalls
  await runCallback(await mkToken(), { state: "BOSHQA" })
  ok(tokenEndpointCalls === callsBefore, "3. state noto'g'ri bo'lsa Google'ga kod almashtirish so'rovi UMUMAN yuborilmadi")

  // ═══ 4. Sahifani yangilash / qayta ochish (cookie'lar saqlanadi, server holatsiz) ═══
  for (let i = 0; i < 3; i++) { const r = await http("GET", "/api/auth/me", good.cookies); if (r.status !== 200) ok(false, `4. yangilash #${i + 1}`) }
  ok((await http("GET", "/api/auth/me", new Map(good.cookies))).status === 200, "4. Yangilash/qayta ochish: xuddi shu cookie'lar bilan sessiya saqlanadi")
  ok((await http("POST", "/api/auth/refresh", jar2)).status === 200, "4. Refresh token bilan sessiya yangilandi (rotatsiya)")
  // Rotatsiya: 2-bo'limda ishlatib bo'lingan ESKI refresh token qayta ishlatilsa rad etiladi (o'g'irlangan token himoyasi)
  ok((await http("POST", "/api/auth/refresh", new Map([["refresh_token", good.cookies.get("refresh_token")!]]))).status === 401, "4. Ishlatib bo'lingan eski refresh token rad etiladi")

  // ═══ 5. Logout va qayta login ═══
  const lo = await http("POST", "/api/auth/logout", good.cookies)
  ok(lo.status === 200 && !good.cookies.has("access_token"), "5. Logout: cookie'lar tozalandi")
  ok((await http("GET", "/api/auth/me", good.cookies)).status === 401, "5. Logoutdan keyin /api/auth/me → 401")
  const again = await runCallback(await mkToken())
  ok(again.cookies.has("access_token") && (await prisma.user.count({ where: { googleSub: `sub-${stamp}` } })) === 1, "5. Qayta Google login: yangi sessiya, dublikat hisob yo'q")
  ok((await http("GET", "/api/auth/me", again.cookies)).status === 200, "5. Qayta login'dan keyin sessiya ishlaydi")

  await prisma.$disconnect()
  console.log(failed ? `\n${failed} ta tekshiruv muvaffaqiyatsiz ❌` : "\nBarcha Google callback/sessiya tekshiruvlari o'tdi ✅")
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
