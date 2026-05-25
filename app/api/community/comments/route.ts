import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

// POST - Yangi comment qo'shish
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { postId, userId, userName, userAvatar, content } = body

    const { db } = await connectToDatabase()

    // Spam checking - bir daqiqada 5 tadan ko'p comment qo'ymaslik
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()
    const post = await db.collection("community_posts").findOne({ id: postId })
    const recentUserComments = post?.comments?.filter(
      (c: { userId: number; createdAt: string }) =>
        c.userId === userId && c.createdAt >= oneMinuteAgo
    ) || []

    if (recentUserComments.length >= 5) {
      return NextResponse.json({ error: "Too many comments. Please wait." }, { status: 429 })
    }

    const newComment = {
      id: Date.now(),
      postId,
      userId,
      userName,
      userAvatar: userAvatar || "",
      content,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    }

    await db.collection("community_posts").updateOne({ id: postId }, { $push: { comments: newComment } })

    return NextResponse.json(newComment, { status: 201 })
  } catch (error) {
    console.error("[v0] Error creating comment:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}

// DELETE - Comment o'chirish (o'z comment yoki admin)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = Number(searchParams.get("postId"))
    const commentId = Number(searchParams.get("commentId"))
    const userId = Number(searchParams.get("userId"))

    const { db } = await connectToDatabase()
    const user = await db.collection("users").findOne({ id: userId })
    const post = await db.collection("community_posts").findOne({ id: postId })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    const comment = post.comments?.find((c: { id: number; userId: number; content: string }) => c.id === commentId)

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    // Faqat o'z commentini yoki admin o'chirishi mumkin
    if (comment.userId !== userId && !user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    await db.collection("community_posts").updateOne({ id: postId }, { $pull: { comments: { id: commentId } } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting comment:", error)
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}
