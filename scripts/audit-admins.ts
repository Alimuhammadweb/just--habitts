/**
 * Administrator rollarini tekshirish va (xohlansa) xato berilgan adminlikni qaytarish.
 *
 *   npx tsx scripts/audit-admins.ts                         # FAQAT ko'rsatadi (hech narsani o'zgartirmaydi)
 *   npx tsx scripts/audit-admins.ts --demote=123,456        # nimalar o'zgarishini ko'rsatadi (dry-run)
 *   npx tsx scripts/audit-admins.ts --demote=123,456 --apply  # haqiqatan oddiy foydalanuvchiga tushiradi
 *
 * Xavfsizlik: avtomatik hech kim tushirilmaydi — qaysi hisob haqiqiy admin ekanini SIZ belgilaysiz.
 * Hech narsa o'chirilmaydi; faqat User.isAdmin=false qilinadi, sessiyalar bekor qilinadi va AuditLog'ga yoziladi.
 * Ishga tushirishdan oldin bazadan zaxira nusxa oling.
 */
import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1]
const apply = process.argv.includes("--apply")
const demote = (arg("demote") ?? "").split(",").map((s) => s.trim()).filter(Boolean)

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL (yoki DIRECT_URL) kerak")
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

  const admins = await db.user.findMany({
    where: { isAdmin: true }, orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, createdAt: true, lastLoginAt: true, isActive: true, googleSub: true, _count: { select: { habits: true } } },
  })
  const envEmail = (process.env.ADMIN_EMAIL || "").toLowerCase()
  console.log(`\nBazada isAdmin=true bo'lgan hisoblar: ${admins.length}`)
  if (envEmail) console.log(`(.env admini ${envEmail} bazada saqlanmaydi — u bu ro'yxatda chiqmaydi.)`)
  console.log("─".repeat(100))
  for (const a of admins) {
    const posts = await db.communityPost.count({ where: { userId: a.id } })
    const hint = [a._count.habits > 0 ? `${a._count.habits} odat` : null, `${posts} post`, a.googleSub ? "Google" : null, a.isActive ? null : "BLOKLANGAN"].filter(Boolean).join(", ")
    console.log(`#${a.id}  ${a.name.padEnd(22)} ${a.email.padEnd(32)} ro'yxatdan: ${a.createdAt.toISOString().slice(0, 10)}  oxirgi kirish: ${a.lastLoginAt?.toISOString().slice(0, 10) ?? "—"}  [${hint}]`)
  }
  console.log("─".repeat(100))

  if (!demote.length) { console.log("Hech narsa o'zgartirilmadi. Tushirish uchun: --demote=ID,ID [--apply]\n"); await db.$disconnect(); return }

  const ids = demote.map((d) => { if (!/^\d+$/.test(d)) throw new Error(`Noto'g'ri ID: ${d}`); return BigInt(d) })
  const targets = admins.filter((a) => ids.includes(a.id))
  const unknown = ids.filter((i) => !targets.some((t) => t.id === i))
  if (unknown.length) throw new Error(`Bu ID'lar admin emas yoki mavjud emas: ${unknown.join(", ")}`)
  if (targets.length >= admins.length && !envEmail) throw new Error("Barcha adminlarni tushirib bo'lmaydi: .env admini sozlanmagan, tizim boshqaruvsiz qolardi.")

  for (const t of targets) console.log(`${apply ? "TUSHIRILDI" : "[dry-run] tushiriladi"}: #${t.id} ${t.name} <${t.email}>`)
  if (!apply) { console.log("\nDry-run. Haqiqatan bajarish uchun --apply qo'shing.\n"); await db.$disconnect(); return }

  await db.$transaction([
    db.user.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { isAdmin: false } }),
    db.refreshToken.updateMany({ where: { userId: { in: targets.map((t) => t.id) } }, data: { revoked: true } }), // eski admin tokenlari yaroqsiz bo'lsin
    ...targets.map((t) => db.auditLog.create({ data: { actorId: BigInt(0), actorName: "audit-admins script", action: "user.demote_admin", targetType: "user", targetId: String(t.id), meta: { email: t.email, via: "script" } } })),
  ])
  console.log(`\nTayyor: ${targets.length} ta hisob oddiy foydalanuvchiga o'tkazildi.\n`)
  await db.$disconnect()
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
