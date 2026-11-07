import { z } from "zod"
import type { WeeklyTask } from "@/generated/prisma/client"
import { db, big } from "@/lib/prisma"
import { isValidDateKey } from "@/lib/dates"
import { userTimezone } from "@/lib/server/user-store"

export const CATEGORIES = ["study", "programming", "health", "personal", "work", "other"] as const
export const PRIORITIES = ["low", "medium", "high"] as const
export const REMINDER_OPTIONS = [0, 5, 10, 15, 30, 60] as const


export const dateKey = z.string().refine(isValidDateKey, "Sana noto'g'ri (YYYY-MM-DD)")
export const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqt noto'g'ri (HH:MM)")

export const CreateTask = z.object({
  title: z.string().trim().min(1, "Vazifa nomi kerak").max(120),
  description: z.string().trim().max(1000).default(""),
  date: dateKey,
  time: timeStr.nullable().default(null),
  durationMin: z.number().int().min(5).max(1440).nullable().default(null),
  category: z.enum(CATEGORIES).default("other"),
  priority: z.enum(PRIORITIES).default("medium"),
  reminderMin: z.number().int().refine((n) => (REMINDER_OPTIONS as readonly number[]).includes(n), "Eslatma qiymati noto'g'ri").nullable().default(null),
})

export const UpdateTask = CreateTask.partial().extend({ completed: z.boolean().optional() }).strict()

export const toClient = (t: WeeklyTask) => ({
  id: t.id, title: t.title, description: t.description, date: t.date, time: t.time,
  durationMin: t.durationMin, category: t.category, priority: t.priority, reminderMin: t.reminderMin,
  completed: t.completed, completedAt: t.completedAt ? t.completedAt.toISOString() : null,
  createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
})

/** Vazifa ID si: avval ObjectId (24 hex) edi, yangilari cuid. Ikkalasi ham shu shablonga mos. */
export const parseTaskId = (id: string): string | null => (/^[A-Za-z0-9_-]{8,40}$/.test(id) ? id : null)

export async function timezoneOf(userId: number): Promise<string> {
  if (userId <= 0) return userTimezone(null)
  const u = await db().user.findUnique({ where: { id: big(userId) }, select: { timezone: true } })
  return userTimezone(u)
}

export const LIMITS = { perUser: 3000, perDay: 100, maxRangeDays: 62, overdue: 100 }
