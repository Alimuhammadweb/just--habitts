import type { NextRequest } from "next/server"
import { fail, json, readJson, requireSession, dbErrorResponse } from "@/lib/server/api"
import { SettingsPatch } from "@/lib/pomodoro"
import { getSettings, saveSettings } from "@/lib/server/pomodoro-service"
import { db, big } from "@/lib/prisma"

async function exists(id: number) {
  return (await db().user.findUnique({ where: { id: big(id) }, select: { id: true } })) !== null
}

export async function GET(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  try {
    if (!(await exists(auth.session.id))) return fail(404, "Foydalanuvchi topilmadi", "NOT_FOUND")
    return json({ settings: await getSettings(auth.session.id) })
  } catch (err) { return dbErrorResponse(err, "PomodoroSettings") }
}

// PUT — qisman yangilash. Tekshiruv serverda: fokus kamida 15 daqiqa (past qiymatlar 400 bilan rad etiladi).
// Faol taymerning davomiyligi o'zgarmaydi — yangi sozlama keyingi ishga tushirishdan boshlab amal qiladi.
export async function PUT(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const parsed = SettingsPatch.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message || "So'rov noto'g'ri", "VALIDATION")
  try {
    if (!(await exists(auth.session.id))) return fail(404, "Foydalanuvchi topilmadi", "NOT_FOUND")
    return json({ success: true, settings: await saveSettings(auth.session.id, parsed.data) })
  } catch (err) { return dbErrorResponse(err, "PomodoroSettings") }
}
