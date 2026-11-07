import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

/**
 * PostgreSQL (Prisma) klienti — Vercel serverless uchun mos:
 *  - har bir funksiya instansiyasida bitta klient (global'da keshlanadi),
 *  - kichik ulanishlar puli (max 3) — Neon/Supabase pooler bilan birga ishlaydi,
 *  - klient faqat birinchi so'rovda yaratiladi (DATABASE_URL yo'q bo'lsa build buzilmaydi).
 */
const globalForPrisma = globalThis as typeof globalThis & { _prisma?: PrismaClient }

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment o'zgaruvchisi aniqlanmagan. Vercel Dashboard > Settings > Environment Variables ga qo'shing.",
    )
  }
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX || 3),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 20_000,
  })
  return new PrismaClient({ adapter })
}

export function db(): PrismaClient {
  if (!globalForPrisma._prisma) globalForPrisma._prisma = createClient()
  return globalForPrisma._prisma
}

export { Prisma } from "@/generated/prisma/client"

/** Prisma xato kodini olish (masalan P2002 — unique buzilishi, P2025 — topilmadi). */
export const prismaCode = (err: unknown): string | undefined => (err as { code?: string } | null)?.code

export const big = (n: number): bigint => BigInt(Math.trunc(n))
export const num = (v: bigint | number | null | undefined): number | undefined => (v == null ? undefined : Number(v))

/** Yangi yozuvlar (post, izoh, reaksiya, odat) uchun ID — avvalgi sxema bilan bir xil: vaqt*1000 + tasodifiy. */
export const newNumericId = (): number => Date.now() * 1000 + Math.floor(Math.random() * 1000)
