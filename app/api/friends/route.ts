import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import type { User } from "@/types/user"

// GET /api/friends?userId=123
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = Number(searchParams.get("userId"))
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

    const db = await getDb()
    const user = await db.collection<User>("users").findOne({ id: userId })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const friendIds = user.friends || []
    const requestIds = user.friendRequests || []

    const friends = friendIds.length > 0
      ? await db.collection("users")
          .find({ id: { $in: friendIds } })
          .project({ _id: 0, id: 1, name: 1, xpData: 1, habits: 1, selectedFrame: 1, avatarUrl: 1 })
          .toArray()
      : []

    const requests = requestIds.length > 0
      ? await db.collection("users")
          .find({ id: { $in: requestIds } })
          .project({ _id: 0, id: 1, name: 1, xpData: 1 })
          .toArray()
      : []

    return NextResponse.json({ friends, requests })
  } catch (error) {
    console.error("[Friends] GET error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST /api/friends
export async function POST(request: NextRequest) {
  try {
    const { userId, targetId, action } = await request.json()
    if (!userId || !targetId || !action) {
      return NextResponse.json({ error: "userId, targetId, action required" }, { status: 400 })
    }
    if (userId === targetId) {
      return NextResponse.json({ error: "Cannot friend yourself" }, { status: 400 })
    }

    const db = await getDb()
    const col = db.collection("users")

    if (action === "send") {
      await col.updateOne({ id: targetId }, { $addToSet: { friendRequests: userId } })
      await col.updateOne({ id: userId }, { $addToSet: { sentRequests: targetId } })
      return NextResponse.json({ success: true })
    }

    if (action === "accept") {
      await col.updateOne({ id: userId }, { $addToSet: { friends: targetId } })
      await col.updateOne({ id: targetId }, { $addToSet: { friends: userId } })
      // Remove from pending lists
      await col.updateOne({ id: userId }, [{ $set: { friendRequests: { $filter: { input: "$friendRequests", cond: { $ne: ["$$this", targetId] } } } } }])
      await col.updateOne({ id: targetId }, [{ $set: { sentRequests: { $filter: { input: "$sentRequests", cond: { $ne: ["$$this", userId] } } } } }])
      return NextResponse.json({ success: true })
    }

    if (action === "decline") {
      await col.updateOne({ id: userId }, [{ $set: { friendRequests: { $filter: { input: "$friendRequests", cond: { $ne: ["$$this", targetId] } } } } }])
      await col.updateOne({ id: targetId }, [{ $set: { sentRequests: { $filter: { input: "$sentRequests", cond: { $ne: ["$$this", userId] } } } } }])
      return NextResponse.json({ success: true })
    }

    if (action === "remove") {
      await col.updateOne({ id: userId }, [{ $set: { friends: { $filter: { input: "$friends", cond: { $ne: ["$$this", targetId] } } } } }])
      await col.updateOne({ id: targetId }, [{ $set: { friends: { $filter: { input: "$friends", cond: { $ne: ["$$this", userId] } } } } }])
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("[Friends] POST error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
