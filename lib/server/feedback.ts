import { z } from "zod"

export const FEEDBACK_TYPES = ["feedback", "suggestion", "bug"] as const
export const FEEDBACK_STATUSES = ["open", "in_progress", "resolved", "closed"] as const

export const NewFeedback = z.object({
  type: z.enum(FEEDBACK_TYPES),
  subject: z.string().trim().min(3, "Mavzu kamida 3 ta belgi bo'lsin").max(120),
  message: z.string().trim().min(3, "Xabar kamida 3 ta belgi bo'lsin").max(4000),
}).strict()

export const ReplyBody = z.object({ body: z.string().trim().min(1, "Xabar bo'sh bo'lmasin").max(4000) }).strict()

export const AdminReply = z.object({
  body: z.string().trim().min(1, "Xabar bo'sh bo'lmasin").max(4000),
  status: z.enum(FEEDBACK_STATUSES).optional(),
}).strict()

export interface MessageRow { id: string; senderRole: string; senderId: bigint; body: string; createdAt: Date }
export const messageToClient = (m: MessageRow) => ({
  id: m.id, senderRole: m.senderRole === "admin" ? "admin" : "user", body: m.body, createdAt: m.createdAt.toISOString(),
})
