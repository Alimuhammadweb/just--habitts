import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const { userId, session } = await request.json()
    const db = await getDb()

    // Update user's pomodoro data
    const user = await db.collection("users").findOne({ id: userId })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const pomodoroData = user.pomodoroData || { sessions: [], totalPomodoros: 0 }
    const existingSessionIndex = pomodoroData.sessions.findIndex((s: { date: string; count: number }) => s.date === session.date)

    if (existingSessionIndex >= 0) {
      pomodoroData.sessions[existingSessionIndex].count += session.count
    } else {
      pomodoroData.sessions.push(session)
    }

    pomodoroData.totalPomodoros += session.count

    await db.collection("users").updateOne({ id: userId }, { $set: { pomodoroData } })

    return NextResponse.json({ success: true, pomodoroData })
  } catch (error) {
    console.error("[MongoDB] Error saving pomodoro:", error)
    return NextResponse.json({ error: "Failed to save pomodoro" }, { status: 500 })
  }
}
