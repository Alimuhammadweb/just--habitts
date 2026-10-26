import type { NextRequest } from "next/server"
import { z } from "zod"
import { json, fail, requireSession, dbErrorResponse } from "@/lib/server/api"
import { db, big } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"
import { DEFAULT_TIMEZONE, todayKey, weekStart } from "@/lib/dates"
import { calculateLevel } from "@/lib/xp-system"

/**
 * REYTING (server tomonida).
 *  - all : totalXP ustuni bo'yicha (umr bo'yi)
 *  - week: weeklyXP ustuni bo'yicha; faqat joriy kalendar haftasi (dushanba boshlanadi) uchun
 *          hisoblangan yozuvlar (weekKey) hisobga olinadi. Haftalik "reset" - sana oralig'i;
 *          umr bo'yi XP hech qachon o'chirilmaydi.
 *  - Munosib: faol (bloklanmagan), admin bo'lmagan, balli > 0 foydalanuvchilar.
 *  - Tartib: ball kamayish, keyin ro'yxatdan o'tgan vaqt (eski birinchi), keyin id (deterministik).
 *  - Faqat TOP 10 qaytariladi. Joriy foydalanuvchi 10 talikdan tashqarida bo'lsa, `me` alohida.
 *  - Javobda faqat ommaviy maydonlar: email, parol, odatlar va h.k. yo'q.
 */
const TOP_N = 10
const Query = z.object({ period: z.enum(["all", "week"]).default("all") })

const PUBLIC_SELECT = {
  id: true, name: true, firstName: true, lastName: true, avatarUrl: true, createdAt: true,
  selectedBorder: true, selectedFrame: true, selectedBadge: true, selectedBackground: true,
  totalXP: true, weeklyXP: true, weekKey: true,
} as const

type Row = {
  id: bigint; name: string; firstName: string | null; lastName: string | null; avatarUrl: string | null; createdAt: Date
  selectedBorder: string | null; selectedFrame: string | null; selectedBadge: string | null; selectedBackground: string | null
  totalXP: number; weeklyXP: number; weekKey: string | null
}

const displayName = (u: Row) => (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.name || "Foydalanuvchi")
const safeAvatar = (u?: string | null) => (u && /^https?:\/\//.test(u) ? u : undefined)

export async function GET(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const q = Query.safeParse({ period: request.nextUrl.searchParams.get("period") ?? undefined })
  if (!q.success) return fail(400, "period noto'g'ri", "VALIDATION")
  const { period } = q.data

  try {
    const thisWeek = weekStart(todayKey(DEFAULT_TIMEZONE))
    const scoreField = period === "week" ? "weeklyXP" : "totalXP"
    const base: Prisma.UserWhereInput = {
      isActive: true, isAdmin: false, id: { gt: BigInt(0) }, [scoreField]: { gt: 0 },
      ...(period === "week" ? { weekKey: thisWeek } : {}),
    }
    const score = (u: Row) => (period === "week" ? u.weeklyXP : u.totalXP) ?? 0

    const top = (await db().user.findMany({
      where: base,
      select: PUBLIC_SELECT,
      orderBy: [{ [scoreField]: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      take: TOP_N,
    })) as Row[]

    const shape = (u: Row, rank: number) => ({
      rank, id: Number(u.id), displayName: displayName(u), avatarUrl: safeAvatar(u.avatarUrl),
      level: calculateLevel(u.totalXP ?? 0), score: score(u),
      selectedBorder: u.selectedBorder ?? undefined, selectedFrame: u.selectedFrame ?? undefined,
      selectedBadge: u.selectedBadge ?? undefined, selectedBackground: u.selectedBackground ?? undefined,
      isMe: Number(u.id) === auth.session.id,
    })
    const entries = top.map((u, i) => shape(u, i + 1))

    let me: ReturnType<typeof shape> | null = null
    if (auth.session.id > 0 && !entries.some((e) => e.isMe)) {
      const mine = (await db().user.findFirst({
        where: { id: big(auth.session.id), isActive: true, isAdmin: false },
        select: PUBLIC_SELECT,
      })) as Row | null
      const myScore = mine ? score(mine) : 0
      const eligible = mine && myScore > 0 && (period === "all" || mine.weekKey === thisWeek)
      if (mine && eligible) {
        const ahead = await db().user.count({
          where: {
            ...base,
            OR: [
              { [scoreField]: { gt: myScore } },
              { [scoreField]: myScore, createdAt: { lt: mine.createdAt } },
              { [scoreField]: myScore, createdAt: mine.createdAt, id: { lt: mine.id } },
            ],
          },
        })
        me = shape(mine, ahead + 1)
      }
    }

    return json({ period, limit: TOP_N, weekStart: period === "week" ? thisWeek : undefined, entries, me })
  } catch (err) {
    return dbErrorResponse(err, "Leaderboard")
  }
}
