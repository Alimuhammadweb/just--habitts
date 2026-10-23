import type { Prisma } from "@/generated/prisma/client"

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
