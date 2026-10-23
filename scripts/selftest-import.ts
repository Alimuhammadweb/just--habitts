/**
 * Import mantiqining o'z-o'zini tekshirish testi: Mongo shaklidagi namunaviy hujjatlar → lokal PostgreSQL.
 * Ishga tushirish: DATABASE_URL (BO'SH test bazasi) bilan `npx tsx scripts/selftest-import.ts`
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"
import { buildPlan, writePlan, validatePlan, type Source } from "./import-mongo-to-postgres"

const oid = (hex: string) => ({ toHexString: () => hex })
const day = (s: string) => ({ status: s })
const now = Date.now()
const habit = (id: number, extra = {}) => ({
  id, name: "O'qish", duration: 21, days: { 0: "completed", 1: "missed", 2: "frozen" },
  dayLocks: { 0: { status: "completed", markedAt: now, dateString: "2026-10-01", xpAwarded: 10, locked: true } },
  time: { hour: 7, minute: 30 }, notifications: true,
  startDate: { day: 1, month: 10, year: 2026, timestamp: now }, why: "sog'lik", missReasons: { 1: "kasal" }, ...extra,
})
const data: Record<string, any[]> = {
  users: [
    { id: 1760000000000001, name: "Ali", email: "Ali@Mail.com ", password: "scrypt$abc", createdAt: "2026-09-01T10:00:00.000Z", isActive: true,
      habits: [habit(1760000000001001), habit(1760000000001002, { time: null })], stats: { totalHabits: 2, completedDays: 3, currentStreak: 1, longestStreak: 2 },
      pomodoroData: { sessions: [{ id: 5, date: "2026-10-01", count: 3 }], totalPomodoros: 3 },
      xpData: { totalXP: 120, level: 2, rank: null, weeklyXP: 40, monthlyXP: 80, weekKey: "2026-10-19", currentXP: 20, lastUpdated: now,
        xpHistory: [{ date: "2026-10-01", xpEarned: 10, habitId: 1760000000001001, dayIndex: 0, status: "completed", timestamp: now }] },
      unlockedThemes: ["dark"], completedTasks: [1, 2], friends: [1760000000000002], friendRequests: [1760000000000003], sentRequests: [],
      streakFreezes: 1, totalFreezesUsed: 0, activeChallenges: [{ challengeId: 3, startedAt: now, completedDays: [0, 1], isCompleted: false }],
      completedChallenges: [1], challengeRewards: [{ type: "badge", value: "x" }], _rev: 4 },
    { id: 1760000000000002, name: "Vali", email: "vali@mail.com", password: "legacyhash", salt: "s1", createdAt: "2026-09-02T10:00:00.000Z",
      habits: [habit(1760000000001001)], // boshqa foydalanuvchi bilan to'qnashgan habit id
      xpData: { totalXP: 10, level: 1, xpHistory: [{ date: "d", xpEarned: 5, habitId: 1760000000001001, dayIndex: 0, status: "completed", timestamp: now }] },
      friends: [1760000000000001], friendRequests: [], sentRequests: [] },
    { id: 1760000000000003, name: "Sami", email: "sami@mail.com", password: "p", createdAt: "bad-date", sentRequests: [1760000000000001] },
    { id: 1760000000000004, name: "Dup", email: "vali@mail.com", password: "p" },   // takroriy email
    { name: "NoId", email: "x@y.z", password: "p" },                                 // id yo'q
  ],
  weekly_tasks: [
    { _id: oid("64b7f0c2a1b2c3d4e5f60718"), userId: 1760000000000001, title: "Reja", date: "2026-10-22", time: "09:00", category: "study", priority: "high", completed: true, completedAt: "2026-10-22T05:00:00Z", createdAt: "2026-10-20T00:00:00Z" },
    { _id: oid("64b7f0c2a1b2c3d4e5f60719"), userId: 999, title: "Yetim", date: "2026-10-22" },
  ],
  community_posts: [
    { id: 11, userId: 0, userName: "Admin", content: "Salom", isPinned: true, isAdminPost: true, createdAt: "2026-10-01T00:00:00Z",
      comments: [{ id: 21, postId: 11, userId: 1760000000000001, userName: "Ali", content: "Zo'r", createdAt: "2026-10-01T01:00:00Z" }],
      reactions: [{ id: 31, postId: 11, userId: 1760000000000001, type: "like" }, { id: 32, postId: 11, userId: 1760000000000001, type: "heart" }] },
    { id: 12, userId: 1760000000000002, userName: "Vali", content: "Post 2", comments: [{ id: 21, userId: 1760000000000002, userName: "Vali", content: "takroriy id" }], reactions: [] },
  ],
  refresh_tokens: [
    { jti: "j1", userId: 1760000000000001, tokenHash: "h1", expiresAt: new Date(now + 86400000) },
    { jti: "j2", userId: 1760000000000001, tokenHash: "h2", expiresAt: new Date(now - 1000) },
  ],
  password_resets: [{ userId: 1760000000000002, tokenHash: "r1", expiresAt: new Date(now + 600000), used: false }],
}
const source: Source = { async *docs(c) { for (const d of data[c] ?? []) yield d } }

const assert = (c: unknown, m: string) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1 } else console.log("ok  ", m) }

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 3 }) })
  for (const t of ["PasswordReset", "RefreshToken", "Reaction", "Comment", "CommunityPost", "WeeklyTask", "FriendRequest", "Friendship", "User"]) await prisma.$executeRawUnsafe(`DELETE FROM "${t}"`)

  for (let run = 1; run <= 2; run++) {
    const owners = new Map((await prisma.habit.findMany({ select: { id: true, userId: true } })).map((h) => [String(h.id), h.userId]))
    const plan = await buildPlan(source, owners)
    if (run === 1) {
      assert(plan.users.length === 3, "3 ta yaroqli foydalanuvchi (takroriy email va id'siz o'tkazib yuborildi)")
      assert(plan.skipped.filter((s) => s.collection === "users").length === 2, "2 ta user skipped")
      assert(plan.tasks.length === 1 && plan.skipped.some((s) => s.collection === "weekly_tasks"), "yetim vazifa o'tkazib yuborildi")
      assert(plan.friendPairs.length === 1 && plan.requests.length === 1, "do'stlik 1 juft, so'rov 1 ta")
      assert(plan.posts[1].comments[0].id !== BigInt(21), "takroriy izoh id qayta berildi")
      assert(plan.posts[0].reactions.length === 1, "takroriy reaksiya tashlandi")
      assert(plan.refreshTokens.length === 1, "faqat amaldagi refresh token")
    }
    await writePlan(prisma, plan, {})
    const v = await validatePlan(prisma, plan)
    assert(v.ok, `run ${run}: validatsiya o'tdi ${v.ok ? "" : JSON.stringify(v.rows.filter((r) => !r.ok)) + v.mismatches.join(";")}`)
  }
  const ali = await prisma.user.findUnique({ where: { id: BigInt(1760000000000001) } })
  assert(ali?.email === "ali@mail.com" && ali.rev === 4 && ali.password === "scrypt$abc", "email kichik harfga, parol xesh va rev saqlandi")
  const vali = await prisma.user.findUnique({ where: { id: BigInt(1760000000000002) }, include: { habits: true } })
  assert(vali?.salt === "s1" && vali.habits.length === 1 && vali.habits[0].id !== BigInt(1760000000001001), "to'qnashgan habit id qayta berildi, salt saqlandi")
  const vx = await prisma.xpHistory.findMany({ where: { userId: BigInt(1760000000000002) } })
  assert(vx.length === 1 && vx[0].habitId === vali!.habits[0].id, "XP tarixi yangi habit id ga yo'naltirildi")
  assert((await prisma.habit.count()) === 3, "qayta ishga tushirilganda odatlar ko'paymadi")
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
