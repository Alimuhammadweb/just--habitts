import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, avatarData } = body

    if (!userId || !avatarData) {
      return NextResponse.json({ error: "Missing userId or avatarData" }, { status: 400 })
    }

    const db = await getDb()

    const result = await db.collection("users").updateOne({ id: userId }, { $set: { avatarUrl: avatarData } })

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, avatarUrl: avatarData })
  } catch (error) {
    console.error("Error uploading avatar:", error)
    return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 })
  }
}
