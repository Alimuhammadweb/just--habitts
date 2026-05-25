import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import type { User } from "@/types/user"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim()
    const userId = Number(searchParams.get("userId"))
    if (!query || query.length < 2) return NextResponse.json({ users: [] })

    const db = await getDb()
    const users = await db.collection<User>("users")
      .find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
        id: { $ne: userId },
        isActive: true,
        isAdmin: { $ne: true },
      })
      .project({ _id: 0, id: 1, name: 1, xpData: 1, avatarUrl: 1 })
      .limit(10)
      .toArray()

    return NextResponse.json({ users })
  } catch (error) {
    console.error("[Friends Search] Error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
