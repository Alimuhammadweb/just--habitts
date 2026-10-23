import { type NextRequest, NextResponse } from "next/server"
import { db, big } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request)
    if (!session) return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim().slice(0, 100)
    // O'zini natijalardan chiqarib tashlash uchun har doim sessiyadagi ID ishlatiladi
    const userId = session.id
    if (!query || query.length < 2) return NextResponse.json({ users: [] })

    // `contains` + `insensitive` parametrlangan LIKE — foydalanuvchi matni regex sifatida talqin qilinmaydi
    const rows = await db().user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
        id: { not: big(userId) },
        isActive: true,
        isAdmin: false,
      },
      select: { id: true, name: true, avatarUrl: true, totalXP: true, weeklyXP: true, monthlyXP: true, level: true, currentXP: true },
      take: 10,
    })
    const users = rows.map((r) => ({
      id: Number(r.id), name: r.name, ...(r.avatarUrl ? { avatarUrl: r.avatarUrl } : {}),
      xpData: { totalXP: r.totalXP, weeklyXP: r.weeklyXP, monthlyXP: r.monthlyXP, level: r.level, currentXP: r.currentXP },
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error("[Friends Search] Error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
