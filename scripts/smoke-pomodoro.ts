/**
 * Pomodoro tizimini HAQIQIY server (next dev/start) va HAQIQIY PostgreSQL bilan tekshiradi.
 * Ishga tushirish: BASE_URL=http://localhost:3100 npx tsx scripts/smoke-pomodoro.ts   (BO'SH test bazasi bilan)
 * Server EXTRA_ALLOWED_ORIGIN=$BASE_URL bilan ishga tushirilgan bo'lishi kerak (dev'da localhost avtomatik ruxsat).
 *
 * Eslatma: fokus kamida 15 daqiqa, shuning uchun "vaqt o'tishi" bazadagi vaqt belgilarini (startedAt/resumedAt)
 * orqaga surish bilan taqlid qilinadi. Qolgan hammasi (HTTP, auth, tranzaksiyalar, statistika) haqiqiy.
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"

const BASE = process.env.BASE_URL || "http://localhost:3100"
let failed = 0
const ok = (c: unknown, m: string) => { if (c) console.log("ok  ", m); else { failed++; console.error("FAIL", m) } }
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

class Client {
  cookies = new Map<string, string>()
  async req(method: string, path: string, body?: unknown) {
    const res = await fetch(BASE + path, {
      method, redirect: "manual",
      headers: { "Content-Type": "application/json", Origin: BASE, Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const [pair] = sc.split(";"); const i = pair.indexOf("=")
      const k = pair.slice(0, i), v = pair.slice(i + 1)
      if (v) this.cookies.set(k, v); else this.cookies.delete(k)
    }
    const text = await res.text()
    let data: any = null; try { data = JSON.parse(text) } catch { data = text }
    return { status: res.status, data }
  }
  post = (b: unknown) => this.req("POST", "/api/pomodoro", b)
  state = () => this.req("GET", "/api/pomodoro")
  settings = (b: unknown) => this.req("PUT", "/api/pomodoro/settings", b)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pw = "Str0ng!Passw0rd"
const stamp = Date.now()

async function mkUser(label: string) {
  const email = `${label}${stamp}@test.uz`
  const anon = new Client()
  const r = await anon.req("POST", "/api/users", { name: label, email, password: pw })
  const c = new Client()
  await c.req("POST", "/api/auth/login", { email, password: pw })
  return { c, id: r.data.id as number, email }
}
const login = async (email: string) => { const c = new Client(); await c.req("POST", "/api/auth/login", { email, password: pw }); return c }

/** Faol taymerni "ms" millisekund oldin boshlangandek ko'rsatadi (vaqt o'tishini taqlid qiladi). */
async function ageRun(runId: string, ms: number) {
  await prisma.$executeRaw`UPDATE "PomodoroRun"
    SET "startedAt" = "startedAt" - (${ms} * interval '1 millisecond'),
        "resumedAt" = CASE WHEN "resumedAt" IS NULL THEN NULL ELSE "resumedAt" - (${ms} * interval '1 millisecond') END
    WHERE id = ${runId}`
}
const counts = async (uid: number) => {
  const u = BigInt(uid)
  const runs = await prisma.pomodoroRun.findMany({ where: { userId: u } })
  const daily = await prisma.pomodoroSession.aggregate({ _sum: { count: true }, where: { userId: u } })
  const user = await prisma.user.findUnique({ where: { id: u }, select: { pomodoroTotal: true } })
  return {
    runs, creditedFocus: runs.filter((r) => r.mode === "focus" && r.status === "completed" && r.credited).length,
    completedBreaks: runs.filter((r) => r.mode !== "focus" && r.status === "completed").length,
    active: runs.filter((r) => ["running", "paused"].includes(r.status)).length,
    dailySum: daily._sum.count ?? 0, total: user?.pomodoroTotal ?? 0,
  }
}
const tashkentToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

