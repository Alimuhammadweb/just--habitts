import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
<<<<<<< HEAD
import { db } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server/admin"
import { createOfficialPost, deleteOfficialPost, postInclude, postToClient, updateOfficialPost } from "@/lib/server/community"

// Rasm/havola faqat http(s) yoki saytning o'z yo'li bo'lishi mumkin ("javascript:" kabi sxemalar rad etiladi).
const safeUrl = (max: number) => z.string().trim().max(max).refine((v) => v === "" || /^https?:\/\//i.test(v) || /^\/[^/]/.test(v), "URL noto'g'ri")

// GET — hamma kirgan foydalanuvchi NASHR ETILGAN postlarni ko'radi (qoralamalar faqat admin panelida).
export async function GET() {
  try {
    const posts = await db().communityPost.findMany({
      where: { isPublished: true },
=======
import { db, big, newNumericId } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { postInclude, postToClient } from "@/lib/server/community"

export async function GET() {
  try {
    const posts = await db().communityPost.findMany({
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d
      include: postInclude,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    })
    return NextResponse.json(posts.map(postToClient))
  } catch (error) {
    console.error("[Community] GET xato:", error)
    return NextResponse.json([], { status: 200 })
  }
}

const NewPost = z.object({
<<<<<<< HEAD
  title: z.string().trim().max(200).optional().default(""),
  content: z.string().trim().min(1).max(5000),
  imageUrl: safeUrl(2000).optional().default(""),
  linkUrl: safeUrl(2000).optional().default(""),
  isPinned: z.boolean().optional().default(true), // avvalgi xulq: admin posti mahkamlanadi
  isPublished: z.boolean().optional().default(true),
})

// POST — FAQAT administrator rasmiy post yaratadi. Oddiy foydalanuvchi: 403 (sessiya yo'q: 401).
// Mijoz yuborgan userId/userName/isAdmin e'tiborsiz qoldiriladi: muallif tasdiqlangan sessiyadan olinadi.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ("response" in auth) return auth.response
    const parsed = NewPost.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message === "URL noto'g'ri" ? "URL noto'g'ri" : "Kontent kerak" }, { status: 400 })
    return NextResponse.json(await createOfficialPost(auth.admin, parsed.data), { status: 201 })
=======
  title: z.string().max(200).optional().default(""),
  content: z.string().trim().min(1).max(5000),
  imageUrl: z.string().max(300_000).optional().default(""),
  linkUrl: z.string().max(2000).optional().default(""),
})

export async function POST(request: NextRequest) {
  try {
    const session = getSession(request)
    if (!session) return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 })

    const parsed = NewPost.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Kontent kerak" }, { status: 400 })
    const { title, content, imageUrl, linkUrl } = parsed.data
    // userId va isAdmin mijozdan emas, tasdiqlangan sessiyadan olinadi -
    // aks holda har kim o'zini admin qilib pinned e'lon yozishi mumkin edi
    const userId = session.id
    const isAdmin = session.isAdmin

    // Muallif ismi va avatari ham bazadan olinadi (mijoz yuborgan nomga ishonilmaydi)
    let userName = "Admin", userAvatar = ""
    if (userId > 0) {
      const u = await db().user.findUnique({ where: { id: big(userId) }, select: { name: true, avatarUrl: true } })
      if (!u) return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 })
      userName = u.name || "Foydalanuvchi"
      userAvatar = u.avatarUrl || ""
    }

    const now = new Date()
    const post = await db().$transaction(async (tx) => {
      // Admin pinned posts: unpin all previous
      if (isAdmin) await tx.communityPost.updateMany({ where: { isPinned: true }, data: { isPinned: false } })
      return tx.communityPost.create({
        data: {
          id: big(newNumericId()), userId: big(userId), userName, userAvatar, title, content, imageUrl, linkUrl,
          isPinned: isAdmin, isAdminPost: Boolean(isAdmin), createdAt: now, updatedAt: now,
        },
        include: postInclude,
      })
    })
    return NextResponse.json(postToClient(post), { status: 201 })
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d
  } catch (error) {
    console.error("[Community] POST xato:", error)
    return NextResponse.json({ error: "Post yaratilmadi" }, { status: 500 })
  }
}

