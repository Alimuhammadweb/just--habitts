import { db } from "@/lib/prisma"

/**
 * PostgreSQL asosidagi oddiy cheklov (serverless'da ham ishlaydi).
 * Bitta atomik INSERT ... ON CONFLICT so'rovi: oyna tugagan bo'lsa hisoblagich 1 dan boshlanadi.
 * Eski yozuvlar vaqti-vaqti bilan tozalanadi (TTL indeks o'rniga).
 */
export async function hit(key: string, limit: number, windowSec: number): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date()
  const exp = new Date(now.getTime() + windowSec * 1000)
  const rows = await db().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt")
    VALUES (${key}, 1, ${exp}::timestamp)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= ${now}::timestamp THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now}::timestamp THEN ${exp}::timestamp ELSE "RateLimit"."expiresAt" END
    RETURNING "count"`
  const count = Number(rows[0]?.count ?? 1)
  if (Math.random() < 0.02) db().rateLimit.deleteMany({ where: { expiresAt: { lte: now } } }).catch(() => {})
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) }
}

export async function clear(key: string) {
  try { await db().rateLimit.deleteMany({ where: { key } }) } catch { /* e'tiborsiz */ }
}

export const clientIp = (h: Headers) => (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim()
