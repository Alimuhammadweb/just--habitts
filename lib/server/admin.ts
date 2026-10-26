import type { NextRequest, NextResponse } from "next/server"
import { getSession, type SessionPayload } from "@/lib/auth"
import { db, big } from "@/lib/prisma"
import { fail } from "@/lib/server/api"

export interface AdminActor { id: number; name: string }

/**
 * Administrator huquqini SERVERDA, HAR SAFAR bazadan tasdiqlaydi.
 * JWT ichidagi `isAdmin` faqat birinchi (arzon) filtr: u 15 daqiqagacha eskirgan bo'lishi mumkin
 * (masalan, adminlik olib tashlangan bo'lsa), shuning uchun haqiqiy manba - `User.isAdmin` va `isActive`.
 * id 0 — faqat .env (ADMIN_EMAIL/ADMIN_PASSWORD) orqali kirgan admin; uning tokenini faqat shu login beradi.
 */
export async function verifyAdminActor(session: SessionPayload | null): Promise<AdminActor | null> {
  if (!session || !session.isAdmin) return null
  if (session.id === 0) return { id: 0, name: "Admin" }
  if (!Number.isSafeInteger(session.id) || session.id < 0) return null
  const u = await db().user.findUnique({ where: { id: big(session.id) }, select: { name: true, isAdmin: true, isActive: true } })
  if (!u || !u.isAdmin || !u.isActive) return null
  return { id: session.id, name: u.name }
}

export const isVerifiedAdmin = async (session: SessionPayload | null) => (await verifyAdminActor(session)) !== null

/** Admin API route'lari uchun: 401 (sessiya yo'q) / 403 (admin emas) yoki tasdiqlangan admin. */
export async function requireAdmin(request: NextRequest): Promise<{ admin: AdminActor } | { response: NextResponse }> {
  const session = getSession(request)
  if (!session) return { response: fail(401, "Avtorizatsiyadan o'tilmagan", "UNAUTHORIZED") }
  const admin = await verifyAdminActor(session)
  if (!admin) return { response: fail(403, "Faqat admin uchun", "FORBIDDEN") }
  return { admin }
}

/** Admin amallari jurnaliga yozadi. Jurnal xatosi asosiy amalni bekor qilmaydi, lekin loglanadi. */
export async function audit(
  actor: AdminActor, action: string,
  target?: { type: string; id: string | number },
  meta: Record<string, unknown> = {},
) {
  try {
    await db().auditLog.create({
      data: {
        actorId: big(actor.id), actorName: actor.name, action,
        targetType: target?.type ?? null, targetId: target ? String(target.id) : null,
        meta: meta as never,
      },
    })
  } catch (e) {
    console.error("[Audit] yozib bo'lmadi:", action, e)
  }
}

/** Query parametrlari uchun xavfsiz butun son. */
export function intParam(v: string | null, def: number, min: number, max: number) {
  const n = Number.parseInt(v ?? "", 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}
