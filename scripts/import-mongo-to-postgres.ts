/**
 * MongoDB → PostgreSQL ma'lumotlarni ko'chirish skripti (qayta ishga tushirsa ham xavfsiz).
 *
 *   npm run db:import:dry   — faqat o'qiydi va tekshiradi, Postgres'ga HECH NARSA yozmaydi
 *   npm run db:import       — import + avtomatik tekshiruv
 *   npm run db:validate     — faqat manba/maqsad sonlarini solishtirish
 *   Qo'shimcha: --overwrite  (users'dan tashqari jadvallarda mavjud qatorlarni ham qayta yozadi)
 *
 * Xavfsizlik:
 *  - MongoDB'ga faqat O'QISH so'rovlari yuboriladi (find/count). Hech narsa yozilmaydi, o'zgartirilmaydi, o'chirilmaydi.
 *  - Parol xeshlari va salt aynan ko'chiriladi (mavjud loginlar ishlayveradi).
 *  - Ulanish manzillari va maxfiy qiymatlar hech qachon logga chiqarilmaydi.
 *  - Users: id bo'yicha upsert, bolalar jadvallari (odatlar, XP tarixi, ...) shu foydalanuvchi uchun qayta quriladi → idempotent.
 */
import "dotenv/config"
import dns from "node:dns"
import { writeFileSync } from "node:fs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"
import { mapUser, mapTask, toDate, i32, i64n, str, bool, optStr, type Doc, type MappedUser } from "./lib/mapper"

export interface Source {
  docs(collection: string): AsyncIterable<Doc>
  close?(): Promise<void>
}

type Skip = { collection: string; id: string; reason: string }

export interface Plan {
  users: MappedUser[]
  friendPairs: [number, number][]
  requests: [number, number][]
  tasks: { id: string; data: Record<string, unknown> }[]
  posts: {
    post: Record<string, unknown>
    comments: Record<string, unknown>[]
    reactions: Record<string, unknown>[]
  }[]
  refreshTokens: Record<string, unknown>[]
  resets: Record<string, unknown>[]
  skipped: Skip[]
  warnings: string[]
  sourceCounts: Record<string, number>
}

const BI = (n: number) => BigInt(Math.trunc(n))

