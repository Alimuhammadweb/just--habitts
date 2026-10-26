import { type NextRequest } from "next/server"
import { createOAuthStateToken, OAUTH_COOKIE, OAUTH_COOKIE_OPTIONS } from "@/lib/auth"
import { fail, json, requireSession } from "@/lib/server/api"
import { buildAuthUrl, googleConfigured, randomToken } from "@/lib/server/google"

// POST /api/auth/google/link — HOZIR kirgan foydalanuvchi o'z hisobiga Google'ni ulaydi (middleware sessiyani tekshiradi).
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  if (!googleConfigured()) return fail(501, "Google bilan kirish bu serverda sozlanmagan", "GOOGLE_UNAVAILABLE")
  if (auth.session.id === 0) return fail(400, "Admin akkauntga Google ulanmaydi", "NOT_SUPPORTED")
  const p = { state: randomToken(), nonce: randomToken(), verifier: randomToken(48) }
  const res = json({ url: buildAuthUrl(request, p) })
  res.cookies.set(OAUTH_COOKIE, await createOAuthStateToken({ ...p, mode: "link", uid: auth.session.id }), OAUTH_COOKIE_OPTIONS)
  return res
}
