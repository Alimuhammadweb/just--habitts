/**
 * Telegram Mini App autentifikatsiyasi — haqiqiy HTTP + haqiqiy baza bilan to'liq tekshiruv.
 * Telegram'ga ulanilmaydi: initData'ni test bot tokeni bilan o'zimiz imzolaymiz (Telegram aynan shunday imzolaydi).
 *   BASE_URL=http://localhost:3000 npx tsx scripts/smoke-telegram.ts
 * Server TELEGRAM_BOT_TOKEN va TELEGRAM_BOT_USERNAME bilan, EXTRA_ALLOWED_ORIGIN=$BASE_URL bilan ishlab turishi kerak.
 * Ixtiyoriy: LEGACY_USER_ID=<id> — mavjud (eski) foydalanuvchi ma'lumotlari o'zgarmaganini tekshiradi. Faqat TEST bazasida!
 */
import "dotenv/config"
import { createHmac } from "node:crypto"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const TOKEN = process.env.TELEGRAM_BOT_TOKEN!
let failed = 0
const ok = (c: unknown, m: string) => { if (c) console.log("ok  ", m); else { failed++; console.error("FAIL", m) } }

class Client {
  cookies = new Map<string, string>()
  async req(method: string, path: string, body?: unknown) {
    const res = await fetch(BASE + path, { method, redirect: "manual", headers: { "Content-Type": "application/json", Origin: BASE, Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const sc of res.headers.getSetCookie?.() ?? []) { const [p] = sc.split(";"); const i = p.indexOf("="); const k = p.slice(0, i), v = p.slice(i + 1); if (v) this.cookies.set(k, v); else this.cookies.delete(k) }
    const t = await res.text(); let data: any = t; try { data = JSON.parse(t) } catch { /* matn */ }
    return { status: res.status, data, setCookie: res.headers.getSetCookie?.() ?? [] }
  }
}

// ── initData'ni Telegram spetsifikatsiyasi bo'yicha imzolash ──
let seq = 0
function signInit(fields: Record<string, string>, token = TOKEN) {
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n")
  const hash = createHmac("sha256", createHmac("sha256", "WebAppData").update(token).digest()).update(check).digest("hex")
  return new URLSearchParams({ ...fields, hash }).toString()
}
const nowSec = () => Math.floor(Date.now() / 1000)
function initData(user: Record<string, unknown>, o: { authDate?: number; startParam?: string; token?: string } = {}) {
  const f: Record<string, string> = { query_id: `AAH${++seq}${Date.now()}`, user: JSON.stringify(user), auth_date: String(o.authDate ?? nowSec()), signature: "telegram-third-party-signature" }
  if (o.startParam) f.start_param = o.startParam
  return signInit(f, o.token ?? TOKEN)
}
const tgUser = (id: number, over: Record<string, unknown> = {}) => ({ id, first_name: "Ali", last_name: "Valiyev", username: `ali_${id}`, language_code: "uz", photo_url: "https://t.me/i/userpic/320/x.jpg", allows_write_to_pm: true, ...over })
const login = (c: Client, init: string, confirmLink = false) => c.req("POST", "/api/auth/telegram", { initData: init, ...(confirmLink ? { confirmLink: true } : {}) })
const startapp = (url: string) => new URL(url).searchParams.get("startapp")!
const newHabit = (name: string) => ({ habit: { name, duration: 21, time: null, notifications: false, startDate: { timestamp: Date.now() } } })

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 3 }) })
  const stamp = Date.now(), base = Number(String(stamp).slice(-9)) * 10
  const ids = Array.from({ length: 12 }, (_, i) => base + i)
  const anon = new Client()
  const pw = "Str0ng!Passw0rd"
  const mkPasswordUser = async (tag: string) => {
    const email = `${tag}${stamp}@test.uz`
    const reg = await anon.req("POST", "/api/users", { name: `User ${tag}`, email, password: pw })
    const c = new Client(); await c.req("POST", "/api/auth/login", { email, password: pw })
    return { c, id: reg.data.id as number, email }
  }

  const cfg = await anon.req("GET", "/api/auth/config")
  ok(cfg.data.telegram === process.env.TELEGRAM_BOT_USERNAME!.replace(/^@/, "") && !JSON.stringify(cfg.data).includes(TOKEN), "config: bot username ochiq, bot tokeni yo'q")

  // ── 1) Yangi Telegram foydalanuvchisi avtomatik ro'yxatdan o'tadi ──
  const T = new Client()
  const r1 = await login(T, initData(tgUser(ids[0])))
  ok(r1.status === 201 && r1.data.isAdmin === false && T.cookies.has("access_token") && T.cookies.has("refresh_token"), "1. yangi foydalanuvchi avtomatik yaratildi (201), admin EMAS, sessiya cookie'lari berildi")
  ok(r1.setCookie.every((c) => /httponly/i.test(c) && /samesite=lax/i.test(c)), "1. cookie'lar HttpOnly + SameSite=Lax")
  const row = await prisma.user.findUnique({ where: { telegramId: BigInt(ids[0]) } })
  ok(!!row && row.name === "Ali Valiyev" && row.firstName === "Ali" && row.lastName === "Valiyev" && row.telegramUsername === `ali_${ids[0]}` && row.telegramLanguageCode === "uz" && row.telegramPhotoUrl === "https://t.me/i/userpic/320/x.jpg" && row.avatarUrl === "https://t.me/i/userpic/320/x.jpg", "1. bazada Telegram ID va profil ma'lumotlari saqlandi")
  ok(!!row && row.email === `tg_${ids[0]}@telegram.invalid` && row.isActive && !row.isAdmin && row.googleSub === null && row.lastLoginAt !== null, "1. ichki email, oddiy foydalanuvchi, lastLoginAt yozilgan")
  ok(!JSON.stringify(r1.data).includes('"password":"'), "1. javobda parol xeshi yo'q")

  // ── 2) Dashboard uchun ma'lumot: sessiya foydalanuvchini taniydi ──
  const me = await T.req("GET", "/api/auth/me")
  ok(me.status === 200 && me.data.id === r1.data.id && me.data.telegramLinked === true, "2. /api/auth/me sessiya egasini qaytaradi (dashboard shu bilan ochiladi)")
  ok((await T.req("GET", `/api/users/${r1.data.id}`)).status === 200, "2. foydalanuvchi o'z ma'lumotini oladi")

  // ── 3) Yopib qayta ochish: o'sha hisob, dublikat yo'q, profil yangilanadi, ilova ismi o'zgarmaydi ──
  const T2 = new Client()
  const r3 = await login(T2, initData(tgUser(ids[0], { first_name: "Alisher", username: "ali_new" })))
  ok(r3.status === 200 && r3.data.id === r1.data.id && (await prisma.user.count({ where: { telegramId: BigInt(ids[0]) } })) === 1, "3. qayta ochish: o'sha hisob taniladi (200), dublikat yo'q")
  const row3 = await prisma.user.findUnique({ where: { telegramId: BigInt(ids[0]) } })
  ok(row3?.telegramFirstName === "Alisher" && row3?.telegramUsername === "ali_new" && row3?.name === "Ali Valiyev", "3. Telegram profili yangilandi, lekin foydalanuvchining ilovadagi ismi o'zgarmadi")

  // ── 4) Sahifa yangilanganda sessiya saqlanadi ──
  ok((await T.req("GET", "/api/auth/me")).status === 200 && (await T.req("POST", "/api/auth/refresh")).status === 200 && (await T.req("GET", "/api/auth/me")).status === 200, "4. sahifani yangilash/refresh'dan keyin sessiya yaroqli")

  // ── 5) username/familiya/rasm yo'q foydalanuvchi ──
  const bare = new Client()
  const rb = await login(bare, initData({ id: ids[1], first_name: "Vali" }))
  const rowb = await prisma.user.findUnique({ where: { telegramId: BigInt(ids[1]) } })
  ok(rb.status === 201 && rowb?.name === "Vali" && rowb.telegramUsername === null && rowb.telegramLastName === null && rowb.telegramPhotoUrl === null && rowb.avatarUrl === null, "5. username/familiya/rasm/til bo'lmasa ham ro'yxatdan o'tadi (taxmin qilinmaydi)")
  const nameless = await login(new Client(), initData({ id: ids[2] }))
  ok(nameless.status === 201 && nameless.data.name === "Telegram foydalanuvchi", "5. hatto ismsiz foydalanuvchi ham ochiladi")

  // ── 6) Yaroqsiz ma'lumotlar rad etiladi ──
  const before = await prisma.user.count()
  const good = initData(tgUser(ids[3]))
  const tamper = (key: string, value: string) => { const p = new URLSearchParams(good); p.set(key, value); return p.toString() }
  ok((await login(anon, tamper("user", JSON.stringify(tgUser(ids[0]))))).status === 401, "6. user.id almashtirilgan initData (boshqa odamga o'tib olish) rad etildi (401)")
  ok((await login(anon, initData(tgUser(ids[3]), { token: "999:BOSHQA-TOKEN" }))).status === 401, "6. boshqa bot tokeni bilan imzolangan initData rad etildi")
  ok((await login(anon, good + "&is_admin=true")).status === 401, "6. qo'shimcha maydon qo'shilgan initData rad etildi")
  const noHash = new URLSearchParams(good); noHash.delete("hash")
  ok((await login(anon, noHash.toString())).status === 400, "6. hash yo'q → 400")
  ok((await anon.req("POST", "/api/auth/telegram", { id: ids[3], first_name: "Soxta", username: "fake" })).status === 400, "6. qo'lda to'qilgan foydalanuvchi ma'lumoti (initData'siz) rad etildi (400)")
  ok((await anon.req("POST", "/api/auth/telegram", { initData: JSON.stringify(tgUser(ids[3])) })).status === 400, "6. initDataUnsafe ko'rinishidagi JSON isbot emas (400)")
  ok((await anon.req("POST", "/api/auth/telegram", "matn")).status === 400 && (await anon.req("POST", "/api/auth/telegram", {})).status === 400, "6. bo'sh/noto'g'ri body → 400")
  ok((await anon.req("POST", "/api/auth/telegram", { initData: initData(tgUser(ids[3]), { authDate: nowSec() }), isAdmin: true, id: 1 })).data.isAdmin === false, "6. so'rovga qo'shilgan isAdmin/id e'tiborsiz (hisob oddiy)")
  const afterBad = await prisma.user.count()
  ok(afterBad === before + 1, "6. rad etilgan urinishlar hisob yaratmadi (faqat oxirgi to'g'ri so'rov bitta hisob ochdi)")

  // ── 7) Muddati o'tgan ma'lumot rad etiladi ──
  const exp = await login(anon, initData(tgUser(ids[4]), { authDate: nowSec() - 2 * 86400 }))
  ok(exp.status === 401 && exp.data.code === "TELEGRAM_EXPIRED", "7. 2 kunlik (muddati o'tgan) initData rad etildi (401 TELEGRAM_EXPIRED)")
  ok((await login(anon, initData(tgUser(ids[4]), { authDate: nowSec() + 3600 }))).status === 401, "7. kelajakdagi auth_date rad etildi")
  ok((await prisma.user.count({ where: { telegramId: BigInt(ids[4]) } })) === 0, "7. muddati o'tgan urinish hisob yaratmadi")

  // ── 8) Boshqa foydalanuvchi ma'lumotiga kirib bo'lmaydi ──
  const A = new Client(), B = new Client()
  const ra = await login(A, initData(tgUser(ids[5]))), rbb = await login(B, initData(tgUser(ids[6])))
  const hb = await B.req("POST", "/api/habits", newHabit(`B-habit-${stamp}`))
  const bHabitId = hb.data?.user?.habits?.[0]?.id
  ok(hb.status === 200 || hb.status === 201, "8. B o'z odatini yaratdi")
  const peek = await A.req("GET", `/api/users/${rbb.data.id}`)
  ok(peek.status === 200 && peek.data.email === undefined && peek.data.password === undefined && peek.data.telegramLinked === undefined && peek.data.plannedHabits === undefined, "8. A, B profilini faqat ochiq maydonlar bilan ko'radi (email/parol/ulanish yashirin)")
  ok((await new Client().req("GET", `/api/users/${rbb.data.id}`)).status === 401 && (await new Client().req("GET", "/api/habits/status")).status === 401, "8. sessiyasiz so'rovlar 401")
  await A.req("DELETE", "/api/habits", { habitId: bHabitId })
  ok(bHabitId !== undefined && (await prisma.habit.count({ where: { id: BigInt(bHabitId) } })) === 1, "8. A, B ning odatini o'chira olmadi")
  ok((await A.req("PUT", "/api/users", { name: "Buzildi", id: rbb.data.id })).status < 500 && (await prisma.user.findUnique({ where: { id: BigInt(rbb.data.id) } }))?.name === "Ali Valiyev", "8. A so'rovga B ning id'sini qo'shib, B ning profilini o'zgartira olmadi")
  void ra

  // ── 9) Logout ──
  const L = new Client(); const rl = await login(L, initData(tgUser(ids[7])))
  const oldRefresh = L.cookies.get("refresh_token")!
  await L.req("POST", "/api/auth/logout")
  ok(!L.cookies.has("access_token") && (await L.req("GET", "/api/auth/me")).status === 401, "9. logoutdan keyin sessiya yo'q (cookie tozalandi, /me 401)")
  const stale = new Client(); stale.cookies.set("refresh_token", oldRefresh)
  ok((await stale.req("POST", "/api/auth/refresh")).status === 401, "9. logoutdan keyin eski refresh token bekor qilingan (401)")
  ok((await login(L, initData(tgUser(ids[7])))).data.id === rl.data.id && (await L.req("GET", "/api/auth/me")).status === 200, "9. qayta kirish o'sha hisobga olib boradi")

  // ── 10) Bloklangan ──
  await prisma.user.update({ where: { telegramId: BigInt(ids[7]) }, data: { isActive: false } })
  ok((await login(new Client(), initData(tgUser(ids[7])))).status === 403, "10. bloklangan Telegram foydalanuvchisi kira olmaydi (403)")

  // ── 11) Mavjud (parol bilan ro'yxatdan o'tgan) foydalanuvchini xavfsiz ulash ──
  const E = await mkPasswordUser("link")
  await E.c.req("POST", "/api/habits", newHabit(`E-habit-${stamp}`))
  const eHabits = await prisma.habit.count({ where: { userId: BigInt(E.id) } })
  ok((await new Client().req("POST", "/api/auth/telegram/link-token")).status === 401, "11. ulash tokenini sessiyasiz olib bo'lmaydi (401)")
  const lt = await E.c.req("POST", "/api/auth/telegram/link-token")
  ok(lt.status === 200 && /^https:\/\/t\.me\/.+\?startapp=l_[A-Za-z0-9_-]+$/.test(lt.data.url), "11. kirgan foydalanuvchi Mini App ulash havolasini oldi (startapp faqat ruxsat etilgan belgilardan)")
  const sp = startapp(lt.data.url)

  // Xuddi shu ismli/usernameli Telegram foydalanuvchisi ULANISHDAN OLDIN ochilsa — alohida bo'sh hisob, E ga qo'shilmaydi
  const sameName = await login(new Client(), initData(tgUser(ids[8], { first_name: "User link", username: `link${stamp}` })))
  ok(sameName.status === 201 && sameName.data.id !== E.id, "11. ism/username mos kelishi hisoblarni AVTOMATIK birlashtirmaydi")
  // Telegram foydalanuvchisi L (ids[9]) havola bilan keladi
  const Lc = new Client()
  const forged = new URLSearchParams(initData(tgUser(ids[9]))); forged.set("start_param", sp)
  ok((await login(Lc, forged.toString())).status === 401, "11. start_param ni imzosiz qo'shib soxtalashtirib bo'lmaydi (401)")
  const usersBefore = await prisma.user.count()
  const prev = await login(Lc, initData(tgUser(ids[9]), { startParam: sp }))
  ok(prev.status === 200 && prev.data.linkRequest?.accountName === "User link" && !Lc.cookies.has("access_token"), "11. 1-qadam: faqat tasdiq so'raladi — sessiya BERILMAYDI")
  ok((await prisma.user.findUnique({ where: { id: BigInt(E.id) } }))?.telegramId === null && (await prisma.user.count()) === usersBefore, "11. tasdiqdan oldin hech narsa ulanmadi va hisob ochilmadi")
  ok((await login(new Client(), initData(tgUser(ids[9]), { startParam: "l_" + Buffer.from(E.c.cookies.get("access_token")!).toString("base64url") }), true)).data.code === "TELEGRAM_LINK_INVALID", "11. boshqa turdagi JWT (access token) ulash tokeni sifatida o'tmaydi")
  const conf = await login(Lc, initData(tgUser(ids[9]), { startParam: sp }), true)
  ok(conf.status === 200 && conf.data.id === E.id && conf.data.linked === true && Lc.cookies.has("access_token"), "11. 2-qadam: tasdiqlandi — Telegram mavjud hisobga ulandi va shu hisob sessiyasi berildi")
  ok((await prisma.user.findUnique({ where: { id: BigInt(E.id) } }))?.telegramId === BigInt(ids[9]) && (await prisma.habit.count({ where: { userId: BigInt(E.id) } })) === eHabits, "11. ulangan hisobning odatlari saqlanib qoldi")
  ok((await login(new Client(), initData(tgUser(ids[9]), { startParam: sp }), true)).status === 409, "11. ulash tokeni bir martalik: qayta ishlatib bo'lmaydi (409)")
  const reopen = await login(new Client(), initData(tgUser(ids[9])))
  ok(reopen.status === 200 && reopen.data.id === E.id, "11. keyingi ochishlarda Telegram shu mavjud hisobga kiritadi")
  ok((await E.c.req("POST", "/api/auth/telegram/link-token")).status === 409, "11. allaqachon ulangan hisob yangi token ola olmaydi (409)")

  // ── 12) Ulashdan oldin Mini App ochib qo'ygan (hali bo'sh) hisob: ma'lumot O'CHIRILMAYDI ──
  const F = await mkPasswordUser("pristine")
  const P = new Client(); const rp = await login(P, initData(tgUser(ids[10])))
  const spF = startapp((await F.c.req("POST", "/api/auth/telegram/link-token")).data.url)
  const usersBeforeP = await prisma.user.count()
  const linkP = await login(new Client(), initData(tgUser(ids[10]), { startParam: spF }), true)
  ok(linkP.status === 200 && linkP.data.id === F.id, "12. bo'sh avto-hisob egasi ulashni tasdiqlasa, Telegram asl hisobga ulanadi")
  const emptyRow = await prisma.user.findUnique({ where: { id: BigInt(rp.data.id) } })
  ok(!!emptyRow && emptyRow.telegramId === null && (await prisma.user.count()) === usersBeforeP, "12. bo'sh avto-hisob O'CHIRILMADI (faqat Telegram ID dan ajratildi)")
  ok((await P.req("POST", "/api/auth/refresh")).status === 401, "12. bo'sh hisobning eski sessiyasi bekor qilindi")

  // ── 13) Ma'lumotli Telegram hisobi hech qachon tegilmaydi ──
  const Q = new Client(); const rq = await login(Q, initData(tgUser(ids[11])))
  await Q.req("POST", "/api/habits", newHabit(`Q-habit-${stamp}`))
  const G = await mkPasswordUser("conflict")
  const spG = startapp((await G.c.req("POST", "/api/auth/telegram/link-token")).data.url)
  const conflict = await login(new Client(), initData(tgUser(ids[11]), { startParam: spG }), true)
  ok(conflict.status === 409 && conflict.data.code === "TELEGRAM_LINK_FAILED", "13. ma'lumotli Telegram hisobi boshqa hisobga avtomatik birlashtirilmaydi (409)")
  ok((await prisma.user.findUnique({ where: { id: BigInt(rq.data.id) } }))?.telegramId === BigInt(ids[11]) && (await prisma.habit.count({ where: { userId: BigInt(rq.data.id) } })) === 1 && (await prisma.user.findUnique({ where: { id: BigInt(G.id) } }))?.telegramId === null, "13. ikkala hisob va ma'lumotlar o'zgarishsiz qoldi")

  // ── 14) Migratsiyadan oldingi (eski) foydalanuvchi ma'lumotlari ──
  if (process.env.LEGACY_USER_ID) {
    const lid = BigInt(process.env.LEGACY_USER_ID)
    const u = await prisma.user.findUnique({ where: { id: lid }, include: { _count: { select: { habits: true, xpHistory: true, pomodoroSessions: true, weeklyTasks: true } } } })
    ok(!!u && u.name === "Legacy Ali" && u.email === "ali@example.com" && u.totalXP === 420 && u.level === 3 && u.pomodoroTotal === 7 && u.telegramId === null && u.unlockedAvatars.includes("fox") && u.completedTasks.length === 2, "14. eski foydalanuvchi profili, XP, mukofotlari o'zgarmagan")
    ok(u?._count.habits === 1 && u?._count.xpHistory === 1 && u?._count.pomodoroSessions === 1 && u?._count.weeklyTasks === 1, "14. eski foydalanuvchining odatlari, XP tarixi, pomodoro, vazifalari saqlangan")
  }

  await prisma.$disconnect()
  console.log(failed ? `\n${failed} ta tekshiruv muvaffaqiyatsiz ❌` : "\nBarcha Telegram Mini App tekshiruvlari o'tdi ✅")
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
