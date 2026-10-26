/**
 * Telegram Login (imzo, replay, yangi/mavjud foydalanuvchi, ulash, bloklash) — haqiqiy HTTP + baza.
 * Telegram'ga ulanilmaydi: ma'lumot test bot tokeni bilan o'zimiz imzolaymiz (Telegram aynan shunday imzolaydi).
 *   BASE_URL=http://localhost:3000 npx tsx scripts/smoke-telegram.ts
 * Server TELEGRAM_BOT_TOKEN va TELEGRAM_BOT_USERNAME bilan, EXTRA_ALLOWED_ORIGIN=$BASE_URL bilan ishlab turishi kerak. Faqat TEST bazasida!
 */
import "dotenv/config"
import { createHash, createHmac } from "node:crypto"
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
    return { status: res.status, data }
  }
}
let counter = 0
const sign = (over: Record<string, string | number> = {}, token = TOKEN) => {
  const f: Record<string, string | number> = { id: 0, first_name: "Test", username: "tg_test", auth_date: Math.floor(Date.now() / 1000), _n: ++counter, ...over }
  delete f._n // har chaqiriqda auth_date bir soniyada bir xil bo'lishi mumkin; yagona hash uchun first_name'ga raqam qo'shamiz
  f.first_name = `${over.first_name ?? "Test"}${counter}`
  const check = Object.keys(f).sort().map((k) => `${k}=${f[k]}`).join("\n")
  return { ...f, hash: createHmac("sha256", createHash("sha256").update(token).digest()).update(check).digest("hex") }
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 3 }) })
  const stamp = Date.now(), tgId = Number(String(stamp).slice(-9)), tgId2 = tgId + 1, tgId3 = tgId + 2
  const anon = new Client()

  ok((await anon.req("GET", "/api/auth/config")).data.telegram === process.env.TELEGRAM_BOT_USERNAME!.replace(/^@/, ""), "config: bot username ochiq, token yo'q")
  ok(!JSON.stringify((await anon.req("GET", "/api/auth/config")).data).includes(TOKEN), "config javobida bot tokeni yo'q")

  // 1) Yangi foydalanuvchi
  const T = new Client()
  const p1 = sign({ id: tgId, first_name: "Ali" })
  const r1 = await T.req("POST", "/api/auth/telegram", p1)
  ok(r1.status === 201 && r1.data.isAdmin === false && T.cookies.has("access_token") && T.cookies.has("refresh_token"), "1. yangi Telegram foydalanuvchisi yaratildi (201), admin EMAS, cookie'lar berildi")
  const row = await prisma.user.findUnique({ where: { telegramId: BigInt(tgId) } })
  ok(row && row.isAdmin === false && row.isActive && row.email === `tg_${tgId}@telegram.invalid` && row.googleSub === null && row.lastLoginAt !== null, "1. bazada oddiy foydalanuvchi, ichki email, lastLoginAt yozilgan")
  ok(!JSON.stringify(r1.data).includes('"password":"') || r1.data.password === undefined, "1. javobda parol xeshi yo'q")
  ok((await T.req("GET", "/api/auth/me")).data.id === r1.data.id, "1. /api/auth/me: sessiya tanildi")

  // 2) Replay va soxta ma'lumotlar
  ok((await new Client().req("POST", "/api/auth/telegram", p1)).status === 401, "2. aynan o'sha ma'lumotni qayta yuborish (replay) rad etildi")
  const p2 = sign({ id: tgId })
  ok((await anon.req("POST", "/api/auth/telegram", { ...p2, id: tgId + 99 })).status === 401, "2. id almashtirilgan ma'lumot (boshqa odamga o'tib olish) rad etildi")
  ok((await anon.req("POST", "/api/auth/telegram", sign({ id: tgId }, "999:BOSHQA-TOKEN"))).status === 401, "2. boshqa bot tokeni bilan imzolangan ma'lumot rad etildi")
  ok((await anon.req("POST", "/api/auth/telegram", sign({ id: tgId, auth_date: Math.floor(Date.now() / 1000) - 7200 }))).status === 401, "2. eskirgan (2 soat) ma'lumot rad etildi")
  const { hash: _h, ...noHash } = sign({ id: tgId }); void _h
  ok((await anon.req("POST", "/api/auth/telegram", noHash)).status === 400, "2. hash yo'q → 400")
  ok((await anon.req("POST", "/api/auth/telegram", "matn")).status === 400 && (await anon.req("POST", "/api/auth/telegram", {})).status === 400, "2. bo'sh/noto'g'ri body → 400")
  ok((await prisma.user.count({ where: { telegramId: { in: [BigInt(tgId + 99)] } } })) === 0, "2. rad etilgan urinishlar hisob yaratmadi")
  const admTry = await anon.req("POST", "/api/auth/telegram", { ...sign({ id: tgId2 }), isAdmin: true })
  ok(admTry.status === 201 && admTry.data.isAdmin === false, "2. so'rovga qo'shilgan isAdmin:true e'tiborsiz (hisob oddiy)")

  // 3) Qayta kirish — o'sha hisob; Telegram hisobiga parol bilan kirib bo'lmaydi
  const T2 = new Client()
  const r3 = await T2.req("POST", "/api/auth/telegram", sign({ id: tgId }))
  ok(r3.status === 200 && r3.data.id === r1.data.id && (await prisma.user.count({ where: { telegramId: BigInt(tgId) } })) === 1, "3. qayta kirish: o'sha hisob (200), dublikat yo'q")
  ok((await anon.req("POST", "/api/auth/login", { email: `tg_${tgId}@telegram.invalid`, password: "Str0ng!Passw0rd" })).status === 401, "3. Telegram hisobiga parol bilan kirib bo'lmaydi")

  // 4) Sahifani yangilash / logout / qayta login
  ok((await T.req("GET", "/api/auth/me")).status === 200 && (await T.req("POST", "/api/auth/refresh")).status === 200, "4. yangilash va refresh ishlaydi")
  await T.req("POST", "/api/auth/logout")
  ok((await T.req("GET", "/api/auth/me")).status === 401, "4. logoutdan keyin sessiya yo'q")
  ok((await T.req("POST", "/api/auth/telegram", sign({ id: tgId }))).status === 200 && (await T.req("GET", "/api/auth/me")).status === 200, "4. qayta login ishlaydi")

  // 5) Bloklangan
  await prisma.user.update({ where: { telegramId: BigInt(tgId) }, data: { isActive: false } })
  ok((await new Client().req("POST", "/api/auth/telegram", sign({ id: tgId }))).status === 403, "5. bloklangan Telegram foydalanuvchisi kira olmaydi (403)")

  // 6) Mavjud hisobga ULASH (Profil sahifasidan)
  const E = new Client()
  const email = `tglink${stamp}@test.uz`, pw = "Str0ng!Passw0rd"
  const reg = await anon.req("POST", "/api/users", { name: "Linker", email, password: pw })
  await E.req("POST", "/api/auth/login", { email, password: pw })
  ok((await new Client().req("POST", "/api/auth/telegram/link", sign({ id: tgId3 }))).status === 401, "6. ulash sessiyasiz mumkin emas (401)")
  ok((await E.req("POST", "/api/auth/telegram/link", sign({ id: tgId3 }, "999:BOSHQA"))).status === 401, "6. ulash: soxta imzo rad etildi")
  const lk = await E.req("POST", "/api/auth/telegram/link", sign({ id: tgId3 }))
  ok(lk.status === 200 && (await prisma.user.findUnique({ where: { id: BigInt(reg.data.id) } }))?.telegramId === BigInt(tgId3), "6. kirgan foydalanuvchi Telegram'ni ulay oldi")
  ok((await E.req("GET", `/api/users/${reg.data.id}`)).data.telegramLinked === true, "6. profil telegramLinked=true ko'rsatadi")
  const V = new Client(); await V.req("POST", "/api/auth/telegram", sign({ id: tgId2 }))
  const peek = await V.req("GET", `/api/users/${reg.data.id}`)
  ok(peek.status === 200 && peek.data.telegramLinked === undefined && peek.data.googleLinked === undefined && peek.data.email === undefined, "6. boshqa foydalanuvchi profilida ulanish/email maydonlari yashirin")
  ok((await V.req("POST", "/api/auth/telegram/link", sign({ id: tgId3 }))).status === 409, "6. boshqaga ulangan Telegram'ni ulab bo'lmaydi (409)")
  ok((await E.req("POST", "/api/auth/telegram/link", sign({ id: tgId3 + 50 }))).status === 409, "6. bitta hisobga ikkinchi Telegram ulanmaydi (409)")
  const back = new Client()
  ok((await back.req("POST", "/api/auth/telegram", sign({ id: tgId3 }))).data.id === reg.data.id, "6. ulangandan keyin Telegram bilan o'sha hisobga kiriladi")

  // 7) Admin ko'rinishi
  const A = new Client(); await A.req("POST", "/api/auth/login", { email: process.env.ADMIN_EMAIL!, password: process.env.ADMIN_PASSWORD! })
  const lst = await A.req("GET", `/api/admin/users?provider=telegram&q=tg_${tgId2}`)
  ok(lst.status === 200 && lst.data.users.length === 1 && lst.data.users[0].provider === "telegram", "7. admin ro'yxatida provider=telegram filtri ishlaydi")

  await prisma.$disconnect()
  console.log(failed ? `\n${failed} ta tekshiruv muvaffaqiyatsiz ❌` : "\nBarcha Telegram tekshiruvlari o'tdi ✅")
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
