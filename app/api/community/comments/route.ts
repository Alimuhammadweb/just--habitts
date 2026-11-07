import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, big, newNumericId } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { isVerifiedAdmin } from "@/lib/server/admin"

const NewComment = z.object({ postId: z.number().int(), content: z.string().trim().min(1).max(2000) })

// POST - Yangi comment qo'shish
export async function POST(request: NextRequest) {
  try {
    const session = getSession(request)
    if (!session) return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 })

    const parsed = NewComment.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Izoh matni kerak" }, { status: 400 })
    const { postId, content } = parsed.data
    const userId = session.id // mijozdan emas, sessiyadan

    const post = await db().communityPost.findUnique({ where: { id: big(postId) }, select: { id: true, isPublished: true } })
    if (!post || !post.isPublished) return NextResponse.json({ error: "Post not found" }, { status: 404 })

    // Spam checking - bir daqiqada 5 tadan ko'p comment qo'ymaslik
    const recent = await db().comment.count({
      where: { postId: big(postId), userId: big(userId), createdAt: { gte: new Date(Date.now() - 60_000) } },
    })
    if (recent >= 5) {
      return NextResponse.json({ error: "Too many comments. Please wait." }, { status: 429 })
    }

    // Muallif ismi va avatari bazadan olinadi
    let userName = "Admin", userAvatar = ""
    if (userId > 0) {
      const u = await db().user.findUnique({ where: { id: big(userId) }, select: { name: true, avatarUrl: true } })
      if (!u) return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 })
      userName = u.name || "Foydalanuvchi"
      userAvatar = u.avatarUrl || ""
    }

    const c = await db().comment.create({
      data: { id: big(newNumericId()), postId: big(postId), userId: big(userId), userName, userAvatar, content },
    })

    return NextResponse.json({
      id: Number(c.id), postId: Number(c.postId), userId: Number(c.userId), userName: c.userName, userAvatar: c.userAvatar,
      content: c.content, createdAt: c.createdAt.toISOString(), isDeleted: c.isDeleted,
    }, { status: 201 })
  } catch (error) {
    console.error("[Community] Error creating comment:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}

// DELETE - Comment o'chirish (o'z comment yoki admin)
export async function DELETE(request: NextRequest) {
  try {
    const session = getSession(request)
    if (!session) return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const postId = Number(searchParams.get("postId"))
    const commentId = Number(searchParams.get("commentId"))
    if (!Number.isSafeInteger(postId) || !Number.isSafeInteger(commentId) || !postId || !commentId) {
      return NextResponse.json({ error: "postId va commentId kerak" }, { status: 400 })
    }

    const post = await db().communityPost.findUnique({ where: { id: big(postId) }, select: { id: true } })
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

    const comment = await db().comment.findFirst({ where: { id: big(commentId), postId: big(postId) } })
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })

    // Faqat o'z commentini yoki admin o'chirishi mumkin (sessiyadan tasdiqlangan)
    if (Number(comment.userId) !== session.id && !(session.isAdmin && (await isVerifiedAdmin(session)))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    await db().comment.delete({ where: { id: big(commentId) } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Community] Error deleting comment:", error)
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}
