import { NextResponse, type NextRequest } from "next/server"
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/auth"

// Ushbu saytdan kelgan so'rovlarga ruxsat berilgan manbalar (originlar).
// Productionda faqat o'z domenimiz, lokal ishlab chiqishda esa
// localhost portlariga ham ruxsat beramiz.
const ALLOWED_ORIGINS = [
  "https://just-habitts-steel.vercel.app",
  ...(process.env.EXTRA_ALLOWED_ORIGIN ? [process.env.EXTRA_ALLOWED_ORIGIN] : []),
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://127.0.0.1:3000"]
    : []),
]

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false
  return ALLOWED_ORIGINS.includes(origin)
}

function applyCorsHeaders(res: NextResponse, origin: string | null) {
  if (isAllowedOrigin(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin)
    res.headers.set("Vary", "Origin")
    res.headers.set("Access-Control-Allow-Credentials", "true")
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
    res.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization")
  }
  return res
}

// Autentifikatsiyasiz kirish mumkin bo'lgan yo'llar:
// - login qilish
// - ro'yxatdan o'tish (POST /api/users)
// - refresh token bilan yangi access token olish (o'zining tekshiruvi bor)
// - health check
const PUBLIC_PATHS: { path: string; methods?: string[] }[] = [
  { path: "/api/auth/login" },
  { path: "/api/auth/logout" },
  { path: "/api/auth/refresh" },
  { path: "/api/health" },
  { path: "/api/auth/config" },
  { path: "/api/auth/forgot", methods: ["POST"] },
  { path: "/api/auth/reset", methods: ["POST"] },
  { path: "/api/users", methods: ["POST"] }, // ro'yxatdan o'tish
  { path: "/api/email/weekly" }, // o'zining CRON_SECRET tekshiruvi bor
]

function isPublicPath(pathname: string, method: string): boolean {
  return PUBLIC_PATHS.some((p) => {
    if (p.path !== pathname) return false
    if (!p.methods) return true
    return p.methods.includes(method)
  })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get("origin")

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Browser'dan kelgan preflight (OPTIONS) so'rovlarini shu yerda javob beramiz.
  if (request.method === "OPTIONS") {
    return applyCorsHeaders(new NextResponse(null, { status: 204 }), origin)
  }

  // Brauzerdan kelib, ruxsat etilmagan originga ega bo'lgan so'rovlarni
  // rad etamiz. Origin sarlavhasi bo'lmagan so'rovlar (server-to-server,
  // curl, mobil ilova va h.k.) shu yerda bloklanmaydi - ular uchun himoya
  // pastdagi autentifikatsiya tekshiruvi orqali ta'minlanadi.
  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Bu manbadan (origin) so'rovga ruxsat yo'q" }, { status: 403 })
  }

  if (isPublicPath(pathname, request.method)) {
    return applyCorsHeaders(NextResponse.next(), origin)
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value
  const session = token ? await verifyAccessToken(token) : null

  if (!session) {
    // TOKEN_EXPIRED kodi orqali klient /api/auth/refresh'ni chaqirib,
    // keyin so'rovni qayta yuborishi mumkin.
    return applyCorsHeaders(
      NextResponse.json(
        { error: "Avtorizatsiyadan o'tilmagan. Iltimos qayta kiring.", code: "TOKEN_EXPIRED" },
        { status: 401 },
      ),
      origin,
    )
  }

  // Mijozdan kelishi mumkin bo'lgan soxta x-user-id/x-user-admin
  // headerlarini tozalab, faqat tasdiqlangan tokendan olingan
  // qiymatlarni qo'yamiz - shunda route handlerlar bu headerlarga
  // to'liq ishonishi mumkin.
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.delete("x-user-id")
  forwardedHeaders.delete("x-user-admin")
  forwardedHeaders.set("x-user-id", String(session.id))
  forwardedHeaders.set("x-user-admin", session.isAdmin ? "true" : "false")

  return applyCorsHeaders(NextResponse.next({ request: { headers: forwardedHeaders } }), origin)
}

export const config = {
  matcher: ["/api/:path*"],
}
