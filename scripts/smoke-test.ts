/**
 * Ishlab turgan ilovani (next start) haqiqiy HTTP so'rovlar bilan tekshiradi.
 * Ishga tushirish: BASE_URL=http://localhost:3000 npx tsx scripts/smoke-test.ts   (BO'SH test bazasi bilan)
 * Server EXTRA_ALLOWED_ORIGIN=$BASE_URL bilan ishga tushirilgan bo'lishi kerak.
 */
import "dotenv/config"
import { randomBytes, createHash } from "node:crypto"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"
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
    return { status: res.status, data }
  }
}

async function main() {
  const A = new Client(), B = new Client(), anon = new Client()
  const pw = "Str0ng!Passw0rd"
  const stamp = Date.now()

  ok((await anon.req("GET", "/api/health")).data.status === "ok", "health: PostgreSQL ulanishi")
  ok((await anon.req("GET", "/api/users")).status === 401, "autentifikatsiyasiz /api/users rad etildi")

  // Ro'yxatdan o'tish
  const ra = await anon.req("POST", "/api/users", { name: "Ali", email: `ali${stamp}@test.uz`, password: pw })
  const rb = await anon.req("POST", "/api/users", { name: "Vali", email: `vali${stamp}@test.uz`, password: pw })
  ok(ra.status === 201 && !ra.data.password && ra.data.id > 0, "ro'yxatdan o'tish (parolsiz javob)")
  ok(rb.status === 201, "ikkinchi foydalanuvchi")
  ok((await anon.req("POST", "/api/users", { name: "Ali", email: `ali${stamp}@test.uz`, password: pw })).status === 409, "takroriy email → 409")
  const idA = ra.data.id as number, idB = rb.data.id as number

  // Login
  ok((await anon.req("POST", "/api/auth/login", { email: `ali${stamp}@test.uz`, password: "wrong" })).status === 401, "noto'g'ri parol → 401")
  const la = await A.req("POST", "/api/auth/login", { email: `ali${stamp}@test.uz`, password: pw })
  ok(la.status === 200 && la.data.id === idA && la.data.password === undefined && la.data.salt === undefined, "login: parol/salt chiqmaydi")
  ok(A.cookies.size >= 2, "sessiya cookie'lari o'rnatildi")
  await B.req("POST", "/api/auth/login", { email: `vali${stamp}@test.uz`, password: pw })
  const rf = await A.req("POST", "/api/auth/refresh")
  ok(rf.status === 200, "refresh token bilan yangilash")
  ok((await A.req("GET", `/api/users/${idA}`)).data.email === `ali${stamp}@test.uz`, "o'z profilini o'qish")
  const pubB = await A.req("GET", `/api/users/${idB}`)
  ok(pubB.status === 200 && pubB.data.email === undefined && pubB.data.password === undefined, "boshqa profilda email/parol yo'q")

  // Odat va XP
  const hab = await A.req("POST", "/api/habits", { habit: { name: "Kitob", why: "bilim", duration: 21, time: { hour: 8, minute: 0 }, notifications: false, startDate: { timestamp: Date.now() } } })
  ok(hab.status === 201 && hab.data.habit?.id, "odat qo'shildi")
  const hid = hab.data.habit.id as number
  const st = await A.req("POST", "/api/habits/status", { habitId: hid, dayIndex: 0, status: "completed" })
  ok(st.status === 200 && st.data.user.xpData.totalXP > 0, `kun belgilandi, XP=${st.data.user?.xpData?.totalXP}`)
  const me = await A.req("GET", `/api/users/${idA}`)
  ok(me.data.habits[0].days["0"] === "completed" && me.data.habits[0].dayLocks["0"]?.xpAwarded === 10 && me.data.habits[0].dayLocks["0"]?.locked === false, "kun holati va bugungi qulf (hali yopilmagan) bazadan qaytdi")
  ok(me.data.xpData.xpHistory.length === 1 && me.data.xpData.totalXP === st.data.user.xpData.totalXP, "XP tarixi saqlandi")
  const again = await A.req("POST", "/api/habits/status", { habitId: hid, dayIndex: 0, status: "completed" })
  ok(again.status === 200 && again.data.user.xpData.totalXP === st.data.user.xpData.totalXP, "takroriy belgilash XP'ni ko'paytirmaydi")
  ok((await A.req("PUT", "/api/habits", { habitId: hid, updates: { name: "Kitob o'qish" } })).status === 200, "odat tahrirlandi")
  ok((await B.req("PUT", "/api/habits", { habitId: hid, updates: { name: "hack" } })).status === 404, "boshqa user odatini tahrirlay olmaydi")
  const pm = await A.req("POST", "/api/pomodoro", { session: { count: 2 } })
  ok(pm.status === 200, "pomodoro")
  // Parallel yozuvlar (optimistik nazorat): 6 ta bir vaqtda pomodoro
  const par = await Promise.all(Array.from({ length: 6 }, () => A.req("POST", "/api/pomodoro", { session: { count: 1 } })))
  ok(par.every((r) => r.status === 200), "parallel so'rovlar xatosiz")
  const after = await A.req("GET", `/api/users/${idA}`)
  ok(after.data.pomodoroData.totalPomodoros === 8, `parallel pomodoro yo'qolmadi (jami ${after.data.pomodoroData.totalPomodoros}/8)`)

  // Reja (weekly tasks)
  const today = new Date().toISOString().slice(0, 10)
  const t1 = await A.req("POST", "/api/weekly-tasks", { title: "Reja 1", date: today, time: "09:00", category: "study", priority: "high" })
  const t2 = await A.req("POST", "/api/weekly-tasks", { title: "Reja 2", date: today })
  ok(t1.status === 201 && t2.status === 201, "vazifalar yaratildi")
  const lst = await A.req("GET", `/api/weekly-tasks?from=${today}&to=${today}`)
  ok(lst.data.tasks.length === 2 && lst.data.tasks[0].time === null, "ro'yxat: vaqtsiz vazifa birinchi (Mongo tartibi)")
  const tid = t1.data.task.id as string
  ok((await A.req("PATCH", `/api/weekly-tasks/${tid}`, { completed: true })).data.task.completedAt, "vazifa bajarildi (completedAt)")
  ok((await B.req("GET", `/api/weekly-tasks?from=${today}&to=${today}`)).data.tasks.length === 0, "B A'ning vazifalarini ko'rmaydi")
  ok((await B.req("PATCH", `/api/weekly-tasks/${tid}`, { completed: false })).status === 404, "B A'ning vazifasini o'zgartira olmaydi (404)")
  ok((await B.req("DELETE", `/api/weekly-tasks/${tid}`)).status === 404, "B A'ning vazifasini o'chira olmaydi (404)")
  ok((await A.req("DELETE", `/api/weekly-tasks/${t2.data.task.id}`)).status === 200, "o'z vazifasini o'chirish")

  // Do'stlar
  ok((await B.req("GET", `/api/friends?userId=${idA}`)).status === 403, "B A'ning do'stlar ro'yxatini ola olmaydi")
  const sr = await A.req("GET", `/api/friends/search?q=${encodeURIComponent("vali" + stamp)}`)
  ok(sr.data.users?.length === 1 && sr.data.users[0].id === idB, "qidiruv topdi")
  ok((await A.req("GET", `/api/friends/search?q=${encodeURIComponent(".*(")}`)).status === 200, "regex belgilari qidiruvni buzmaydi")
  ok((await B.req("POST", "/api/friends", { userId: idB, targetId: idA, action: "accept" })).status === 404, "so'rovsiz 'accept' rad etildi")
  ok((await B.req("POST", "/api/friends", { userId: idA, targetId: idB, action: "send" })).status === 403, "boshqa nomidan so'rov yuborib bo'lmaydi")
  ok((await A.req("POST", "/api/friends", { userId: idA, targetId: idB, action: "send" })).status === 200, "do'stlik so'rovi yuborildi")
  const reqs = await B.req("GET", `/api/friends?userId=${idB}`)
  ok(reqs.data.requests.length === 1 && reqs.data.requests[0].id === idA, "B so'rovni ko'rdi")
  ok((await B.req("POST", "/api/friends", { userId: idB, targetId: idA, action: "accept" })).status === 200, "qabul qilindi")
  const fa = await A.req("GET", `/api/friends?userId=${idA}`)
  ok(fa.data.friends.length === 1 && fa.data.friends[0].id === idB, "A'da do'st ko'rinadi")
  ok((await B.req("GET", `/api/friends?userId=${idB}`)).data.friends[0].id === idA, "B'da ham (ikki tomonlama)")
  ok((await A.req("GET", `/api/users/${idA}`)).data.friends.includes(idB), "profilda friends massivi to'ldirilgan")

  // Reyting
  const lb = await B.req("GET", "/api/leaderboard?period=all")
  ok(lb.data.entries.length === 1 && lb.data.entries[0].id === idA && lb.data.entries[0].score > 0, "reyting: A birinchi")
  ok(lb.data.me === null && lb.data.entries[0].email === undefined, "reytingda maxfiy maydon yo'q")
  const lbw = await A.req("GET", "/api/leaderboard?period=week")
  ok(lbw.status === 200 && lbw.data.entries.length === 1, "haftalik reyting")

  // Jamoa: rasmiy post FAQAT admin yaratadi (oddiy foydalanuvchi 403, sessiyasiz 401)
  const AD = new Client()
  const adm = await AD.req("POST", "/api/auth/login", { email: process.env.ADMIN_EMAIL || "admin@test.local", password: process.env.ADMIN_PASSWORD || "AdminPass123!" })
  ok(adm.status === 200 && adm.data.isAdmin === true, "admin login (.env dan)")
  ok((await anon.req("POST", "/api/community/posts", { content: "Salom" })).status === 401, "sessiyasiz post yaratib bo'lmaydi (401)")
  ok((await A.req("POST", "/api/community/posts", { content: "Salom jamoa", userName: "HACKER", isAdmin: true, userId: 0 })).status === 403, "oddiy foydalanuvchi post yarata olmaydi (isAdmin:true yuborsa ham) → 403")
  const p1 = await AD.req("POST", "/api/community/posts", { content: "Salom jamoa", userName: "HACKER", userId: 5 })
  ok(p1.status === 201 && p1.data.userName === "Admin" && p1.data.isAdminPost === true && p1.data.userId === 0, "admin posti: ism/muallif sessiyadan (soxtalashtirib bo'lmaydi)")
  const pid = p1.data.id as number
  const c1 = await B.req("POST", "/api/community/comments", { postId: pid, content: "Zo'r!" })
  ok(c1.status === 201 && c1.data.userName === "Vali", "izoh qo'shildi")
  const r1 = await B.req("POST", "/api/community/reactions", { postId: pid, type: "fire" })
  ok(r1.data.action === "added", "reaksiya qo'shildi")
  const rr = await Promise.all([A.req("POST", "/api/community/reactions", { postId: pid, type: "like" }), A.req("POST", "/api/community/reactions", { postId: pid, type: "like" })])
  ok(rr.every((r) => r.status === 200), "parallel reaksiyalar xatosiz")
  const feed = await A.req("GET", "/api/community/posts")
  ok(feed.data[0].id === pid && feed.data[0].comments.length === 1 && feed.data[0].reactions.length >= 1, "lenta: post + izoh + reaksiya")
  ok((await A.req("DELETE", `/api/community/comments?postId=${pid}&commentId=${c1.data.id}`)).status === 403, "A B'ning izohini o'chira olmaydi")
  ok((await B.req("DELETE", `/api/community/posts?postId=${pid}`)).status === 403, "oddiy foydalanuvchi postni o'chira olmaydi")
  ok((await B.req("PATCH", "/api/community/posts", { postId: pid, updates: { isPinned: true } })).status === 403, "admin bo'lmagan PATCH rad etildi")
  ok((await B.req("DELETE", `/api/community/comments?postId=${pid}&commentId=${c1.data.id}`)).status === 200, "o'z izohini o'chirish")

  // Admin
  ok((await AD.req("GET", "/api/users")).data.length === 2, "admin: barcha foydalanuvchilar")
  const ap = await AD.req("POST", "/api/community/posts", { title: "E'lon", content: "Admin e'loni" })
  ok(ap.data.isAdminPost === true && ap.data.isPinned === true && ap.data.userName === "Admin", "admin posti pinned")
  const feed2 = await A.req("GET", "/api/community/posts")
  ok(feed2.data[0].id === ap.data.id, "pinned post birinchi")
  const pu = await AD.req("PATCH", "/api/community/posts", { postId: pid, updates: { isPinned: true, title: "Yangi" } })
  ok(pu.status === 200 && pu.data.isPinned === true && pu.data.title === "Yangi", "admin PATCH")
  ok((await AD.req("PATCH", "/api/community/posts", { postId: pid, updates: { userId: 5 } })).status === 400, "PATCH ruxsat etilmagan maydonni rad etdi")

  // Parol tiklash va profil
  ok((await A.req("PUT", "/api/users", { firstName: "Ali", lastName: "Valiyev", publicProfile: true, selectedTheme: "dark" })).status === 200, "profil yangilandi")
  const prof = await A.req("GET", `/api/users/${idA}`)
  ok(prof.data.firstName === "Ali" && prof.data.publicProfile === true && prof.data.selectedTheme === "dark", "profil maydonlari saqlandi")
  ok((await A.req("POST", "/api/users/upload-avatar", { userId: idA, avatarData: "https://example.com/a.png" })).status === 200, "avatar")
  ok((await A.req("POST", "/api/users/upload-avatar", { userId: idB, avatarData: "https://example.com/a.png" })).status === 403, "boshqa avatarini o'zgartirib bo'lmaydi")
  // Parolni tiklash: email sozlanmagan serverda 501; oqimning o'zi bazadagi token orqali tekshiriladi
  const fg = await anon.req("POST", "/api/auth/forgot", { email: `ali${stamp}@test.uz` })
  ok(fg.status === 501 || fg.status === 200, `forgot: ${fg.status === 501 ? "email sozlanmagan (501)" : "200"}`)
  const token = randomBytes(32).toString("hex")
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 }) })
  await prisma.passwordReset.create({ data: { userId: BigInt(idA), tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 600_000) } })
  const newPw = "N3w!Passw0rd-xyz"
  ok((await anon.req("POST", "/api/auth/reset", { token, password: newPw })).status === 200, "parol tiklandi")
  ok((await anon.req("POST", "/api/auth/reset", { token, password: "Another!Pass123" })).status === 400, "token qayta ishlatib bo'lmaydi")
  ok((await anon.req("POST", "/api/auth/login", { email: `ali${stamp}@test.uz`, password: pw })).status === 401, "eski parol endi ishlamaydi")
  ok((await anon.req("POST", "/api/auth/login", { email: `ali${stamp}@test.uz`, password: newPw })).status === 200, "yangi parol bilan kirish")
  ok((await A.req("POST", "/api/auth/refresh")).status === 401, "parol o'zgargach eski refresh token bekor qilingan")
  await prisma.$disconnect()

  // Logout
  ok((await A.req("POST", "/api/auth/logout")).status === 200, "logout")

  // Admin foydalanuvchini o'chiradi — bog'liq yozuvlar CASCADE
  ok((await AD.req("DELETE", `/api/users/${idB}`)).status === 200, "admin foydalanuvchini o'chirdi")
  ok((await AD.req("GET", `/api/users/${idB}`)).status === 404, "o'chirilgan foydalanuvchi topilmaydi")

  console.log(failed ? `\n${failed} ta tekshiruv MUVAFFAQIYATSIZ` : "\nBarcha tekshiruvlar o'tdi ✅")
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
