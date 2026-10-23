import { type NextRequest, NextResponse } from "next/server"
import { updateUserColumns } from "@/lib/server/user-store"
import { getSession } from "@/lib/auth"

const validAvatar = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 300_000 &&
  (/^https?:\/\//.test(v) || /^\/[^/]/.test(v) || /^data:image\/(png|jpeg|webp|gif);base64,/.test(v))

export async function POST(request: NextRequest) {
  try {
    const session = getSession(request)
    if (!session) return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 })

    const body = await request.json()
    const { avatarData } = body
    const userId = Number(body.userId)

    if (!userId || !avatarData) {
      return NextResponse.json({ error: "Missing userId or avatarData" }, { status: 400 })
    }
    if (!validAvatar(avatarData)) {
      return NextResponse.json({ error: "Avatar manzili noto'g'ri" }, { status: 400 })
    }
    if (!session.isAdmin && userId !== session.id) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 })
    }

    const found = await updateUserColumns(userId, { avatarUrl: avatarData })
    if (!found) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, avatarUrl: avatarData })
  } catch (error) {
    console.error("Error uploading avatar:", error)
    return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 })
  }
}
