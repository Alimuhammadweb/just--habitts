import { NextResponse, type NextRequest } from "next/server"
import { ACCESS_COOKIE, REFRESH_COOKIE, verifyRefreshToken } from "@/lib/auth"
import { revokeRefreshToken } from "@/lib/refresh-tokens"

export async function POST(request: NextRequest) {
  const refreshCookie = request.cookies.get(REFRESH_COOKIE)?.value
  if (refreshCookie) {
    try {
      const payload = await verifyRefreshToken(refreshCookie)
      // Admin (id 0) uchun DB yozuvi yo'q, revoke qilishga hojat yo'q.
      if (payload && payload.id !== 0) {
        await revokeRefreshToken(payload.jti)
      }
    } catch (err) {
      // Chiqishga xalaqit bermasligi kerak - loglab, davom etamiz.
      console.error("[Auth] Logout - refresh tokenni bekor qilishda xato:", err)
    }
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 })
  res.cookies.set(REFRESH_COOKIE, "", { path: "/api/auth", maxAge: 0 })
  return res
}
