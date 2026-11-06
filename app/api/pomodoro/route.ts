import type { NextRequest } from "next/server"
import { z } from "zod"
import { fail, json, readJson, requireSession, dbErrorResponse } from "@/lib/server/api"
import { PomodoroError, getState, startRun, pauseRun, resumeRun, resetRun, completeRun, type ServiceResult } from "@/lib/server/pomodoro-service"

const Id = z.string().min(1).max(64)
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), mode: z.enum(["focus", "short_break", "long_break"]) }),
  z.object({ action: z.literal("pause"), id: Id }),
  z.object({ action: z.literal("resume"), id: Id }),
  z.object({ action: z.literal("reset"), id: Id }),
  z.object({ action: z.literal("complete"), id: Id }),
])

function reply(r: ServiceResult) {
  return json({ success: true, ...r })
}

function handleError(err: unknown) {
  if (err instanceof PomodoroError) {
    return json({ error: err.message, code: err.code, ...(err.extra ?? {}) }, err.status)
  }
  return dbErrorResponse(err, "Pomodoro")
}

// GET — joriy holat: sozlamalar, faol taymer (qolgan vaqt serverda hisoblanadi), statistika.
// Vaqti tugagan faol fokus taymer bo'lsa u shu yerda bir marta yakunlanadi (sahifa yopiq bo'lgan bo'lsa ham).
export async function GET(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  try {
    return reply(await getState(auth.session.id))
  } catch (err) { return handleError(err) }
}

// POST — { action: start | pause | resume | reset | complete }. Foydalanuvchi faqat o'z taymeri bilan ishlaydi (id sessiyadan olinadi).
// Muhim: davomiylik va statistikani MIJOZ belgilamaydi — server sozlamalardan va o'z soatidan foydalanadi.
export async function POST(request: NextRequest) {
  const auth = requireSession(request)
  if ("response" in auth) return auth.response
  const parsed = Body.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, "So'rov noto'g'ri", "VALIDATION")
  const uid = auth.session.id
  const b = parsed.data
  try {
    switch (b.action) {
      case "start": return reply(await startRun(uid, b.mode))
      case "pause": return reply(await pauseRun(uid, b.id))
      case "resume": return reply(await resumeRun(uid, b.id))
      case "reset": return reply(await resetRun(uid, b.id))
      case "complete": return reply(await completeRun(uid, b.id))
    }
  } catch (err) { return handleError(err) }
}
