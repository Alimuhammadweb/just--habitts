import { timingSafeEqual } from "crypto"
import { NextResponse, type NextRequest } from "next/server"
import { OAUTH_COOKIE, verifyOAuthStateToken } from "@/lib/auth"
import { db, big } from "@/lib/prisma"
import { resolveGoogleLogin } from "@/lib/server/google-account"
import { hit, clientIp } from "@/lib/server/rate-limit"
import { issueTokens, markLogin } from "@/lib/server/session"
import { appBase, exchangeAndVerify, googleConfigured, type GoogleIdentity } from "@/lib/server/google"

const safeEq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }

// GET /api/auth/google/callback — Google shu manzilga qaytaradi. Hamma tekshiruv shu yerda, serverda.
export async function GET(request: NextRequest) {
  const base = appBase(request)
  const done = (path: string, cookieCleared = true) => {
    const res = NextResponse.redirect(new URL(path, base))
    if (cookieCleared) res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 })
    res.headers.set("Cache-Control", "no-store")
    return res
  }
  const err = (code: string) => done(`/?auth_error=${code}`)

  if (!googleConfigured()) return err("google_unavailable")
  const sp = request.nextUrl.searchParams
  if (sp.get("error")) return err("google_denied")
  const code = sp.get("code"), state = sp.get("state")
  const saved = await verifyOAuthStateToken(request.cookies.get(OAUTH_COOKIE)?.value ?? "")
  // CSRF himoyasi: state cookie'dagi bilan aynan mos bo'lishi shart
  if (!code || !state || !saved || !safeEq(state, saved.state)) return err("google_state")

  try {
    const rl = await hit(`google:${clientIp(request.headers)}`, 30, 10 * 60)
    if (!rl.allowed) return err("rate_limited")
  } catch { /* limiter ishlamasa to'smaymiz */ }

  let g: GoogleIdentity
  try {
    g = await exchangeAndVerify(request, code, saved.verifier, saved.nonce)
  } catch (e) {
    console.error("[Google] tekshiruv xatosi:", (e as Error).message)
    return err((e as Error).message === "email_not_verified" ? "google_email_unverified" : "google_failed")
  }

  try {
    // ── Mavjud hisobga ULASH (foydalanuvchi allaqachon kirgan) ──
    if (saved.mode === "link") {
      if (!saved.uid) return err("google_state")
      const owner = await db().user.findUnique({ where: { googleSub: g.sub }, select: { id: true } })
      if (owner && Number(owner.id) !== saved.uid) return done("/?auth_error=google_in_use#profile")
      const me = await db().user.findUnique({ where: { id: big(saved.uid) }, select: { googleSub: true, isActive: true } })
      if (!me || !me.isActive) return err("blocked")
      if (me.googleSub && me.googleSub !== g.sub) return done("/?auth_error=google_already_linked#profile")
      await db().user.update({ where: { id: big(saved.uid) }, data: { googleSub: g.sub } })
      return done("/?google=linked#profile")
    }

    // ── Kirish / ro'yxatdan o'tish ──
    const r = await resolveGoogleLogin(g)
    if (!r.ok) return err(r.error)
    await markLogin(r.id)
    const res = done(r.isAdmin ? "/admin" : "/?signed_in=google")
    await issueTokens(res, r.id, r.isAdmin)
    return res
  } catch (e) {
    console.error("[Google] callback xatosi:", e)
    return err("server")
  }
}
