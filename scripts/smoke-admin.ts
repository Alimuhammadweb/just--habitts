/**
 * Admin paneli, rollar, community ruxsatlari, murojaatlar, profil va Google hisob mantig'ini haqiqiy HTTP + bazada tekshiradi.
 * Ishga tushirish (server va baza ishlab turganda):
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/smoke-admin.ts
 * Server EXTRA_ALLOWED_ORIGIN=$BASE_URL bilan ishga tushirilgan va GOOGLE_CLIENT_ID/SECRET berilgan bo'lishi kerak. TEST bazasida ishlating.
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"
import { resolveGoogleLogin } from "../lib/server/google-account"

const BASE = process.env.BASE_URL || "http://localhost:3000"
let failed = 0
const ok = (c: unknown, m: string) => { if (c) console.log("ok  ", m); else { failed++; console.error("FAIL", m) } }

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
    return { status: res.status, data, location: res.headers.get("location") ?? "" }
  }
  // Brauzerdek top-level sahifa so'rovi (Origin yo'q)
  async page(path: string) {
    const res = await fetch(BASE + path, { redirect: "manual", headers: { Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") } })
    await res.text()
    return { status: res.status, location: res.headers.get("location") ?? "" }
  }
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 3 }) })
  const pw = "Str0ng!Passw0rd", stamp = Date.now()
  const anon = new Client(), U = new Client(), V = new Client(), AD = new Client(), B = new Client()

  const reg = async (name: string) => (await anon.req("POST", "/api/users", { name, email: `${name.toLowerCase()}${stamp}@test.uz`, password: pw })).data.id as number
  const idU = await reg("Normal"), idV = await reg("Other"), idB = await reg("Boss")
  await U.req("POST", "/api/auth/login", { email: `normal${stamp}@test.uz`, password: pw })
  await V.req("POST", "/api/auth/login", { email: `other${stamp}@test.uz`, password: pw })
  await B.req("POST", "/api/auth/login", { email: `boss${stamp}@test.uz`, password: pw })
  const adm = await AD.req("POST", "/api/auth/login", { email: process.env.ADMIN_EMAIL!, password: process.env.ADMIN_PASSWORD! })
  ok(adm.status === 200 && adm.data.isAdmin === true, "env admin login")
  ok((await prisma.user.findUnique({ where: { id: BigInt(idU) } }))?.isAdmin === false, "yangi ro'yxatdan o'tgan foydalanuvchi isAdmin=false")

  // ── 3/4. Admin sahifa va API'lar: server tomonida himoyalangan ──
  const adminApis: [string, string, unknown?][] = [["GET", "/api/admin/overview"], ["GET", "/api/admin/users"], ["GET", `/api/admin/users/${idV}`], ["PATCH", `/api/admin/users/${idV}`, { isActive: false }],
    ["PATCH", `/api/admin/users/${idU}`, { isAdmin: true }], ["GET", "/api/admin/community"], ["POST", "/api/admin/community", { content: "x" }], ["GET", "/api/admin/feedback"], ["GET", "/api/admin/audit"], ["GET", "/api/admin/system"], ["GET", "/api/users"], ["DELETE", `/api/users/${idV}`]]
  for (const [m, p, b] of adminApis) {
    ok((await U.req(m, p, b)).status === 403, `oddiy foydalanuvchi ${m} ${p} → 403`)
    ok((await anon.req(m, p, b)).status === 401, `sessiyasiz ${m} ${p} → 401`)
  }
  ok((await anon.page("/admin")).location.includes("/?admin=1"), "/admin sessiyasiz → bosh sahifaga yo'naltiriladi")
  const pu = await U.page("/admin")
  ok(pu.status >= 300 && pu.status < 400 && !pu.location.includes("admin"), "/admin oddiy foydalanuvchi → admin sahifa ko'rsatilmaydi (yo'naltirildi)")
  ok((await AD.page("/admin")).status === 200, "/admin admin uchun ochiladi (200)")

  // ── Admin ma'lumotlari: haqiqiy ma'lumot, maxfiy maydonlarsiz ──
  const ov = await AD.req("GET", "/api/admin/overview")
  ok(ov.status === 200 && ov.data.users.total >= 3 && ov.data.registrations.length === 14 && Array.isArray(ov.data.recent), "overview: haqiqiy hisoblagichlar")
  const ul = await AD.req("GET", `/api/admin/users?q=normal${stamp}`)
  ok(ul.status === 200 && ul.data.total === 1 && ul.data.users[0].id === idU, "foydalanuvchi qidiruvi (email bo'yicha)")
  const leak = /"(password|salt|tokenHash|refreshToken|jti)"\s*:/
  ok(!leak.test(JSON.stringify(ul.data)) && !leak.test(JSON.stringify((await AD.req("GET", `/api/admin/users/${idU}`)).data)), "admin API'da parol/xesh/token maydonlari yo'q")
  ok((await AD.req("GET", "/api/admin/users?status=inactive&role=admin&provider=google&sort=xp")).status === 200, "filtrlar ishlaydi")
  ok((await AD.req("GET", "/api/admin/system")).data.database.ok === true, "system: baza holati")

  // ── Rol va akkaunt boshqaruvi ──
  ok((await AD.req("PATCH", `/api/admin/users/${idB}`, { isAdmin: true, isSuperuser: true })).status === 400, "PATCH noma'lum maydonni rad etadi")
  ok((await AD.req("PATCH", `/api/admin/users/${idB}`, { isAdmin: true })).status === 200, "admin B'ni admin qildi")
  ok((await prisma.user.findUnique({ where: { id: BigInt(idB) } }))?.isAdmin === true, "bazada isAdmin=true")
  // B tokeni eski (isAdmin=false) — yangilagach admin bo'ladi
  ok((await B.req("GET", "/api/admin/overview")).status === 403, "eski token (adminlikdan oldingi) hali ruxsat bermaydi")
  ok((await B.req("POST", "/api/auth/refresh")).status === 200, "refresh yangi rolni bazadan oldi")
  ok((await B.req("GET", "/api/admin/overview")).status === 200, "B endi admin (server bazadan tasdiqladi)")
  ok((await B.req("PATCH", `/api/admin/users/${idB}`, { isAdmin: false })).status === 400, "admin o'z rolini o'zgartira olmaydi")
  ok((await B.req("PATCH", `/api/admin/users/${idB}`, { isActive: false })).status === 400, "admin o'zini bloklay olmaydi")
  ok((await AD.req("PATCH", `/api/admin/users/${idB}`, { isActive: false })).status === 409, "adminni avval tushirmay bloklab bo'lmaydi")
  ok((await AD.req("DELETE", `/api/users/${idB}`)).status === 409, "adminni o'chirib bo'lmaydi")
  ok((await AD.req("PATCH", `/api/admin/users/${idB}`, { isAdmin: false })).status === 200, "adminlik olib tashlandi")
  ok((await B.req("GET", "/api/admin/overview")).status === 403, "tushirilgan admin ESKI tokeni bilan ham darhol rad etiladi (token 15 daqiqa amal qilsa ham)")
  ok((await B.req("POST", "/api/community/posts", { content: "hack" })).status === 403, "tushirilgan admin post yarata olmaydi")
  ok((await B.page("/admin")).location !== "" && (await B.page("/admin")).status !== 200, "/admin tushirilgan admin uchun yopiq")

  // Bloklash
  ok((await AD.req("PATCH", `/api/admin/users/${idV}`, { isActive: false })).status === 200, "V bloklandi")
  ok((await V.req("POST", "/api/auth/refresh")).status === 401, "bloklangan foydalanuvchi sessiyasini yangilay olmaydi")
  ok((await anon.req("POST", "/api/auth/login", { email: `other${stamp}@test.uz`, password: pw })).status === 403, "bloklangan foydalanuvchi kira olmaydi")
  ok((await AD.req("PATCH", `/api/admin/users/${idV}`, { isActive: true })).status === 200, "V faollashtirildi")
  ok((await anon.req("POST", "/api/auth/login", { email: `other${stamp}@test.uz`, password: pw })).status === 200, "faollashtirilgach kira oladi")
  const audit = await AD.req("GET", "/api/admin/audit")
  const acts = new Set(audit.data.items.map((i: any) => i.action))
  ok(["user.promote_admin", "user.demote_admin", "user.deactivate", "user.activate"].every((a) => acts.has(a)), "amallar audit jurnaliga yozildi")

  // ── Profil: himoyalangan maydonlarni o'zgartirib bo'lmaydi ──
  const sneaky = await U.req("PUT", "/api/users", { firstName: "Ali", isAdmin: true, isActive: false, email: "x@y.z", id: 0, password: "hack" })
  ok(sneaky.status === 200, "profil PUT (begona maydonlar e'tiborsiz)")
  const rowU = await prisma.user.findUnique({ where: { id: BigInt(idU) } })
  ok(rowU?.isAdmin === false && rowU?.isActive === true && rowU?.email === `normal${stamp}@test.uz` && rowU?.firstName === "Ali", "isAdmin/isActive/email profil orqali o'zgarmadi")
  ok((await U.req("PUT", "/api/users", { avatarUrl: "https://example.com/a.png" })).status === 200 && (await prisma.user.findUnique({ where: { id: BigInt(idU) } }))?.avatarUrl === "https://example.com/a.png", "avatar havolasi saqlandi")
  ok((await U.req("PUT", "/api/users", { avatarUrl: "javascript:alert(1)" })).status === 400, "noto'g'ri avatar havolasi rad etildi")
  ok((await U.req("PUT", "/api/users", { avatarUrl: "" })).status === 200 && (await prisma.user.findUnique({ where: { id: BigInt(idU) } }))?.avatarUrl === null, "avatarni olib tashlash (bo'sh qiymat) ishlaydi")
  ok((await U.req("PUT", "/api/users", { firstName: "Ali", lastName: "", avatarUrl: "", selectedBadge: "none", selectedBorder: "none", selectedFrame: "none", selectedBackground: "default" })).status === 200, "Profil sahifasi yuboradigan to'liq so'rov (rasmsiz) qabul qilinadi")

  // ── Community: faqat admin; qoralama; foydalanuvchi ko'rishi ──
  ok((await U.req("POST", "/api/community/posts", { content: "x" })).status === 403 && (await U.req("POST", "/api/admin/community", { content: "x" })).status === 403, "oddiy foydalanuvchi post yarata olmaydi")
  const draft = await AD.req("POST", "/api/admin/community", { title: "Qoralama", content: "Hali tayyor emas", isPublished: false, isPinned: true })
  ok(draft.status === 201 && draft.data.isPublished === false && draft.data.isPinned === false, "qoralama yaratildi (mahkamlanmadi)")
  ok(!(await U.req("GET", "/api/community/posts")).data.some((p: any) => p.id === draft.data.id), "qoralama foydalanuvchiga ko'rinmaydi")
  ok((await U.req("POST", "/api/community/comments", { postId: draft.data.id, content: "salom" })).status === 404, "qoralamaga izoh yozib bo'lmaydi")
  ok((await U.req("PATCH", `/api/admin/community/${draft.data.id}`, { isPublished: true })).status === 403, "oddiy foydalanuvchi nashr eta olmaydi")
  const pub = await AD.req("PATCH", `/api/admin/community/${draft.data.id}`, { isPublished: true, content: "Tayyor!" })
  ok(pub.status === 200 && pub.data.isPublished === true, "admin nashr etdi")
  const feedU = await U.req("GET", "/api/community/posts")
  ok(feedU.data.some((p: any) => p.id === draft.data.id && p.content === "Tayyor!"), "foydalanuvchi nashr etilgan postni ko'radi")
  ok((await U.req("POST", "/api/community/comments", { postId: draft.data.id, content: "Rahmat" })).status === 201, "foydalanuvchi izoh qoldira oladi")
  ok((await U.req("PATCH", "/api/community/posts", { postId: draft.data.id, updates: { content: "buzdim" } })).status === 403 && (await U.req("DELETE", `/api/community/posts?postId=${draft.data.id}`)).status === 403 && (await U.req("DELETE", `/api/admin/community/${draft.data.id}`)).status === 403, "oddiy foydalanuvchi tahrirlay/o'chira olmaydi")
  ok((await AD.req("POST", "/api/admin/community", { content: "x", linkUrl: "javascript:alert(1)" })).status === 400, "xavfli havola sxemasi rad etildi")
  ok((await AD.req("DELETE", `/api/admin/community/${draft.data.id}`)).status === 200 && (await prisma.communityPost.count({ where: { id: BigInt(draft.data.id) } })) === 0, "admin postni o'chirdi")

  // ── Murojaatlar: foydalanuvchi admin huquqisiz yozadi, admin javob beradi ──
  const f = await U.req("POST", "/api/feedback", { type: "bug", subject: "Tugma ishlamayapti", message: "Profilda saqlash tugmasi bosilmayapti" })
  ok(f.status === 201 && (await prisma.user.findUnique({ where: { id: BigInt(idU) } }))?.isAdmin === false, "oddiy foydalanuvchi murojaat yubordi va admin bo'lmadi")
  ok((await U.req("POST", "/api/feedback", { type: "hack", subject: "abc", message: "abc" })).status === 400, "noto'g'ri tur rad etildi")
  const lst = await U.req("GET", "/api/feedback")
  ok(lst.data.items.length === 1 && lst.data.unread === 0, "foydalanuvchi o'z murojaatini ko'radi")
  ok((await V.req("GET", `/api/feedback/${f.data.id}`)).status === 404 && (await V.req("POST", `/api/feedback/${f.data.id}`, { body: "men ham" })).status === 404, "boshqa foydalanuvchi suhbatni ko'ra/yoza olmaydi")
  ok((await V.req("GET", "/api/feedback")).data.items.length === 0, "boshqa foydalanuvchi ro'yxatida yo'q")
  const al = await AD.req("GET", "/api/admin/feedback?unread=1")
  ok(al.data.total >= 1 && al.data.items.some((i: any) => i.id === f.data.id && i.adminUnread), "admin o'qilmagan murojaatni ko'radi")
  const th = await AD.req("GET", `/api/admin/feedback/${f.data.id}`)
  ok(th.status === 200 && th.data.messages.length === 1 && th.data.user.id === idU, "admin suhbatni ochdi")
  const rep = await AD.req("POST", `/api/admin/feedback/${f.data.id}`, { body: "Rahmat, tuzatamiz" })
  ok(rep.status === 201 && rep.data.status === "in_progress", "admin javob berdi (holat: jarayonda)")
  ok((await U.req("POST", `/api/admin/feedback/${f.data.id}`, { body: "o'zimga javob" })).status === 403, "foydalanuvchi admin sifatida javob yoza olmaydi")
  ok((await U.req("GET", "/api/feedback")).data.unread === 1, "foydalanuvchi yangi javobni ko'radi (o'qilmagan: 1)")
  const ut = await U.req("GET", `/api/feedback/${f.data.id}`)
  ok(ut.data.messages.length === 2 && ut.data.messages[1].senderRole === "admin" && !JSON.stringify(ut.data).includes("senderId"), "foydalanuvchi admin javobini o'qidi")
  ok((await U.req("GET", "/api/feedback")).data.unread === 0, "o'qilgach belgi o'chdi")
  ok((await U.req("POST", `/api/feedback/${f.data.id}`, { body: "Rahmat!" })).status === 201, "foydalanuvchi javob yozdi")
  ok((await AD.req("PATCH", `/api/admin/feedback/${f.data.id}`, { status: "closed" })).status === 200, "admin yopdi")
  ok((await U.req("POST", `/api/feedback/${f.data.id}`, { body: "yana" })).status === 409, "yopilgan suhbatga yozib bo'lmaydi")

  // ── 1. Google: hisob mantig'i (haqiqiy Google chaqirilmaydi; id_token tekshiruvi server kodida) ──
  const g1 = { sub: `g-sub-${stamp}`, email: `guser${stamp}@gmail.test`, name: "Google User", picture: "https://lh3.example/a.jpg" }
  const r1 = await resolveGoogleLogin(g1)
  ok(r1.ok && r1.created && r1.isAdmin === false, "yangi Google foydalanuvchisi yaratildi, admin EMAS")
  const row1 = await prisma.user.findUnique({ where: { googleSub: g1.sub } })
  ok(row1?.isAdmin === false && row1?.isActive === true && row1?.email === g1.email && row1?.streakFreezes === 1 && row1?.avatarUrl === g1.picture, "standart huquq/qiymatlar to'g'ri")
  ok((await anon.req("POST", "/api/auth/login", { email: g1.email, password: "" })).status !== 200 && (await anon.req("POST", "/api/auth/login", { email: g1.email, password: pw })).status === 401, "Google hisobiga parol bilan kirib bo'lmaydi (yaroqsiz xesh)")
  const r1b = await resolveGoogleLogin(g1)
  ok(r1b.ok && !r1b.created && r1.ok && r1b.id === r1.id, "qayta kirish — o'sha hisob (sub bo'yicha)")
  ok((await prisma.user.count({ where: { email: g1.email } })) === 1, "dublikat hisob yaratilmadi")
  const r2 = await resolveGoogleLogin({ sub: `g-sub2-${stamp}`, email: `normal${stamp}@test.uz`, name: "Normal" })
  ok(!r2.ok && r2.error === "google_link_required" && (await prisma.user.findUnique({ where: { id: BigInt(idU) } }))?.googleSub === null, "mavjud parolli hisob email bo'yicha AVTOMATIK ulanmaydi")
  await prisma.user.update({ where: { googleSub: g1.sub }, data: { isActive: false } })
  const r3 = await resolveGoogleLogin(g1)
  ok(!r3.ok && r3.error === "blocked", "bloklangan Google foydalanuvchisi kira olmaydi")
  const r4 = await resolveGoogleLogin({ sub: `g-sub4-${stamp}`, email: process.env.ADMIN_EMAIL!, name: "X" })
  ok(!r4.ok && (await prisma.user.count({ where: { googleSub: `g-sub4-${stamp}` } })) === 0, ".env admin emaili Google orqali band qilinmaydi")

  // Google HTTP oqimi: yo'naltirish, state/PKCE, noto'g'ri callback'lar
  const st = await anon.req("GET", "/api/auth/google/start")
  const loc = new URL(st.location || "http://x")
  ok(st.status >= 300 && st.status < 400 && loc.host === "accounts.google.com" && loc.searchParams.get("code_challenge_method") === "S256" && !!loc.searchParams.get("state") && !!loc.searchParams.get("nonce") && loc.searchParams.get("redirect_uri") === `${process.env.APP_URL}/api/auth/google/callback` && loc.searchParams.get("scope") === "openid email profile", "Google'ga yo'naltirish: state+nonce+PKCE(S256)+redirect_uri")
  ok(!st.location.includes("test-secret") && anon.cookies.has("g_oauth"), "client_secret URL'da yo'q, holat cookie'da")
  const fresh = new Client()
  await fresh.req("GET", "/api/auth/google/start")
  const cb1 = await fresh.req("GET", `/api/auth/google/callback?code=abc&state=WRONG`)
  ok(cb1.location.includes("auth_error=google_state") && !fresh.cookies.has("access_token"), "noto'g'ri state rad etildi, sessiya berilmadi")
  const cb2 = await new Client().req("GET", `/api/auth/google/callback?code=abc&state=abc`)
  ok(cb2.location.includes("auth_error=google_state"), "state cookie'siz callback rad etildi")
  ok((await new Client().req("GET", `/api/auth/google/callback?error=access_denied`)).location.includes("auth_error=google_denied"), "foydalanuvchi rad etsa — tushunarli xato")
  ok((await new Client().req("POST", "/api/auth/google/link")).status === 401, "Google ulash — sessiya talab qiladi")
  const lk = await U.req("POST", "/api/auth/google/link")
  ok(lk.status === 200 && lk.data.url.startsWith("https://accounts.google.com/") && U.cookies.has("g_oauth"), "Google ulash: kirgan foydalanuvchiga URL")
  ok((await anon.req("GET", "/api/auth/config")).data.google === true, "config: google yoqilgan")
  const me = await U.req("GET", "/api/auth/me")
  ok(me.status === 200 && me.data.id === idU && me.data.password === undefined && me.data.googleLinked === false, "/api/auth/me: sessiya egasi, parolsiz")
  ok((await AD.req("GET", "/api/auth/me")).data.id === 0, "/api/auth/me: .env admin")

  await prisma.$disconnect()
  console.log(failed ? `\n${failed} ta tekshiruv muvaffaqiyatsiz ❌` : "\nBarcha admin/rol/Google tekshiruvlari o'tdi ✅")
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
