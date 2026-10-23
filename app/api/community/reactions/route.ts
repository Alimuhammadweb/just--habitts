import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, big, newNumericId, prismaCode } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const Body = z.object({ postId: z.number().int(), type: z.enum(["like", "heart", "fire"]).default("like") })

// POST - Reaction qo'shish yoki o'chirish (toggle). Bir foydalanuvchi — bitta post — bitta reaksiya (unique cheklov).
export async function POST(request: NextRequest) {
  try {
    const session = getSession(request)
    if (!session) return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 })

    const parsed = Body.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "So'rov noto'g'ri" }, { status: 400 })
    const { postId, type } = parsed.data
    const userId = session.id // mijozdan emas, sessiyadan

    const post = await db().communityPost.findUnique({ where: { id: big(postId) }, select: { id: true } })
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

    const where = { postId_userId: { postId: big(postId), userId: big(userId) } }
    const existing = await db().reaction.findUnique({ where })
    if (existing) {
      await db().reaction.deleteMany({ where: { postId: big(postId), userId: big(userId) } })
      return NextResponse.json({ action: "removed" })
    }
    try {
      const r = await db().reaction.create({ data: { id: big(newNumericId()), postId: big(postId), userId: big(userId), type } })
      return NextResponse.json({
        action: "added",
        reaction: { id: Number(r.id), postId: Number(r.postId), userId: Number(r.userId), type: r.type, createdAt: r.createdAt.toISOString() },
      })
    } catch (err) {
      // Parallel ikki marta bosilganda: ikkinchisi unique cheklovga uriladi — bitta reaksiya qoladi
      if (prismaCode(err) === "P2002") return NextResponse.json({ action: "added" })
      throw err
    }
  } catch (error) {
    console.error("[Community] Error toggling reaction:", error)
    return NextResponse.json({ error: "Failed to toggle reaction" }, { status: 500 })
  }
}
