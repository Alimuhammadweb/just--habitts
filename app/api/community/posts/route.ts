import { NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

export async function GET() {
  try {
    const db = await getDb()
    const posts = await db.collection("community_posts")
      .find({})
      .sort({ isPinned: -1, createdAt: -1 })
      .toArray()
    const clean = posts.map(({ _id, ...p }) => p)
    return NextResponse.json(clean)
  } catch (error) {
    console.error("[Community] GET xato:", error)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, userName, userAvatar, title, content, imageUrl, linkUrl, isAdmin } = body

    if (!userId || !content?.trim()) {
      return NextResponse.json({ error: "Kontent kerak" }, { status: 400 })
    }

    const db = await getDb()

    // Admin pinned posts: unpin all previous
    if (isAdmin) {
      await db.collection("community_posts").updateMany(
        { isPinned: true },
        { $set: { isPinned: false } }
      )
    }

    const newPost = {
      id: Date.now(),
      userId,
      userName: userName || "Foydalanuvchi",
      userAvatar: userAvatar || "",
      title: title || "",
      content: content.trim(),
      isPinned: isAdmin ? true : false,
      isAdminPost: Boolean(isAdmin),
      imageUrl: imageUrl || "",
      linkUrl: linkUrl || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
      reactions: [],
    }

    await db.collection("community_posts").insertOne({ ...newPost })
    return NextResponse.json(newPost, { status: 201 })
  } catch (error) {
    console.error("[Community] POST xato:", error)
    return NextResponse.json({ error: "Post yaratilmadi" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = Number(searchParams.get("postId"))
    const userId = Number(searchParams.get("userId"))

    if (!postId || !userId) {
      return NextResponse.json({ error: "postId va userId kerak" }, { status: 400 })
    }

    const db = await getDb()
    const post = await db.collection("community_posts").findOne({ id: postId })

    if (!post) return NextResponse.json({ error: "Post topilmadi" }, { status: 404 })

    // Can delete: own post OR admin
    const user = await db.collection("users").findOne({ id: userId })
    const canDelete = post.userId === userId || user?.isAdmin === true

    if (!canDelete) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 })
    }

    await db.collection("community_posts").deleteOne({ id: postId })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Community] DELETE xato:", error)
    return NextResponse.json({ error: "O'chirilmadi" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { postId, adminId, updates } = await request.json()

    const db = await getDb()
    const admin = await db.collection("users").findOne({ id: adminId, isAdmin: true })
    if (!admin) return NextResponse.json({ error: "Faqat admin uchun" }, { status: 403 })

    if (updates.isPinned === true) {
      await db.collection("community_posts").updateMany({ isPinned: true }, { $set: { isPinned: false } })
    }

    const updated = await db.collection("community_posts").findOneAndUpdate(
      { id: postId },
      { $set: { ...updates, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" }
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[Community] PATCH xato:", error)
    return NextResponse.json({ error: "Yangilanmadi" }, { status: 500 })
  }
}
