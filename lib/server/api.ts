import { NextResponse, type NextRequest } from "next/server"
import { getSession, type SessionPayload } from "@/lib/auth"

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } })

export const fail = (status: number, error: string, code?: string) => json({ error, ...(code ? { code } : {}) }, status)

/** Middleware o'rnatgan ishonchli sessiyani qaytaradi; yo'q bo'lsa 401 javobi. */
export function requireSession(request: NextRequest): { session: SessionPayload } | { response: NextResponse } {
  const session = getSession(request)
  if (!session) return { response: fail(401, "Avtorizatsiyadan o'tilmagan", "UNAUTHORIZED") }
  return { session }
}

export function dbErrorResponse(err: unknown, label: string) {
  console.error(`[${label}]`, err)
  const missingTable = (err as { code?: string } | null)?.code === "P2021" || /relation "[^"]+" does not exist/i.test(err instanceof Error ? err.message : "")
  if (missingTable) console.error("[DB] Jadvallar topilmadi — migratsiya qo'llanmagan. `npm run db:migrate` ni ishga tushiring.")
  const msg = err instanceof Error ? err.message : ""
  const code = (err as { code?: string } | null)?.code ?? ""
  // P1001/P1002/P1008/P1017 — Prisma ulanish xatolari; P2024 — ulanishlar puli band
  if (/^P(1001|1002|1008|1017|2024)$/.test(code) || /DATABASE_URL|ECONN|ETIMEDOUT|timed out|Connection terminated|Can't reach database/i.test(msg)) {
    return fail(503, "Serverga ulanib bo'lmadi. Keyinroq qayta urinib ko'ring.", "DB_CONNECT_ERROR")
  }
  return fail(500, "Server xatosi", "SERVER_ERROR")
}

export async function readJson(request: NextRequest): Promise<unknown | null> {
  try { return await request.json() } catch { return null }
}