export async function buildPlan(source: Source, existingHabitOwners: Map<string, bigint> = new Map()): Promise<Plan> {
  const plan: Plan = {
    users: [], friendPairs: [], requests: [], tasks: [], posts: [], refreshTokens: [], resets: [],
    skipped: [], warnings: [],
    sourceCounts: { users: 0, weekly_tasks: 0, community_posts: 0, refresh_tokens: 0, password_resets: 0 },
  }
  const now = new Date()

  // ── users ──
  // To'qnashuv bo'lsa yangi id DETERMINISTIK beriladi (eski id + 1, +2, ...), shuning uchun qayta ishga tushirish bir xil natija beradi
  // va id'lar JavaScript'ning xavfsiz butun son chegarasidan (2^53) oshmaydi.
  const claimed = new Map(existingHabitOwners)
  const assigned = new Set<string>()
  const newHabitId = (orig: bigint, uid: number): bigint => {
    let id = orig
    const free = () => !assigned.has(String(id)) && (claimed.get(String(id)) === undefined || claimed.get(String(id)) === BI(uid))
    while (!free()) id = id + BI(1)
    assigned.add(String(id)); claimed.set(String(id), BI(uid))
    return id
  }
  const seenIds = new Set<number>()
  const emailOwner = new Map<string, number>()
  for await (const doc of source.docs("users")) {
    plan.sourceCounts.users++
    const m = mapUser(doc, newHabitId)
    if ("error" in m) { plan.skipped.push({ collection: "users", id: String(doc.id), reason: m.error }); continue }
    if (seenIds.has(m.id)) { plan.skipped.push({ collection: "users", id: String(m.id), reason: "takroriy id" }); continue }
    const prev = emailOwner.get(m.email)
    if (prev !== undefined) { plan.skipped.push({ collection: "users", id: String(m.id), reason: `email boshqa foydalanuvchi (${prev}) bilan takrorlanadi` }); continue }
    seenIds.add(m.id); emailOwner.set(m.email, m.id)
    for (const w of m.warnings) plan.warnings.push(`user ${m.id}: ${w}`)
    plan.users.push(m)
  }

  // ── do'stlik: massivlardan ikki tomonlama jadvalga ──
  const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)
  const friendSet = new Set<string>()
  for (const u of plan.users) for (const f of u.friends) if (f !== u.id && seenIds.has(f)) friendSet.add(pairKey(u.id, f))
  plan.friendPairs = [...friendSet].map((k) => k.split(":").map(Number) as [number, number])
  const reqSet = new Set<string>()
  const addReq = (from: number, to: number) => {
    if (from === to || !seenIds.has(from) || !seenIds.has(to) || friendSet.has(pairKey(from, to))) return
    reqSet.add(`${from}>${to}`)
  }
  for (const u of plan.users) { for (const x of u.incoming) addReq(x, u.id); for (const y of u.outgoing) addReq(u.id, y) }
  plan.requests = [...reqSet].map((k) => k.split(">").map(Number) as [number, number])

  // ── weekly_tasks ──
  const taskIds = new Set<string>()
  for await (const doc of source.docs("weekly_tasks")) {
    plan.sourceCounts.weekly_tasks++
    const t = mapTask(doc)
    if ("error" in t) { plan.skipped.push({ collection: "weekly_tasks", id: String(doc._id), reason: t.error }); continue }
    if (taskIds.has(t.id)) { plan.skipped.push({ collection: "weekly_tasks", id: t.id, reason: "takroriy id" }); continue }
    if (!seenIds.has(Number(t.data.userId))) { plan.skipped.push({ collection: "weekly_tasks", id: t.id, reason: "egasi (user) topilmadi" }); continue }
    taskIds.add(t.id); plan.tasks.push(t)
  }

  // ── community_posts (izohlar va reaksiyalar massivdan alohida jadvallarga) ──
  const postIds = new Set<string>(), commentIds = new Set<string>(), reactionIds = new Set<string>()
  const uniqueId = (raw: unknown, used: Set<string>, label: string, owner: string): bigint | null => {
    let id = i64n(raw)
    if (id == null) return null
    if (used.has(String(id))) { while (used.has(String(id))) id = id + BI(1); plan.warnings.push(`${label} ${String(raw)} (${owner}): id takrorlangan — yangi id berildi`) }
    used.add(String(id))
    return id
  }
  for await (const doc of source.docs("community_posts")) {
    plan.sourceCounts.community_posts++
    const pid = i64n(doc.id)
    if (pid == null || postIds.has(String(pid))) { plan.skipped.push({ collection: "community_posts", id: String(doc.id), reason: pid == null ? "id yaroqsiz" : "takroriy id" }); continue }
    postIds.add(String(pid))
    const createdAt = toDate(doc.createdAt, now)
    const authorId = Number(doc.userId ?? doc.adminId ?? 0)
    const post = {
      id: pid, userId: BI(Number.isSafeInteger(authorId) ? authorId : 0),
      userName: str(doc.userName ?? doc.adminName, "Foydalanuvchi"), userAvatar: str(doc.userAvatar ?? doc.adminAvatar),
      title: str(doc.title), content: str(doc.content), isPinned: bool(doc.isPinned), isAdminPost: bool(doc.isAdminPost),
      imageUrl: str(doc.imageUrl), linkUrl: str(doc.linkUrl), createdAt, updatedAt: toDate(doc.updatedAt, createdAt),
    }
    const comments: Record<string, unknown>[] = []
    for (const c of Array.isArray(doc.comments) ? doc.comments : []) {
      const cid = uniqueId(c?.id, commentIds, "izoh", String(pid))
      if (cid == null) { plan.skipped.push({ collection: "comments", id: `${pid}/${String(c?.id)}`, reason: "id yaroqsiz" }); continue }
      comments.push({
        id: cid, postId: pid, userId: BI(Number.isSafeInteger(Number(c.userId)) ? Number(c.userId) : 0),
        userName: str(c.userName, "Foydalanuvchi"), userAvatar: str(c.userAvatar), content: str(c.content),
        createdAt: toDate(c.createdAt, createdAt), isDeleted: bool(c.isDeleted),
      })
    }
    const reactions: Record<string, unknown>[] = []
    const reactors = new Set<number>()
    for (const r of Array.isArray(doc.reactions) ? doc.reactions : []) {
      const uid = Number(r?.userId)
      if (!Number.isSafeInteger(uid)) { plan.skipped.push({ collection: "reactions", id: `${pid}/${String(r?.id)}`, reason: "userId yaroqsiz" }); continue }
      if (reactors.has(uid)) { plan.skipped.push({ collection: "reactions", id: `${pid}/${String(r?.id)}`, reason: "bir foydalanuvchidan takroriy reaksiya" }); continue }
      const rid = uniqueId(r?.id, reactionIds, "reaksiya", String(pid))
      if (rid == null) { plan.skipped.push({ collection: "reactions", id: `${pid}/${String(r?.id)}`, reason: "id yaroqsiz" }); continue }
      reactors.add(uid)
      reactions.push({ id: rid, postId: pid, userId: BI(uid), type: str(r.type, "like"), createdAt: toDate(r.createdAt, createdAt) })
    }
    plan.posts.push({ post, comments, reactions })
  }

  // ── refresh_tokens / password_resets: faqat hali amal qilayotganlari ──
  const tokenJtis = new Set<string>()
  for await (const doc of source.docs("refresh_tokens")) {
    plan.sourceCounts.refresh_tokens++
    const exp = toDate(doc.expiresAt, new Date(0))
    const uid = Number(doc.userId)
    if (doc.revoked === true || exp <= now || !seenIds.has(uid) || !optStr(doc.jti) || !optStr(doc.tokenHash) || tokenJtis.has(doc.jti)) continue
    tokenJtis.add(doc.jti)
    plan.refreshTokens.push({ jti: doc.jti, userId: BI(uid), tokenHash: doc.tokenHash, createdAt: toDate(doc.createdAt, now), expiresAt: exp, revoked: false })
  }
  const resetHashes = new Set<string>()
  for await (const doc of source.docs("password_resets")) {
    plan.sourceCounts.password_resets++
    const exp = toDate(doc.expiresAt, new Date(0))
    const uid = Number(doc.userId)
    if (doc.used === true || exp <= now || !seenIds.has(uid) || !optStr(doc.tokenHash) || resetHashes.has(doc.tokenHash)) continue
    resetHashes.add(doc.tokenHash)
    plan.resets.push({ userId: BI(uid), tokenHash: doc.tokenHash, expiresAt: exp, used: false })
  }
  // rate_limits ko'chirilmaydi: bu vaqtinchalik hisoblagichlar (daqiqalar/soatlar ichida eskiradi)
  return plan
}

