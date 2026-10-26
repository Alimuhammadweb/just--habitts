import { type NextRequest, NextResponse } from "next/server"
import { findUserById, sanitizeUser, type UserDoc } from "@/lib/server/user-store"
import { db, big, prismaCode } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
<<<<<<< HEAD
import { audit, isVerifiedAdmin, requireAdmin } from "@/lib/server/admin"
=======
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d

// Boshqa foydalanuvchiga ko'rsatilishi mumkin bo'lgan xavfsiz maydonlar.
function toPublicUser(u: UserDoc) {
  const {
<<<<<<< HEAD
    password, salt, email, _rev, googleLinked, telegramLinked,
=======
    password, salt, email, _rev,
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d
    friendRequests, sentRequests, completedTasks, plannedHabits,
    ...safe
  } = u
  return safe
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = getSession(request)
    if (!session) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 })
    }

    const userId = Number.parseInt(id, 10)
    if (!Number.isSafeInteger(userId)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    const user = await findUserById(userId)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.isActive === false) {
      return NextResponse.json({ error: "Akkaunt bloklangan" }, { status: 403 })
    }

<<<<<<< HEAD
    const isOwnerOrAdmin = session.id === user.id || (session.isAdmin && (await isVerifiedAdmin(session)))
=======
    const isOwnerOrAdmin = session.isAdmin || session.id === user.id
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d

    // O'zining profilini yoki admin - to'liq ma'lumot.
    // Boshqa birovniki - faqat ochiq (xavfsiz) maydonlar.
    if (isOwnerOrAdmin) {
      return NextResponse.json(sanitizeUser(user), { headers: { "Cache-Control": "no-store" } })
    }

    return NextResponse.json(toPublicUser(user), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[DB] Error fetching user:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
<<<<<<< HEAD
    const auth = await requireAdmin(request) // adminlik bazadan tasdiqlanadi
    if ("response" in auth) return auth.response

    const { id } = await params
    const userId = Number.parseInt(id, 10)
    if (!Number.isSafeInteger(userId) || userId <= 0) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (userId === auth.admin.id) return NextResponse.json({ error: "O'zingizni o'chira olmaysiz" }, { status: 400 })
    const target = await db().user.findUnique({ where: { id: big(userId) }, select: { isAdmin: true, email: true } })
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (target.isAdmin) return NextResponse.json({ error: "Avval adminlikni olib tashlang" }, { status: 409 })

    // Bog'liq yozuvlar (odatlar, vazifalar, tokenlar, do'stlik) ON DELETE CASCADE orqali o'chadi.
    await db().user.deleteMany({ where: { id: big(userId) } })
    await audit(auth.admin, "user.delete", { type: "user", id: userId }, { email: target.email })
=======
    const session = getSession(request)
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Faqat admin uchun" }, { status: 403 })
    }

    const { id } = await params
    const userId = Number.parseInt(id, 10)
    if (Number.isSafeInteger(userId)) {
      // Bog'liq yozuvlar (odatlar, vazifalar, tokenlar, do'stlik) ON DELETE CASCADE orqali o'chadi.
      await db().user.deleteMany({ where: { id: big(userId) } })
    }

>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[DB] Error deleting user:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
