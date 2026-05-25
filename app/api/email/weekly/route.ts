import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongodb"
import { buildWeeklyEmailHtml } from "@/lib/email-template"
import type { User } from "@/types/user"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET || "just-habits-cron"
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY sozlanmagan" }, { status: 500 })
    }

    const db = await getDb()
    const users = await db.collection<User>("users").find({
      isActive: true,
      email: { $exists: true, $ne: "" },
      isAdmin: { $ne: true },
    }).toArray()

    let sent = 0
    let failed = 0

    for (const user of users) {
      if (!user.habits || user.habits.length === 0) continue

      try {
        const html = buildWeeklyEmailHtml(user)
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Just Habits <noreply@resend.dev>",
            to: [user.email],
            subject: `${user.name}, haftalik hisobotingiz 📊`,
            html,
          }),
        })
        if (res.ok) sent++
        else { failed++; console.error(`Failed: ${user.email}`, await res.text()) }
      } catch (e) {
        failed++
        console.error(`Error: ${user.email}`, e)
      }
    }

    return NextResponse.json({ success: true, sent, failed, total: users.length })
  } catch (error) {
    console.error("[Email] Error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get("secret") !== (process.env.CRON_SECRET || "just-habits-cron")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return POST(request)
}