const chunks = <T,>(arr: T[], n = 1000): T[][] => { const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }

export async function writePlan(prisma: PrismaClient, plan: Plan, opts: { overwrite?: boolean; log?: (s: string) => void } = {}) {
  const log = opts.log ?? (() => {})

  let n = 0
  for (const u of plan.users) {
    const uid = BI(u.id)
    await prisma.$transaction(async (tx) => {
      await tx.user.upsert({ where: { id: uid }, create: { id: uid, ...u.data } as never, update: u.data as never })
      await tx.habit.deleteMany({ where: { userId: uid } }) // HabitDay CASCADE
      await tx.xpHistory.deleteMany({ where: { userId: uid } })
      await tx.pomodoroSession.deleteMany({ where: { userId: uid } })
      await tx.activeChallenge.deleteMany({ where: { userId: uid } })
      for (const c of chunks(u.habits.map((h) => h.habit))) await tx.habit.createMany({ data: c })
      for (const c of chunks(u.habits.flatMap((h) => h.days))) await tx.habitDay.createMany({ data: c })
      for (const c of chunks(u.xpHistory)) await tx.xpHistory.createMany({ data: c })
      for (const c of chunks(u.pomodoro)) await tx.pomodoroSession.createMany({ data: c })
      if (u.challenges.length) await tx.activeChallenge.createMany({ data: u.challenges })
    }, { timeout: 120_000, maxWait: 30_000 })
    if (++n % 50 === 0) log(`  users: ${n}/${plan.users.length}`)
  }
  log(`users: ${n}`)

  const fr = plan.friendPairs.flatMap(([a, b]) => [{ userId: BI(a), friendId: BI(b) }, { userId: BI(b), friendId: BI(a) }])
  for (const c of chunks(fr)) await prisma.friendship.createMany({ data: c, skipDuplicates: true })
  for (const c of chunks(plan.requests.map(([f, t]) => ({ fromId: BI(f), toId: BI(t) })))) await prisma.friendRequest.createMany({ data: c, skipDuplicates: true })

  if (opts.overwrite) await prisma.weeklyTask.deleteMany({ where: { id: { in: plan.tasks.map((t) => t.id) } } })
  for (const c of chunks(plan.tasks.map((t) => t.data))) await prisma.weeklyTask.createMany({ data: c as never, skipDuplicates: true })

  if (opts.overwrite) await prisma.communityPost.deleteMany({ where: { id: { in: plan.posts.map((p) => p.post.id as bigint) } } })
  for (const c of chunks(plan.posts.map((p) => p.post))) await prisma.communityPost.createMany({ data: c as never, skipDuplicates: true })
  for (const c of chunks(plan.posts.flatMap((p) => p.comments))) await prisma.comment.createMany({ data: c as never, skipDuplicates: true })
  for (const c of chunks(plan.posts.flatMap((p) => p.reactions))) await prisma.reaction.createMany({ data: c as never, skipDuplicates: true })

  for (const c of chunks(plan.refreshTokens)) await prisma.refreshToken.createMany({ data: c as never, skipDuplicates: true })
  for (const c of chunks(plan.resets)) await prisma.passwordReset.createMany({ data: c as never, skipDuplicates: true })
}

