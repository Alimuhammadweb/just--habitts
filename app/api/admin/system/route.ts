import type { NextRequest } from "next/server"
import { db } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server/admin"
import { json } from "@/lib/server/api"
import { googleConfigured } from "@/lib/server/google"

// GET /api/admin/system — ilova holati: faqat sozlangan/sozlanmagan (qiymatlar HECH QACHON chiqmaydi).
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const t0 = Date.now()
  let dbOk = false, migrations: number | null = null, lastMigration: string | null = null
  try {
    await db().$queryRaw`SELECT 1`
    dbOk = true
    try {
      const m = await db().$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC`
      migrations = m.length; lastMigration = m[0]?.migration_name ?? null
    } catch { /* _prisma_migrations yo'q bo'lishi mumkin */ }
  } catch { /* dbOk=false */ }
  const [expiredTokens, rateLimitRows] = dbOk
    ? await Promise.all([db().refreshToken.count({ where: { expiresAt: { lt: new Date() } } }), db().rateLimit.count()]).catch(() => [null, null] as const)
    : [null, null] as const
  return json({
    serverTime: new Date().toISOString(), node: process.version, env: process.env.NODE_ENV,
    database: { ok: dbOk, latencyMs: Date.now() - t0, migrations, lastMigration },
    features: {
      googleSignIn: googleConfigured(),
      passwordReset: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM && process.env.APP_URL),
      weeklyEmailCron: Boolean(process.env.CRON_SECRET),
      envAdminLogin: Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD),
      appUrl: Boolean(process.env.APP_URL),
    },
    housekeeping: { expiredRefreshTokens: expiredTokens, rateLimitRows },
  })
}
