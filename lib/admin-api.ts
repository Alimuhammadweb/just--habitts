"use client"
import { authFetch } from "@/lib/api-client"

export class AdminApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

/** Admin/feedback API chaqiruvlari uchun umumiy yordamchi (JSON, token yangilash, aniq xatolar). */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  let res: Response
  try {
    res = await authFetch(path, {
      ...rest, cache: "no-store",
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers || {}) },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    })
  } catch {
    throw new AdminApiError("Tarmoq xatosi. Internetni tekshiring.", 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new AdminApiError(data?.error || `Xato (${res.status})`, res.status)
  return data as T
}

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—")
export const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—")

export const FEEDBACK_TYPE_LABEL: Record<string, string> = { feedback: "Fikr", suggestion: "Taklif", bug: "Xatolik" }
export const FEEDBACK_STATUS_LABEL: Record<string, string> = { open: "Ochiq", in_progress: "Jarayonda", resolved: "Hal qilindi", closed: "Yopildi" }
export const AUDIT_LABEL: Record<string, string> = {
  "user.activate": "Hisob faollashtirildi", "user.deactivate": "Hisob bloklandi", "user.promote_admin": "Admin qilindi", "user.demote_admin": "Adminlik olib tashlandi",
  "user.delete": "Hisob o'chirildi", "community.post.publish": "Post nashr etildi", "community.post.unpublish": "Post yashirildi",
  "community.post.create_draft": "Qoralama yaratildi", "community.post.update": "Post tahrirlandi", "community.post.delete": "Post o'chirildi",
  "feedback.reply": "Murojaatga javob", "feedback.status": "Murojaat holati o'zgardi",
}