export interface CheckRow { name: string; source: number; dest: number; ok: boolean }

/** Manba (reja) va Postgres sonlarini solishtiradi. */
export async function validatePlan(prisma: PrismaClient, plan: Plan): Promise<{ ok: boolean; rows: CheckRow[]; mismatches: string[] }> {
  const ids = plan.users.map((u) => BI(u.id))
  const sum = <T,>(f: (u: MappedUser) => T[]) => plan.users.reduce((a, u) => a + f(u).length, 0)
  const rows: CheckRow[] = []
  const add = (name: string, source: number, dest: number) => rows.push({ name, source, dest, ok: source === dest })

  add("users", plan.users.length, await prisma.user.count({ where: { id: { in: ids } } }))
  add("habits", sum((u) => u.habits), await prisma.habit.count({ where: { userId: { in: ids } } }))
  add("habit days", plan.users.reduce((a, u) => a + u.habits.reduce((b, h) => b + h.days.length, 0), 0),
    await prisma.habitDay.count({ where: { habit: { userId: { in: ids } } } }))
  add("xp history", sum((u) => u.xpHistory), await prisma.xpHistory.count({ where: { userId: { in: ids } } }))
  add("pomodoro sessions", sum((u) => u.pomodoro), await prisma.pomodoroSession.count({ where: { userId: { in: ids } } }))
  add("active challenges", sum((u) => u.challenges), await prisma.activeChallenge.count({ where: { userId: { in: ids } } }))
  add("friendships", plan.friendPairs.length * 2, await prisma.friendship.count({ where: { userId: { in: ids }, friendId: { in: ids } } }))
  add("friend requests", plan.requests.length, await prisma.friendRequest.count({ where: { fromId: { in: ids }, toId: { in: ids } } }))
  add("weekly tasks", plan.tasks.length, await prisma.weeklyTask.count({ where: { id: { in: plan.tasks.map((t) => t.id) } } }))
  const postIds = plan.posts.map((p) => p.post.id as bigint)
  add("community posts", plan.posts.length, await prisma.communityPost.count({ where: { id: { in: postIds } } }))
  add("comments", plan.posts.reduce((a, p) => a + p.comments.length, 0), await prisma.comment.count({ where: { postId: { in: postIds } } }))
  add("reactions", plan.posts.reduce((a, p) => a + p.reactions.length, 0), await prisma.reaction.count({ where: { postId: { in: postIds } } }))
  add("refresh tokens (amaldagilari)", plan.refreshTokens.length, await prisma.refreshToken.count({ where: { jti: { in: plan.refreshTokens.map((t) => t.jti as string) } } }))
  add("password resets (amaldagilari)", plan.resets.length, await prisma.passwordReset.count({ where: { tokenHash: { in: plan.resets.map((t) => t.tokenHash as string) } } }))

  const srcXp = plan.users.reduce((a, u) => a + Number(u.data.totalXP), 0)
  const dst = await prisma.user.aggregate({ where: { id: { in: ids } }, _sum: { totalXP: true } })
  add("sum(totalXP)", srcXp, dst._sum.totalXP ?? 0)

  // Har bir foydalanuvchi bo'yicha odatlar va XP tarixi sonlari
  const mismatches: string[] = []
  const habitCounts = new Map((await prisma.habit.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: { in: ids } } })).map((g) => [String(g.userId), g._count._all]))
  const xpCounts = new Map((await prisma.xpHistory.groupBy({ by: ["userId"], _count: { _all: true }, where: { userId: { in: ids } } })).map((g) => [String(g.userId), g._count._all]))
  const totals = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, totalXP: true } })).map((u) => [String(u.id), u.totalXP]))
  for (const u of plan.users) {
    const k = String(u.id)
    if ((habitCounts.get(k) ?? 0) !== u.habits.length) mismatches.push(`user ${u.id}: odatlar soni ${u.habits.length} ≠ ${habitCounts.get(k) ?? 0}`)
    if ((xpCounts.get(k) ?? 0) !== u.xpHistory.length) mismatches.push(`user ${u.id}: XP tarixi ${u.xpHistory.length} ≠ ${xpCounts.get(k) ?? 0}`)
    if (totals.get(k) !== Number(u.data.totalXP)) mismatches.push(`user ${u.id}: totalXP ${u.data.totalXP} ≠ ${totals.get(k)}`)
  }
  return { ok: rows.every((r) => r.ok) && mismatches.length === 0, rows, mismatches: mismatches.slice(0, 20) }
}

