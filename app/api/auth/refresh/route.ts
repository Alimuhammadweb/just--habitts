import { NextResponse, type NextRequest } from "next/server"
import {
  REFRESH_COOKIE,
  ACCESS_COOKIE,
  ACCESS_COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth"
import { newTokenId } from "@/lib/auth-refresh"
<<<<<<< HEAD
import { isRefreshTokenValid, rotateRefreshToken, revokeAllRefreshTokensForUser } from "@/lib/refresh-tokens"
import { db, big } from "@/lib/prisma"
=======
import { isRefreshTokenValid, rotateRefreshToken } from "@/lib/refresh-tokens"
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d

const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

// POST /api/auth/refresh - refresh_token cookie orqali yangi access token
// (va rotatsiya qilingan yangi refresh token) oladi.
export async function POST(request: NextRequest) {
  try {
    const refreshCookie = request.cookies.get(REFRESH_COOKIE)?.value
    if (!refreshCookie) {
      return NextResponse.json({ error: "Refresh token topilmadi" }, { status: 401 })
    }

    const payload = await verifyRefreshToken(refreshCookie)
    if (!payload) {
      return NextResponse.json({ error: "Refresh token yaroqsiz" }, { status: 401 })
    }

    // Admin (id 0) DB'da saqlanmaydi - refresh_tokens tekshiruvidan o'tkazmasdan
    // to'g'ridan-to'g'ri yangilaymiz, chunki uning yozuvi ham DB'da yo'q.
    if (payload.id !== 0) {
      let check
      try {
        check = await isRefreshTokenValid(payload.jti, refreshCookie)
      } catch (dbErr) {
        console.error("[Auth] Refresh - ma'lumotlar bazasiga ulanish xatosi:", dbErr)
        return NextResponse.json({ error: "Serverga ulanib bo'lmadi", code: "DB_CONNECT_ERROR" }, { status: 503 })
      }
      if (!check.valid) {
        return NextResponse.json({ error: "Refresh token bekor qilingan yoki eskirgan" }, { status: 401 })
      }
    }

<<<<<<< HEAD
    // Rol va faollik holati tokendan emas, HAR SAFAR bazadan olinadi: adminligi olib tashlangan yoki
    // bloklangan foydalanuvchi eski refresh token bilan huquqini yangilab ololmaydi.
    let isAdmin = payload.isAdmin
    if (payload.id !== 0) {
      try {
        const u = await db().user.findUnique({ where: { id: big(payload.id) }, select: { isAdmin: true, isActive: true } })
        if (!u || !u.isActive) {
          if (u) await revokeAllRefreshTokensForUser(payload.id)
          return NextResponse.json({ error: "Akkaunt faol emas" }, { status: 401 })
        }
        isAdmin = u.isAdmin
      } catch (dbErr) {
        console.error("[Auth] Refresh - foydalanuvchini tekshirishda xato:", dbErr)
        return NextResponse.json({ error: "Serverga ulanib bo'lmadi", code: "DB_CONNECT_ERROR" }, { status: 503 })
      }
    }

    const newAccess = await createAccessToken({ id: payload.id, isAdmin })
    const newJti = newTokenId()
    const newRefresh = await createRefreshToken({ id: payload.id, isAdmin }, newJti)
=======
    const newAccess = await createAccessToken({ id: payload.id, isAdmin: payload.isAdmin })
    const newJti = newTokenId()
    const newRefresh = await createRefreshToken({ id: payload.id, isAdmin: payload.isAdmin }, newJti)
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d

    if (payload.id !== 0) {
      try {
        await rotateRefreshToken(payload.jti, newJti, payload.id, newRefresh, REFRESH_MAX_AGE_SECONDS)
      } catch (dbErr) {
        console.error("[Auth] Refresh - rotatsiya xatosi:", dbErr)
        return NextResponse.json({ error: "Serverga ulanib bo'lmadi", code: "DB_CONNECT_ERROR" }, { status: 503 })
      }
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set(ACCESS_COOKIE, newAccess, ACCESS_COOKIE_OPTIONS)
    res.cookies.set(REFRESH_COOKIE, newRefresh, REFRESH_COOKIE_OPTIONS)
    return res
  } catch (error) {
    console.error("[Auth] Refresh xato:", error)
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 })
  }
}
