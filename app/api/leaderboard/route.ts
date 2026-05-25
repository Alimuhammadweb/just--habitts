import type { User } from "@/types/user"
import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { calculateRanks } from "@/lib/xp-system"

export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const rawUsers = await db.collection("users").find({}).toArray()

    // _id ni olib tashlaymiz
    const users = rawUsers.map(({ _id, ...u }) => u) as User[]

    // Calculate ranks for all users
    const usersWithRanks = calculateRanks(users)

    // Save updated ranks back to database
    const bulkOps = usersWithRanks.map((user) => ({
      updateOne: {
        filter: { id: user.id },
        update: { $set: { xpData: user.xpData } },
      },
    }))

    if (bulkOps.length > 0) {
      await db.collection("users").bulkWrite(bulkOps)
    }

    return NextResponse.json(usersWithRanks)
  } catch (error) {
    console.error("[MongoDB] Error fetching leaderboard:", error)
    return NextResponse.json([], { status: 200 }) // bo'sh array - crash oldini olish
  }
}