async function main() {
  const anon = new Client()
  ok((await anon.state()).status === 401, "autentifikatsiyasiz GET /api/pomodoro → 401")
  ok((await anon.post({ action: "start", mode: "focus" })).status === 401, "autentifikatsiyasiz POST → 401")
  ok((await anon.settings({ focusMin: 30 })).status === 401, "autentifikatsiyasiz PUT settings → 401")

  const A = await mkUser("pa"), B = await mkUser("pb")

  // ── 1. Standart holat ──
  const s0 = (await A.c.state()).data.state
  ok(s0.settings.focusMin === 25 && s0.settings.shortBreakMin === 5 && s0.settings.longBreakMin === 15, "standart sozlamalar 25/5/15")
  ok(s0.active === null && s0.stats.totalSessions === 0 && s0.stats.todaySessions === 0 && s0.stats.totalFocusSeconds === 0, "boshlang'ich statistika nol")

  // ── 2. Sozlamalar: tekshiruv va saqlanish ──
  for (const bad of [14, 0, 1, -5, 14.5, "25", null, 181]) {
    const r = await A.c.settings({ focusMin: bad })
    ok(r.status === 400, `focusMin=${JSON.stringify(bad)} rad etildi (400)`)
  }
  ok((await A.c.settings({})).status === 400, "bo'sh yangilash rad etildi")
  ok((await A.c.settings({ userId: 999, focusMin: 30 })).status === 400, "begona maydon (userId) rad etildi")
  ok((await A.c.settings({ shortBreakMin: 0 })).status === 400 && (await A.c.settings({ longBreakMin: 61 })).status === 400, "tanaffus chegaralari tekshirildi")
  ok((await A.c.state()).data.state.settings.focusMin === 25, "rad etilgan qiymatlar bazaga yozilmadi")
  const put = await A.c.settings({ focusMin: 45 })
  ok(put.status === 200 && put.data.settings.focusMin === 45, "fokus 45 daqiqa saqlandi (preset)")
  ok((await A.c.settings({ focusMin: 15 })).status === 200, "minimal 15 daqiqa qabul qilindi")
  ok((await A.c.settings({ focusMin: 37, shortBreakMin: 7, longBreakMin: 20 })).data.settings.focusMin === 37, "maxsus davomiylik 37 + tanaffuslar saqlandi")
  const row = await prisma.pomodoroSettings.findUnique({ where: { userId: BigInt(A.id) } })
  ok(row?.focusMin === 37 && row?.shortBreakMin === 7 && row?.longBreakMin === 20, "sozlamalar PostgreSQL'da")
  ok((await B.c.state()).data.state.settings.focusMin === 25, "B ning sozlamalari A ga bog'liq emas")

  // ── 3. Boshlash: davomiylik serverdagi sozlamadan; ikkinchi start rad etiladi ──
  const st = await A.c.post({ action: "start", mode: "focus", durationMinutes: 1 }) // mijoz davomiylikni belgilay olmaydi (rad: noma'lum maydon e'tiborsiz)
  ok(st.status === 200 && st.data.state.active?.plannedSeconds === 37 * 60 && st.data.state.active.status === "running", "start: davomiylik serverdagi sozlamadan (37 daq), mijoz qiymati e'tiborsiz")
  const runId = st.data.state.active.id as string
  ok((await A.c.post({ action: "start", mode: "short_break" })).status === 409, "faol taymer bor paytda ikkinchi start → 409")
  ok((await A.c.post({ action: "start", mode: "bogus" })).status === 400, "noto'g'ri rejim → 400")
  const dbRun = await prisma.pomodoroRun.findUnique({ where: { id: runId } })
  ok(dbRun?.status === "running" && dbRun.plannedSeconds === 2220 && dbRun.userId === BigInt(A.id), "taymer PostgreSQL'da: status, davomiylik, egasi")

  // ── 4. Sahifa yangilanganda taymer tiklanadi; qolgan vaqt timestamp bilan ──
  await ageRun(runId, 5 * 60_000)
  const g1 = (await A.c.state()).data.state.active
  ok(g1.status === "running" && Math.abs(g1.remainingMs - 32 * 60_000) < 5_000, `refresh: faol taymer saqlandi, qolgan ≈32:00 (${Math.round(g1.remainingMs / 1000)}s)`)
  const gOther = await login(A.email)
  const g2 = (await gOther.state()).data.state.active
  ok(g2?.id === runId && Math.abs(g2.remainingMs - g1.remainingMs) < 5_000, "boshqa qurilma/sessiyadan ham xuddi shu taymer")

  // ── 5. Pauza / davom ettirish ──
  const p = await A.c.post({ action: "pause", id: runId })
  ok(p.data.state.active.status === "paused", "pauza")
  const frozen = p.data.state.active.remainingMs
  await sleep(1500)
  await ageRun(runId, 60 * 60_000) // soatlab pauzada tursa ham vaqt o'tmaydi
  const g3 = (await A.c.state()).data.state
  ok(g3.active.status === "paused" && Math.abs(g3.active.remainingMs - frozen) < 50, "pauzada qolgan vaqt o'zgarmaydi (1 soat o'tgandan keyin ham)")
  ok(g3.stats.totalSessions === 0, "pauzadagi seans yakunlangan deb hisoblanmadi")
  ok((await A.c.post({ action: "pause", id: runId })).status === 200, "takroriy pauza idempotent")
  const r = await A.c.post({ action: "resume", id: runId })
  ok(r.data.state.active.status === "running" && Math.abs(r.data.state.active.remainingMs - frozen) < 2_000, "davom ettirildi, qolgan joyidan")

  // ── 6. Muddatidan oldin yakunlab bo'lmaydi ──
  const early = await A.c.post({ action: "complete", id: runId })
  ok(early.status === 409 && early.data.code === "NOT_DUE", "muddatidan oldin complete → 409 NOT_DUE")
  ok((await counts(A.id)).total === 0, "erta complete statistikani oshirmadi")

  // ── 7. Yakunlash: parallel complete + GET'lar — aynan bir marta ──
  await ageRun(runId, 40 * 60_000)
  const burst = await Promise.all([
    ...Array.from({ length: 8 }, () => A.c.post({ action: "complete", id: runId })),
    ...Array.from({ length: 4 }, () => A.c.state()),
    ...Array.from({ length: 3 }, () => gOther.post({ action: "complete", id: runId })),
  ])
  ok(burst.every((x) => x.status === 200), `parallel yakunlash so'rovlari xatosiz (${burst.map((x) => x.status).join(",")})`)
  const c1 = await counts(A.id)
  ok(c1.creditedFocus === 1 && c1.total === 1 && c1.dailySum === 1, `15 ta parallel so'rovdan keyin AYNAN 1 seans (runs=${c1.creditedFocus}, total=${c1.total}, kunlik=${c1.dailySum})`)
  ok(burst.filter((x) => x.data.completed?.credited === true).length <= 1, "faqat bitta so'rov 'credited' javobini oldi")
  await A.c.post({ action: "complete", id: runId }); await A.c.state()
  ok((await counts(A.id)).total === 1, "keyingi complete/GET'lar ikkinchi marta hisoblamaydi")
  const sd = (await A.c.state()).data.state
  ok(sd.active === null && sd.stats.totalSessions === 1 && sd.stats.todaySessions === 1, "statistika: jami 1, bugun 1")
  ok(sd.stats.totalFocusSeconds === 37 * 60 && sd.stats.todayFocusSeconds === 37 * 60, "jami fokus vaqti = 37 daqiqa")
  const done = await prisma.pomodoroRun.findUnique({ where: { id: runId } })
  ok(done?.status === "completed" && done.credited && done.endedAt, "run: completed + credited + endedAt")
  const me = await A.c.req("GET", `/api/users/${A.id}`)
  ok(me.data.pomodoroData.totalPomodoros === 1 && me.data.pomodoroData.sessions[0]?.count === 1, "profil API: pomodoroData ham yangilandi (chelenj/vazifalar shu manbadan oladi)")

  // ── 8. Bekor qilingan va tugamagan seanslar hisoblanmaydi ──
  const st2 = await A.c.post({ action: "start", mode: "focus" })
  const run2 = st2.data.state.active.id
  await ageRun(run2, 20 * 60_000)
  const rs = await A.c.post({ action: "reset", id: run2 })
  ok(rs.data.state.active === null, "reset: taymer bekor qilindi")
  ok((await A.c.post({ action: "complete", id: run2 })).status === 409, "bekor qilingan taymerni yakunlab bo'lmaydi")
  const c2 = await counts(A.id)
  ok(c2.total === 1 && c2.creditedFocus === 1 && c2.runs.find((x) => x.id === run2)?.status === "cancelled", "bekor qilingan seans hisoblanmadi (status=cancelled)")

  // ── 9. Tanaffuslar: to'g'ri davomiylik, statistikaga kirmaydi ──
  const sb = await A.c.post({ action: "start", mode: "short_break" })
  ok(sb.data.state.active.plannedSeconds === 7 * 60, "qisqa tanaffus = 7 daqiqa (saqlangan sozlama)")
  await ageRun(sb.data.state.active.id, 8 * 60_000)
  ok((await A.c.post({ action: "complete", id: sb.data.state.active.id })).status === 200, "qisqa tanaffus yakunlandi")
  const lb = await A.c.post({ action: "start", mode: "long_break" })
  ok(lb.data.state.active.plannedSeconds === 20 * 60, "uzoq tanaffus = 20 daqiqa (saqlangan sozlama)")
  await ageRun(lb.data.state.active.id, 21 * 60_000)
  const lbGet = await A.c.state() // sahifa yopiq bo'lsa ham GET yakunlaydi
  ok(lbGet.data.state.active === null, "vaqti o'tgan tanaffus GET'da yakunlandi")
  const c3 = await counts(A.id)
  ok(c3.total === 1 && c3.completedBreaks === 2 && c3.creditedFocus === 1, "tanaffuslar statistikani oshirmadi")

  // ── 10. Foydalanuvchi sahifada bo'lmaganda tugagan fokus: GET bir marta hisoblaydi ──
  await A.c.settings({ focusMin: 15 })
  const st3 = await A.c.post({ action: "start", mode: "focus" })
  ok(st3.data.state.active.plannedSeconds === 900, "fokus 15 daqiqa (minimal) ishga tushdi")
  const run3 = st3.data.state.active.id
  await ageRun(run3, 16 * 60_000)
  const away = await Promise.all([A.c.state(), A.c.state(), gOther.state()])
  ok(away.every((x) => x.status === 200), "parallel GET'lar xatosiz")
  const c4 = await counts(A.id)
  ok(c4.total === 2 && c4.creditedFocus === 2 && c4.dailySum === 2, `tab yopiq bo'lganda tugagan seans aynan bir marta hisoblandi (total=${c4.total}, runs=${c4.creditedFocus})`)
  const endedAt = (await prisma.pomodoroRun.findUnique({ where: { id: run3 } }))!.endedAt!.getTime()
  ok(endedAt < Date.now() - 30_000 && endedAt > Date.now() - 3 * 60_000, "tugash vaqti — tabiiy tugash payti (≈1 daqiqa oldin), hozirgi so'rov vaqti emas")

  // ── 10b. Kun chegarasi: kecha tugagan seans KECHAGI kunga yoziladi, bugungi hisobga qo'shilmaydi ──
  const st3b = await A.c.post({ action: "start", mode: "focus" })
  const run3b = st3b.data.state.active.id
  await ageRun(run3b, 30 * 3600_000)
  const beforeToday = (await A.c.state()).data.state.stats
  const endB = (await prisma.pomodoroRun.findUnique({ where: { id: run3b } }))!.endedAt!
  const endKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(endB)
  const dayRow = await prisma.pomodoroSession.findFirst({ where: { userId: BigInt(A.id), date: endKey } })
  ok(endKey !== tashkentToday() && !!dayRow, `30 soat oldin tugagan seans ${endKey} kuniga yozildi`)
  ok(beforeToday.todaySessions === 2 && beforeToday.totalSessions === 3, "kechagi seans bugungi sanoqqa qo'shilmadi, jami esa oshdi (3)")

  // ── 11. Parallel start: bitta faol taymer ──
  const par = await Promise.all(Array.from({ length: 8 }, () => A.c.post({ action: "start", mode: "focus" })))
  ok(par.filter((x) => x.status === 200).length === 1 && par.filter((x) => x.status === 409).length === 7, `8 ta parallel start → 1 ta muvaffaqiyat, 7 ta 409 (${par.map((x) => x.status).join(",")})`)
  ok((await counts(A.id)).active === 1, "bazada aynan bitta faol taymer")
  await A.c.post({ action: "reset", id: par.find((x) => x.status === 200)!.data.state.active.id })

  // ── 12. Chiqish → qayta kirish: statistika va sozlamalar saqlanadi ──
  await A.c.req("POST", "/api/auth/logout")
  ok((await A.c.state()).status === 401, "logoutdan keyin 401")
  const A2 = await login(A.email)
  const s2 = (await A2.state()).data.state
  ok(s2.stats.totalSessions === 3 && s2.stats.todaySessions === 2 && s2.stats.totalFocusSeconds === (37 + 15 + 15) * 60 && s2.stats.todayFocusSeconds === (37 + 15) * 60, "logout/login: jami=3, bugun=2, fokus vaqti jami=67 daq, bugun=52 daq")
  ok(s2.settings.focusMin === 15 && s2.settings.shortBreakMin === 7 && s2.settings.longBreakMin === 20, "logout/login: sozlamalar tiklandi")

  // ── 13. Izolyatsiya: B A ning ma'lumotiga tegolmaydi ──
  for (const a of ["pause", "resume", "reset", "complete"]) {
    ok((await B.c.post({ action: a, id: runId })).status === 404, `B A ning taymerini '${a}' qila olmaydi (404)`)
  }
  const sB = (await B.c.state()).data.state
  ok(sB.stats.totalSessions === 0 && sB.active === null, "B ning statistikasi A dan mustaqil")
  ok((await prisma.pomodoroRun.findUnique({ where: { id: runId } }))?.status === "completed", "A ning run'i B urinishlaridan o'zgarmadi")

  // ── 14. Eski ma'lumotlar saqlanadi (o'chirilmaydi, ustiga yozilmaydi) ──
  const C = await mkUser("pc")
  const today = tashkentToday()
  await prisma.pomodoroSession.createMany({ data: [
    { userId: BigInt(C.id), sessionId: BigInt(1), date: "2026-01-05", count: 3 },
    { userId: BigInt(C.id), sessionId: BigInt(2), date: today, count: 2 },
  ] })
  await prisma.user.update({ where: { id: BigInt(C.id) }, data: { pomodoroTotal: 5 } })
  const sC0 = (await C.c.state()).data.state
  ok(sC0.stats.totalSessions === 5 && sC0.stats.todaySessions === 2, "eski yozuvlar ko'rinadi (jami 5, bugun 2)")
  const stC = await C.c.post({ action: "start", mode: "focus" })
  await ageRun(stC.data.state.active.id, 26 * 60_000)
  await C.c.post({ action: "complete", id: stC.data.state.active.id })
  const sC1 = (await C.c.state()).data.state
  ok(sC1.stats.totalSessions === 6 && sC1.stats.todaySessions === 3, "yangi seans eskisiga qo'shildi (jami 6, bugun 3)")
  const legacy = await prisma.pomodoroSession.findMany({ where: { userId: BigInt(C.id) }, orderBy: { date: "asc" } })
  ok(legacy.length === 2 && legacy[0].count === 3 && legacy[1].count === 3, "eski kunlik yozuvlar saqlandi")

  // ── 15. Eski ochiq endpoint (mijoz 'count' yuboradi) endi yo'q ──
  ok((await A2.post({ session: { count: 4 } })).status === 400, "eski POST {session:{count}} rad etildi (soxta seans qo'shib bo'lmaydi)")
  ok((await A2.state()).data.state.stats.totalSessions === 3, "soxta urinishdan keyin statistika o'zgarmadi")

  console.log(failed ? `\n${failed} ta tekshiruv MUVAFFAQIYATSIZ` : "\nBarcha tekshiruvlar o'tdi")
  await prisma.$disconnect()
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
