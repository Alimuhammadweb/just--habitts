import type { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server/admin"
import { dbErrorResponse, fail, json, readJson } from "@/lib/server/api"
import { createOfficialPost } from "@/lib/server/community"

const safeUrl = z.string().trim().max(2000).refine((v) => v === "" || /^https?:\/\//i.test(v) || /^\/[^/]/.test(v), "URL noto'g'ri")

// GET — BARCHA postlar (qoralamalar ham) + hisoblagichlar.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  try {
    const rows = await db().communityPost.findMany({
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }], take: 200,
      include: { _count: { select: { comments: true, reactions: true } } },
    })
    return json({
      posts: rows.map((p) => ({
        id: Number(p.id), title: p.title, content: p.content, imageUrl: p.imageUrl, linkUrl: p.linkUrl,
        isPinned: p.isPinned, isPublished: p.isPublished, isAdminPost: p.isAdminPost, authorName: p.userName,
        createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
        comments: p._count.comments, reactions: p._count.reactions,
      })),
    })
  } catch (err) {
    return dbErrorResponse(err, "Admin.community")
  }
}

const NewPost = z.object({
  title: z.string().trim().max(200).default(""),
  content: z.string().trim().min(1, "Matn yozing").max(5000),
  imageUrl: safeUrl.default(""), linkUrl: safeUrl.default(""),
  isPinned: z.boolean().default(false), isPublished: z.boolean().default(true),
}).strict()

// POST — rasmiy post yaratish (nashr qilish yoki qoralama sifatida saqlash).
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const parsed = NewPost.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  try {
    return json(await createOfficialPost(auth.admin, parsed.data), 201)
  } catch (err) {
    return dbErrorResponse(err, "Admin.community.create")
  }
}