// ───────────────────────────── MongoDB manbasi (faqat o'qish) ─────────────────────────────

const hide = (s: string) => s.replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "[mongodb-uri]").replace(/postgres(ql)?:\/\/[^\s"']+/gi, "[postgres-url]")

type DohAnswer = { data: string }
async function dohQuery(name: string, type: "SRV" | "TXT"): Promise<DohAnswer[]> {
  for (const url of [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
  ]) {
    try {
      const res = await fetch(url, { headers: { accept: "application/dns-json" } })
      if (!res.ok) continue
      const data = (await res.json()) as { Answer?: DohAnswer[] }
      if (data.Answer?.length) return data.Answer
    } catch { /* keyingisiga o'tamiz */ }
  }
  return []
}

// Ba'zi tarmoqlarda SRV so'rovlari bloklanadi (querySrv ECONNREFUSED). Ilovadagi kabi DNS-over-HTTPS orqali chetlab o'tamiz.
async function buildFallbackUri(srvUri: string): Promise<string> {
  const m = srvUri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]*)(\?.*)?$/)
  if (!m) throw new Error("mongodb+srv:// formatini tahlil qilib bo'lmadi")
  const [, user, pass, host, dbName, existing] = m
  const [srv, txt] = await Promise.all([dohQuery(`_mongodb._tcp.${host}`, "SRV"), dohQuery(host, "TXT")])
  if (!srv.length) throw new Error("SRV yozuvlarini DNS-over-HTTPS orqali ham topib bo'lmadi")
  const hosts = srv.map((a) => { const p = a.data.trim().split(" "); return `${p[3].replace(/\.$/, "")}:${p[2]}` }).join(",")
  const params = new URLSearchParams(existing ? existing.slice(1) : "")
  for (const pair of txt.map((a) => a.data.replace(/^"|"$/g, "")).join("&").split("&")) {
    const [k, v] = pair.split("=")
    if (k && v && !params.has(k)) params.set(k, v)
  }
  params.set("ssl", "true")
  if (!params.has("authSource")) params.set("authSource", "admin")
  return `mongodb://${user}:${pass}@${hosts}/${dbName}?${params.toString()}`
}

export async function openMongoSource(uri: string, dbName?: string): Promise<Source> {
  try { dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]) } catch { /* e'tiborsiz */ }
  const { MongoClient } = await import("mongodb")
  const connect = (u: string) => new MongoClient(u, { serverSelectionTimeoutMS: 15_000, connectTimeoutMS: 15_000, readPreference: "secondaryPreferred" }).connect()
  let client
  try {
    client = await connect(uri)
  } catch (err) {
    if (!uri.startsWith("mongodb+srv://") || !/querySrv/.test(String((err as Error)?.message) + String((err as { syscall?: string })?.syscall))) throw err
    console.log("SRV DNS bloklangan — DNS-over-HTTPS orqali qayta uriniladi...")
    client = await connect(await buildFallbackUri(uri))
  }
  const name = dbName || uri.split("/").pop()?.split("?")[0] || "just_habits"
  const database = client.db(name)
  return {
    async *docs(collection: string) {
      // FAQAT o'qish: find() — hech qanday yozish/o'chirish operatsiyasi yo'q
      for await (const d of database.collection(collection).find({})) yield d as Doc
    },
    close: () => client.close(),
  }
}

