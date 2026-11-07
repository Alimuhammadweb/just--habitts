import { NextResponse, type NextRequest } from "next/server"
import { createOAuthStateToken, OAUTH_COOKIE, OAUTH_COOKIE_OPTIONS } from "@/lib/auth"
import { appBase, buildAuthUrl, googleConfigured, logRedirectUri, randomToken, redirectUri } from "@/lib/server/google"

// GET /api/auth/google/start — "Google bilan davom etish": state/nonce/PKCE yaratib, Google'ga yo'naltiradi.
export async function GET(request: NextRequest) {
  if (!googleConfigured()) return NextResponse.redirect(new URL("/?auth_error=google_unavailable", appBase(request)))
  // Lokal diagnostika (faqat `next dev`): brauzerda /api/auth/google/start?debug=1 — Console'ga kiritiladigan aniq manzillar
  if (process.env.NODE_ENV !== "production" && request.nextUrl.searchParams.get("debug") === "1") {
    return NextResponse.json({
      authorizedJavaScriptOrigin: request.nextUrl.origin,
      authorizedRedirectUri: redirectUri(request),
      note: "Google Cloud Console → Credentials → OAuth client: shu ikki qiymatni AYNAN shunday kiriting (oxirida / bo'lmasin).",
    })
  }
  logRedirectUri(request)
  const p = { state: randomToken(), nonce: randomToken(), verifier: randomToken(48) }
  const res = NextResponse.redirect(buildAuthUrl(request, p))
  res.cookies.set(OAUTH_COOKIE, await createOAuthStateToken({ ...p, mode: "login" }), OAUTH_COOKIE_OPTIONS)
  res.headers.set("Cache-Control", "no-store")
  return res
}