<<<<<<< HEAD
// DELETE — FAQAT administrator (avval muallifning o'zi ham o'chira olardi; endi rasmiy kontentni faqat admin boshqaradi).
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ("response" in auth) return auth.response
    const postId = Number(new URL(request.url).searchParams.get("postId"))
    if (!postId || !Number.isSafeInteger(postId)) return NextResponse.json({ error: "postId kerak" }, { status: 400 })
    const ok = await deleteOfficialPost(auth.admin, postId)
    if (!ok) return NextResponse.json({ error: "Post topilmadi" }, { status: 404 })
=======
export async function DELETE(request: NextRequest) {
  try {
    const session = getSession(request)
    if (!session) return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const postId = Number(searchParams.get("postId"))

    if (!postId || !Number.isSafeInteger(postId)) {
      return NextResponse.json({ error: "postId kerak" }, { status: 400 })
    }

    const post = await db().communityPost.findUnique({ where: { id: big(postId) }, select: { userId: true } })
    if (!post) return NextResponse.json({ error: "Post topilmadi" }, { status: 404 })

    // Can delete: own post OR admin (session'dan tasdiqlangan)
    const canDelete = Number(post.userId) === session.id || session.isAdmin
    if (!canDelete) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 })
    }

    await db().communityPost.delete({ where: { id: big(postId) } }) // izoh va reaksiyalar CASCADE bilan o'chadi
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Community] DELETE xato:", error)
    return NextResponse.json({ error: "O'chirilmadi" }, { status: 500 })
  }
}

<<<<<<< HEAD
const PostUpdates = z.object({
  title: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1).max(5000).optional(),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  imageUrl: safeUrl(2000).optional(),
  linkUrl: safeUrl(2000).optional(),
}).strict()

// PATCH — FAQAT administrator.
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ("response" in auth) return auth.response
    const body = await request.json().catch(() => null)
    const postId = Number(body?.postId)
    const parsed = PostUpdates.safeParse(body?.updates)
    if (!postId || !Number.isSafeInteger(postId) || !parsed.success || !Object.keys(parsed.data).length) {
      return NextResponse.json({ error: "So'rov noto'g'ri" }, { status: 400 })
    }
    const updated = await updateOfficialPost(auth.admin, postId, parsed.data)
    if (!updated) return NextResponse.json({ error: "Post topilmadi" }, { status: 404 })
    return NextResponse.json(updated)
=======
// Admin faqat shu maydonlarni o'zgartira oladi (avval ixtiyoriy maydonlar yozilar edi)
const PostUpdates = z.object({
  title: z.string().max(200).optional(),
  content: z.string().trim().min(1).max(5000).optional(),
  isPinned: z.boolean().optional(),
  imageUrl: z.string().max(300_000).optional(),
  linkUrl: z.string().max(2000).optional(),
}).strict()

export async function PATCH(request: NextRequest) {
  try {
    const session = getSession(request)
    if (!session?.isAdmin) return NextResponse.json({ error: "Faqat admin uchun" }, { status: 403 })

    const body = await request.json().catch(() => null)
    const postId = Number(body?.postId)
    const parsed = PostUpdates.safeParse(body?.updates)
    if (!postId || !Number.isSafeInteger(postId) || !parsed.success) {
      return NextResponse.json({ error: "So'rov noto'g'ri" }, { status: 400 })
    }
    const updates = parsed.data

    const updated = await db().$transaction(async (tx) => {
      const exists = await tx.communityPost.findUnique({ where: { id: big(postId) }, select: { id: true } })
      if (!exists) return null
      if (updates.isPinned === true) await tx.communityPost.updateMany({ where: { isPinned: true }, data: { isPinned: false } })
      return tx.communityPost.update({
        where: { id: big(postId) },
        data: { ...updates, updatedAt: new Date() },
        include: postInclude,
      })
    })
    if (!updated) return NextResponse.json({ error: "Post topilmadi" }, { status: 404 })

    return NextResponse.json(postToClient(updated))
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d
  } catch (error) {
    console.error("[Community] PATCH xato:", error)
    return NextResponse.json({ error: "Yangilanmadi" }, { status: 500 })
  }
}
