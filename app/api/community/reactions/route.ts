import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

// POST - Reaction qo'shish yoki o'chirish (toggle)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { postId, userId, type } = body

    const { db } = await connectToDatabase()
    const post = await db.collection("community_posts").findOne({ id: postId })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    const existingReaction = post.reactions?.find((r: { userId: number; type: string }) => r.userId === userId)

    if (existingReaction) {
      // O'chirish
      await db.collection("community_posts").updateOne({ id: postId }, { $pull: { reactions: { userId } } })
      return NextResponse.json({ action: "removed" })
    } else {
      // Qo'shish
      const newReaction = {
        id: Date.now(),
        postId,
        userId,
        type,
        createdAt: new Date().toISOString(),
      }
      await db.collection("community_posts").updateOne({ id: postId }, { $push: { reactions: newReaction } })
      return NextResponse.json({ action: "added", reaction: newReaction })
    }
  } catch (error) {
    console.error("[v0] Error toggling reaction:", error)
    return NextResponse.json({ error: "Failed to toggle reaction" }, { status: 500 })
  }
}
