import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
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
  } catch (error) {
    console.error("[Community] POST xato:", error)
    return NextResponse.json({ error: "Post yaratilmadi" }, { status: 500 })
  }
}

// DELETE — FAQAT administrator (avval muallifning o'zi ham o'chira olardi; endi rasmiy kontentni faqat admin boshqaradi).
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ("response" in auth) return auth.response
    const postId = Number(new URL(request.url).searchParams.get("postId"))
    if (!postId || !Number.isSafeInteger(postId)) return NextResponse.json({ error: "postId kerak" }, { status: 400 })
    const ok = await deleteOfficialPost(auth.admin, postId)
    if (!ok) return NextResponse.json({ error: "Post topilmadi" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Community] DELETE xato:", error)
    return NextResponse.json({ error: "O'chirilmadi" }, { status: 500 })
  }
}

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
  } catch (error) {
    console.error("[Community] PATCH xato:", error)
    return NextResponse.json({ error: "Yangilanmadi" }, { status: 500 })
  }
}
