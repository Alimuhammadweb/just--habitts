import type { NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/server/admin"
import { dbErrorResponse, fail, json, readJson } from "@/lib/server/api"
import { deleteOfficialPost, updateOfficialPost } from "@/lib/server/community"

type Ctx = { params: Promise<{ id: string }> }
const parseId = (raw: string) => { const n = Number(raw); return Number.isSafeInteger(n) && n > 0 ? n : null }
const safeUrl = z.string().trim().max(2000).refine((v) => v === "" || /^https?:\/\//i.test(v) || /^\/[^/]/.test(v), "URL noto'g'ri")

const Patch = z.object({
  title: z.string().trim().max(200).optional(), content: z.string().trim().min(1, "Matn yozing").max(5000).optional(),
  imageUrl: safeUrl.optional(), linkUrl: safeUrl.optional(), isPinned: z.boolean().optional(), isPublished: z.boolean().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "O'zgartirish uchun maydon yo'q")

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const id = parseId((await params).id)
  const parsed = Patch.safeParse(await readJson(request))
  if (!id || !parsed.success) return fail(400, parsed.success ? "So'rov noto'g'ri" : parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  try {
    const updated = await updateOfficialPost(auth.admin, id, parsed.data)
    return updated ? json(updated) : fail(404, "Post topilmadi")
  } catch (err) {
    return dbErrorResponse(err, "Admin.community.update")
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin(request)
  if ("response" in auth) return auth.response
  const id = parseId((await params).id)
  if (!id) return fail(400, "So'rov noto'g'ri")
  try {
    return (await deleteOfficialPost(auth.admin, id)) ? json({ success: true }) : fail(404, "Post topilmadi")
  } catch (err) {
    return dbErrorResponse(err, "Admin.community.delete")
  }
}
