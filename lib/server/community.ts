import type { Prisma } from "@/generated/prisma/client"
<<<<<<< HEAD
import { db, big, newNumericId } from "@/lib/prisma"
import { audit, type AdminActor } from "@/lib/server/admin"
=======
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d

export const postInclude = {
  comments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  reactions: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.CommunityPostInclude

type PostRow = Prisma.CommunityPostGetPayload<{ include: typeof postInclude }>

/** DB qatori → avvalgi API javob shakli (mijoz kodi o'zgarmaydi). */
export function postToClient(p: PostRow) {
  return {
    id: Number(p.id), userId: Number(p.userId), userName: p.userName, userAvatar: p.userAvatar,
    title: p.title, content: p.content, isPinned: p.isPinned, isAdminPost: p.isAdminPost,
<<<<<<< HEAD
    isPublished: p.isPublished,
=======
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d
    imageUrl: p.imageUrl, linkUrl: p.linkUrl,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    comments: p.comments.map((c) => ({
      id: Number(c.id), postId: Number(c.postId), userId: Number(c.userId), userName: c.userName, userAvatar: c.userAvatar,
      content: c.content, createdAt: c.createdAt.toISOString(), isDeleted: c.isDeleted,
    })),
    reactions: p.reactions.map((r) => ({
      id: Number(r.id), postId: Number(r.postId), userId: Number(r.userId), type: r.type, createdAt: r.createdAt.toISOString(),
    })),
  }
}
<<<<<<< HEAD

// ── Faqat ADMIN chaqiradigan amallar. Chaqiruvchi route requireAdmin() bilan actor'ni tasdiqlagan bo'lishi shart. ──

export interface PostInput { title: string; content: string; imageUrl: string; linkUrl: string; isPinned: boolean; isPublished: boolean }

export async function createOfficialPost(actor: AdminActor, input: PostInput) {
  // Muallif ismi va avatari bazadan olinadi (mijoz yuborgan nomga ishonilmaydi)
  let userName = "Admin", userAvatar = ""
  if (actor.id > 0) {
    const u = await db().user.findUnique({ where: { id: big(actor.id) }, select: { name: true, avatarUrl: true } })
    userName = u?.name || "Admin"; userAvatar = u?.avatarUrl || ""
  }
  const now = new Date()
  const pin = input.isPinned && input.isPublished // qoralama mahkamlanmaydi
  const post = await db().$transaction(async (tx) => {
    if (pin) await tx.communityPost.updateMany({ where: { isPinned: true }, data: { isPinned: false } })
    return tx.communityPost.create({
      data: {
        id: big(newNumericId()), userId: big(actor.id), userName, userAvatar,
        title: input.title, content: input.content, imageUrl: input.imageUrl, linkUrl: input.linkUrl,
        isPinned: pin, isAdminPost: true, isPublished: input.isPublished, createdAt: now, updatedAt: now,
      },
      include: postInclude,
    })
  })
  await audit(actor, input.isPublished ? "community.post.publish" : "community.post.create_draft", { type: "post", id: String(post.id) }, { title: input.title.slice(0, 80) })
  return postToClient(post)
}

export type PostPatch = Partial<PostInput>

export async function updateOfficialPost(actor: AdminActor, postId: number, patch: PostPatch) {
  const updated = await db().$transaction(async (tx) => {
    const cur = await tx.communityPost.findUnique({ where: { id: big(postId) }, select: { id: true, isPublished: true } })
    if (!cur) return null
    const willPublish = patch.isPublished ?? cur.isPublished
    const data: Prisma.CommunityPostUpdateInput = { ...patch, updatedAt: new Date() }
    if (!willPublish) data.isPinned = false // qoralama/yashirin post mahkamlanmaydi
    if (data.isPinned === true) await tx.communityPost.updateMany({ where: { isPinned: true, NOT: { id: big(postId) } }, data: { isPinned: false } })
    return tx.communityPost.update({ where: { id: big(postId) }, data, include: postInclude })
  })
  if (!updated) return null
  const action = patch.isPublished === true ? "community.post.publish" : patch.isPublished === false ? "community.post.unpublish" : "community.post.update"
  await audit(actor, action, { type: "post", id: String(postId) }, { fields: Object.keys(patch) })
  return postToClient(updated)
}

export async function deleteOfficialPost(actor: AdminActor, postId: number) {
  const post = await db().communityPost.findUnique({ where: { id: big(postId) }, select: { id: true, title: true, userId: true } })
  if (!post) return false
  await db().communityPost.delete({ where: { id: big(postId) } }) // izoh va reaksiyalar CASCADE bilan o'chadi
  await audit(actor, "community.post.delete", { type: "post", id: String(postId) }, { title: post.title.slice(0, 80), authorId: Number(post.userId) })
  return true
}
=======
>>>>>>> 91abbcb2771aae368d94acad74dc30bbf329c25d
