import { type NextRequest, NextResponse } from "next/server"
import { db, big, prismaCode } from "@/lib/prisma"
import { userInclude, rowToUser } from "@/lib/server/user-store"
import { getSession } from "@/lib/auth"

const friendSelect = { id: true } as const

// GET /api/friends?userId=123
export async function GET(request: NextRequest) {
  try {
    const session = getSession(request)
    if (!session) return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const requestedId = Number(searchParams.get("userId"))
    if (!requestedId) return NextResponse.json({ error: "userId required" }, { status: 400 })
    // Faqat o'zining do'stlar/so'rovlar ro'yxatini ko'ra oladi
    if (!session.isAdmin && requestedId !== session.id) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 })
    }
    const userId = big(requestedId)

    const exists = await db().user.findUnique({ where: { id: userId }, select: friendSelect })
    if (!exists) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const [friendRows, requestRows] = await Promise.all([
      db().user.findMany({
        where: { friendOf: { some: { userId } } },
        include: userInclude,
      }),
      db().user.findMany({
        where: { sentRequests: { some: { toId: userId } } },
        select: { id: true, name: true, totalXP: true, weeklyXP: true, level: true, rank: true, currentXP: true, monthlyXP: true },
      }),
    ])

    const friends = friendRows.map((r) => {
      const u = rowToUser(r)
      return {
        id: u.id, name: u.name, avatarUrl: u.avatarUrl, selectedFrame: u.selectedFrame, habits: u.habits,
        xpData: { ...u.xpData, xpHistory: [] },
      }
    })
    const requests = requestRows.map((r) => ({
      id: Number(r.id), name: r.name,
      xpData: { totalXP: r.totalXP, weeklyXP: r.weeklyXP, monthlyXP: r.monthlyXP, level: r.level, rank: r.rank, currentXP: r.currentXP },
    }))

    return NextResponse.json({ friends, requests })
  } catch (error) {
    console.error("[Friends] GET error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST /api/friends
export async function POST(request: NextRequest) {
  try {
    const session = getSession(request)
    if (!session) return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const { userId: bodyUserId, targetId, action } = body ?? {}
    if (!bodyUserId || !targetId || !action) {
      return NextResponse.json({ error: "userId, targetId, action required" }, { status: 400 })
    }
    if (!Number.isSafeInteger(bodyUserId) || !Number.isSafeInteger(targetId)) {
      return NextResponse.json({ error: "userId, targetId noto'g'ri" }, { status: 400 })
    }
    // Faqat o'z nomidan harakat qila oladi - boshqa birovning ID'sidan
    // foydalanib do'stlik so'rovi yubora/qabul qila olmaydi
    if (!session.isAdmin && bodyUserId !== session.id) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 })
    }
    if (bodyUserId === targetId) {
      return NextResponse.json({ error: "Cannot friend yourself" }, { status: 400 })
    }
    const me = big(bodyUserId), other = big(targetId)

    if (action === "send") {
      const target = await db().user.findUnique({ where: { id: other }, select: { isActive: true, isAdmin: true } })
      if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })
      const already = await db().friendship.findUnique({ where: { userId_friendId: { userId: me, friendId: other } } })
      if (!already) await db().friendRequest.createMany({ data: [{ fromId: me, toId: other }], skipDuplicates: true })
      return NextResponse.json({ success: true })
    }

    if (action === "accept") {
      // Faqat haqiqatan kelgan so'rovni qabul qilish mumkin
      const pending = await db().friendRequest.findUnique({ where: { fromId_toId: { fromId: other, toId: me } } })
      if (!pending) return NextResponse.json({ error: "So'rov topilmadi" }, { status: 404 })
      await db().$transaction([
        db().friendship.createMany({ data: [{ userId: me, friendId: other }, { userId: other, friendId: me }], skipDuplicates: true }),
        db().friendRequest.deleteMany({ where: { OR: [{ fromId: other, toId: me }, { fromId: me, toId: other }] } }),
      ])
      return NextResponse.json({ success: true })
    }

    if (action === "decline") {
      await db().friendRequest.deleteMany({ where: { fromId: other, toId: me } })
      return NextResponse.json({ success: true })
    }

    if (action === "remove") {
      await db().friendship.deleteMany({ where: { OR: [{ userId: me, friendId: other }, { userId: other, friendId: me }] } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    if (prismaCode(error) === "P2003") return NextResponse.json({ error: "User not found" }, { status: 404 })
    console.error("[Friends] POST error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
