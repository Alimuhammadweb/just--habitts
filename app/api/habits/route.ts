import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const { userId, habit } = await request.json()
    const db = await getDb()

    // Add habit to user's habits array
    await db.collection("users").updateOne({ id: userId }, { $push: { habits: habit } })

    return NextResponse.json({ success: true, habit })
  } catch (error) {
    console.error("[MongoDB] Error adding habit:", error)
    return NextResponse.json({ error: "Failed to add habit" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, habitId, updates } = await request.json()
    const db = await getDb()

    // Update specific habit in user's habits array
    await db.collection("users").updateOne({ id: userId, "habits.id": habitId }, { $set: { "habits.$": updates } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[MongoDB] Error updating habit:", error)
    return NextResponse.json({ error: "Failed to update habit" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId, habitId } = await request.json()
    const db = await getDb()

    // Remove habit from user's habits array
    await db.collection("users").updateOne({ id: userId }, { $pull: { habits: { id: habitId } } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[MongoDB] Error deleting habit:", error)
    return NextResponse.json({ error: "Failed to delete habit" }, { status: 500 })
  }
}