// ───────────────────────────── CLI ─────────────────────────────

function summarize(plan: Plan) {
  const lines = [
    `Manba (MongoDB):  users=${plan.sourceCounts.users}, weekly_tasks=${plan.sourceCounts.weekly_tasks}, community_posts=${plan.sourceCounts.community_posts}, refresh_tokens=${plan.sourceCounts.refresh_tokens}, password_resets=${plan.sourceCounts.password_resets}`,
    `Ko'chiriladi:     users=${plan.users.length}, habits=${plan.users.reduce((a, u) => a + u.habits.length, 0)}, xpHistory=${plan.users.reduce((a, u) => a + u.xpHistory.length, 0)}, friendPairs=${plan.friendPairs.length}, requests=${plan.requests.length}, tasks=${plan.tasks.length}, posts=${plan.posts.length}, comments=${plan.posts.reduce((a, p) => a + p.comments.length, 0)}, reactions=${plan.posts.reduce((a, p) => a + p.reactions.length, 0)}, refreshTokens=${plan.refreshTokens.length}`,
    `O'tkazib yuborilgan: ${plan.skipped.length}, ogohlantirishlar: ${plan.warnings.length}`,
  ]
  return lines.join("\n")
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const dry = args.has("--dry-run"), validateOnly = args.has("--validate-only"), overwrite = args.has("--overwrite")
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) throw new Error("MONGODB_URI sozlanmagan (.env ichida eski MongoDB manzilini kiriting)")
  if (!dry && !process.env.DATABASE_URL) throw new Error("DATABASE_URL sozlanmagan")

  const source = await openMongoSource(mongoUri, process.env.MONGODB_DB)
  const prisma = dry ? null : new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 3 }) })
  try {
    let owners = new Map<string, bigint>()
    if (prisma) owners = new Map((await prisma.habit.findMany({ select: { id: true, userId: true } })).map((h) => [String(h.id), h.userId]))

    console.log("MongoDB'dan o'qilmoqda (faqat o'qish)...")
    const plan = await buildPlan(source, owners)
    console.log(summarize(plan))

    if (!dry && !validateOnly) {
      console.log("PostgreSQL'ga yozilmoqda...")
      await writePlan(prisma!, plan, { overwrite, log: console.log })
    }
    let validation: Awaited<ReturnType<typeof validatePlan>> | null = null
    if (prisma && !dry) {
      validation = await validatePlan(prisma, plan)
      console.log("\nTekshiruv (manba ↔ PostgreSQL):")
      for (const r of validation.rows) console.log(`  ${r.ok ? "OK  " : "XATO"} ${r.name.padEnd(32)} manba=${r.source}  postgres=${r.dest}`)
      for (const m of validation.mismatches) console.log("  XATO", m)
      console.log(validation.ok ? "\n✅ Barcha tekshiruvlar o'tdi." : "\n❌ Nomuvofiqliklar bor — yuqoridagilarni ko'rib chiqing.")
    } else {
      console.log("\n(dry-run: PostgreSQL'ga hech narsa yozilmadi)")
    }
    writeFileSync("migration-report.json", JSON.stringify({
      at: new Date().toISOString(), dryRun: dry, sourceCounts: plan.sourceCounts, skipped: plan.skipped,
      warnings: plan.warnings.slice(0, 500), validation,
    }, null, 2))
    console.log("Hisobot: migration-report.json (parollar/emaillarsiz)")
    if (validation && !validation.ok) process.exitCode = 1
  } finally {
    await source.close?.()
    await prisma?.$disconnect()
  }
}

if (process.argv[1] && /import-mongo-to-postgres/.test(process.argv[1])) {
  main().catch((e) => { console.error("Xato:", hide(e instanceof Error ? e.message : String(e))); process.exit(1) })
}
