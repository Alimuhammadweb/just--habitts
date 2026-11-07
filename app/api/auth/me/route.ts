import type { NextRequest } from "next/server"
import { fail, json, requireSession, dbErrorResponse } from "@/lib/server/api"
import { findUserById, sanitizeUser } from "@/lib/server/user-store"
import { buildEnvAdminUser } from "@/lib/server/session"

// GET /api/auth/me — cookie'dagi sessiya egasi (Google bilan kirgandan keyin brauzer shu orqali o'zini tanib oladi).
export async function GET(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  if (auth.session.id === 0) return json(buildEnvAdminUser())
  try {
    const u = await findUserById(auth.session.id)
    if (!u) return fail(401, "Foydalanuvchi topilmadi", "UNAUTHORIZED")
    if (u.isActive === false) return fail(403, "Akkaunt bloklangan")
    return json(sanitizeUser(u))
  } catch (err) {
    return dbErrorResponse(err, "Auth.me")
  }
}
