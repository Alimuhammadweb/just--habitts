import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash, createHmac } from "node:crypto"
import { verifyTelegramAuth, telegramConfigured } from "../lib/server/telegram"

// Imzoni spetsifikatsiya bo'yicha (core.telegram.org/widgets/login) alohida, mustaqil yozilgan usulda hisoblaymiz
const TOKEN = "123456:TEST-bot-token"
const NOW = 1_800_000_000_000
const sign = (fields: Record<string, string | number>, token = TOKEN) => {
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n")
  return createHmac("sha256", createHash("sha256").update(token).digest()).update(check).digest("hex")
}
const payload = (over: Record<string, string | number> = {}, token = TOKEN) => {
  const f: Record<string, string | number> = { id: 777000, first_name: "Ali", last_name: "Valiyev", username: "ali", auth_date: Math.floor(NOW / 1000) - 5, ...over }
  return { ...f, hash: sign(f, token) }
}

test("to'g'ri imzolangan ma'lumot qabul qilinadi", () => {
  const r = verifyTelegramAuth(payload(), TOKEN, NOW)
  assert.ok(r.ok)
  if (r.ok) { assert.equal(r.identity.id, 777000); assert.equal(r.identity.name, "Ali Valiyev") }
})

test("ism faqat username bo'lsa ham, hech biri bo'lmasa ham nom hosil bo'ladi", () => {
  const a = verifyTelegramAuth(payload({ first_name: "", last_name: "" }), TOKEN, NOW)
  assert.ok(a.ok && a.identity.name === "ali")
  const f = { id: 5, auth_date: Math.floor(NOW / 1000) }
  const b = verifyTelegramAuth({ ...f, hash: sign(f) }, TOKEN, NOW)
  assert.ok(b.ok && b.identity.name === "Telegram foydalanuvchi")
})

test("o'zgartirilgan maydon (id/ism) imzoni buzadi", () => {
  const p = payload()
  assert.deepEqual(verifyTelegramAuth({ ...p, id: 1 }, TOKEN, NOW), { ok: false, reason: "bad_signature" })
  assert.deepEqual(verifyTelegramAuth({ ...p, first_name: "Hacker" }, TOKEN, NOW), { ok: false, reason: "bad_signature" })
})

test("boshqa bot tokeni bilan imzolangan ma'lumot rad etiladi", () => {
  assert.deepEqual(verifyTelegramAuth(payload({}, "999:OTHER"), TOKEN, NOW), { ok: false, reason: "bad_signature" })
})

test("eskirgan va kelajakdagi auth_date rad etiladi", () => {
  assert.deepEqual(verifyTelegramAuth(payload({ auth_date: Math.floor(NOW / 1000) - 3600 }), TOKEN, NOW), { ok: false, reason: "expired" })
  assert.deepEqual(verifyTelegramAuth(payload({ auth_date: Math.floor(NOW / 1000) + 3600 }), TOKEN, NOW), { ok: false, reason: "expired" })
})

test("hash yo'q / noto'g'ri formatda / body noto'g'ri bo'lsa 'bad_request'", () => {
  const { hash, ...noHash } = payload(); void hash
  for (const bad of [noHash, { ...payload(), hash: "xyz" }, { ...payload(), hash: 123 }, null, undefined, "matn", 42, [] as unknown]) {
    const r = verifyTelegramAuth(bad, TOKEN, NOW)
    assert.ok(!r.ok, JSON.stringify(bad))
  }
  assert.deepEqual(verifyTelegramAuth(payload(), "", NOW), { ok: false, reason: "bad_request" }) // token sozlanmagan
})

test("imzoga kirmagan qo'shimcha maydonlar e'tiborsiz qoldiriladi (ishonchli deb olinmaydi)", () => {
  const r = verifyTelegramAuth({ ...payload(), isAdmin: true, email: "x@y.z" }, TOKEN, NOW)
  assert.ok(r.ok)
  assert.deepEqual(Object.keys(r.ok ? r.identity : {}).sort(), ["id", "name"])
})

test("id musbat butun son bo'lishi shart; photo_url faqat https", () => {
  assert.ok(!verifyTelegramAuth(payload({ id: -5 }), TOKEN, NOW).ok)
  assert.ok(!verifyTelegramAuth(payload({ id: 1.5 }), TOKEN, NOW).ok)
  const ok = verifyTelegramAuth(payload({ photo_url: "https://t.me/i/userpic/x.jpg" }), TOKEN, NOW)
  assert.ok(ok.ok && ok.identity.photoUrl === "https://t.me/i/userpic/x.jpg")
  const js = verifyTelegramAuth(payload({ photo_url: "javascript:alert(1)" }), TOKEN, NOW)
  assert.ok(js.ok && js.identity.photoUrl === undefined)
})

test("Telegram sozlanganligi: token ham, username ham kerak", () => {
  const keep = { t: process.env.TELEGRAM_BOT_TOKEN, u: process.env.TELEGRAM_BOT_USERNAME, n: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME }
  delete process.env.TELEGRAM_BOT_USERNAME; delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
  process.env.TELEGRAM_BOT_TOKEN = "1:x"
  assert.equal(telegramConfigured(), false)
  process.env.TELEGRAM_BOT_USERNAME = "@my_bot"
  assert.equal(telegramConfigured(), true)
  delete process.env.TELEGRAM_BOT_TOKEN
  assert.equal(telegramConfigured(), false)
  for (const [k, v] of [["TELEGRAM_BOT_TOKEN", keep.t], ["TELEGRAM_BOT_USERNAME", keep.u], ["NEXT_PUBLIC_TELEGRAM_BOT_USERNAME", keep.n]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
})
