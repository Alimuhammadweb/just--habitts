import { test } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { verifyTelegramInitData, telegramConfigured, encodeLinkParam, decodeLinkParam, telegramLaunchUrl, telegramInitDataMaxAge } from "../lib/server/telegram"

// initData'ni spetsifikatsiya bo'yicha (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app) alohida, mustaqil usulda imzolaymiz
const TOKEN = "123456:TEST-bot-token"
const NOW = 1_800_000_000_000
const sec = (offset = 0) => Math.floor(NOW / 1000) + offset

function build(fields: Record<string, string>, token = TOKEN, tamper?: (p: URLSearchParams) => void) {
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n")
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest()
  const hash = createHmac("sha256", secretKey).update(check).digest("hex")
  const p = new URLSearchParams({ ...fields, hash })
  tamper?.(p)
  return p.toString()
}
const user = (over: Record<string, unknown> = {}) => JSON.stringify({ id: 777000, first_name: "Ali", last_name: "Valiyev", username: "ali_v", language_code: "uz", photo_url: "https://t.me/i/userpic/320/x.jpg", allows_write_to_pm: true, ...over })
const init = (over: Record<string, string> = {}, token = TOKEN) => build({ query_id: "AAH123", user: user(), auth_date: String(sec(-5)), signature: "sig-from-telegram", ...over }, token)

test("to'g'ri imzolangan initData qabul qilinadi va barcha maydonlar olinadi", () => {
  const r = verifyTelegramInitData(init(), TOKEN, NOW)
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.identity.id, 777000); assert.equal(r.identity.name, "Ali Valiyev")
    assert.equal(r.identity.firstName, "Ali"); assert.equal(r.identity.lastName, "Valiyev"); assert.equal(r.identity.username, "ali_v")
    assert.equal(r.identity.languageCode, "uz"); assert.equal(r.identity.photoUrl, "https://t.me/i/userpic/320/x.jpg")
  }
})

test("username, familiya, rasm, til bo'lmasa ham ishlaydi (taxmin qilinmaydi)", () => {
  const only = verifyTelegramInitData(init({ user: JSON.stringify({ id: 5, first_name: "Vali" }) }), TOKEN, NOW)
  assert.ok(only.ok && only.identity.name === "Vali")
  if (only.ok) assert.deepEqual(Object.keys(only.identity).sort(), ["firstName", "id", "name"])
  const usernameOnly = verifyTelegramInitData(init({ user: JSON.stringify({ id: 5, first_name: "", username: "vv" }) }), TOKEN, NOW)
  assert.ok(usernameOnly.ok && usernameOnly.identity.name === "vv")
  const nothing = verifyTelegramInitData(init({ user: JSON.stringify({ id: 5 }) }), TOKEN, NOW)
  assert.ok(nothing.ok && nothing.identity.name === "Telegram foydalanuvchi")
})

test("signature maydoni ham data_check_string ga kiradi (faqat hash chiqariladi)", () => {
  // signature'siz imzolangan, lekin signature qo'shilgan satr — rad etilishi kerak
  const good = init()
  const p = new URLSearchParams(good); p.delete("signature")
  assert.deepEqual(verifyTelegramInitData(p.toString(), TOKEN, NOW), { ok: false, reason: "bad_signature" })
})

test("o'zgartirilgan maydon (user.id / ism / auth_date) imzoni buzadi", () => {
  const evil = init({}, TOKEN)
  const swap = (key: string, value: string) => { const p = new URLSearchParams(evil); p.set(key, value); return p.toString() }
  assert.deepEqual(verifyTelegramInitData(swap("user", user({ id: 1 })), TOKEN, NOW), { ok: false, reason: "bad_signature" })
  assert.deepEqual(verifyTelegramInitData(swap("user", user({ first_name: "Hacker" })), TOKEN, NOW), { ok: false, reason: "bad_signature" })
  assert.deepEqual(verifyTelegramInitData(swap("auth_date", String(sec(0))), TOKEN, NOW), { ok: false, reason: "bad_signature" })
})

test("qo'shimcha (imzolanmagan) maydon qo'shilsa rad etiladi", () => {
  assert.deepEqual(verifyTelegramInitData(init() + "&is_admin=true", TOKEN, NOW), { ok: false, reason: "bad_signature" })
})

test("boshqa bot tokeni bilan imzolangan initData rad etiladi", () => {
  assert.deepEqual(verifyTelegramInitData(init({}, "999:OTHER"), TOKEN, NOW), { ok: false, reason: "bad_signature" })
})

test("Login Widget usulida (SHA256(token)) imzolangan ma'lumot Mini App sifatida qabul qilinmaydi", () => {
  const fields = { user: user(), auth_date: String(sec(-5)) }
  const check = Object.keys(fields).sort().map((k) => `${k}=${(fields as Record<string, string>)[k]}`).join("\n")
  // noto'g'ri kalit hosil qilish usuli: HMAC kaliti sifatida to'g'ridan-to'g'ri token
  const wrongHash = createHmac("sha256", TOKEN).update(check).digest("hex")
  assert.deepEqual(verifyTelegramInitData(new URLSearchParams({ ...fields, hash: wrongHash }).toString(), TOKEN, NOW), { ok: false, reason: "bad_signature" })
})

test("eskirgan va kelajakdagi auth_date rad etiladi; muddat sozlanadi", () => {
  assert.deepEqual(verifyTelegramInitData(init({ auth_date: String(sec(-90_000)) }), TOKEN, NOW), { ok: false, reason: "expired" }) // > 24 soat
  assert.deepEqual(verifyTelegramInitData(init({ auth_date: String(sec(3600)) }), TOKEN, NOW), { ok: false, reason: "expired" })
  assert.ok(verifyTelegramInitData(init({ auth_date: String(sec(-80_000)) }), TOKEN, NOW).ok) // < 24 soat
  assert.deepEqual(verifyTelegramInitData(init({ auth_date: String(sec(-120)) }), TOKEN, NOW, 60), { ok: false, reason: "expired" })
  const keep = process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS
  process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS = "3600"; assert.equal(telegramInitDataMaxAge(), 3600)
  process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS = "5"; assert.equal(telegramInitDataMaxAge(), 86400) // juda kichik qiymat e'tiborsiz
  if (keep === undefined) delete process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS; else process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS = keep
})

test("hash yo'q / noto'g'ri / initData bo'sh yoki noto'g'ri turda bo'lsa 'bad_request'", () => {
  const p = new URLSearchParams(init()); p.delete("hash")
  const badHash = new URLSearchParams(init()); badHash.set("hash", "xyz")
  const dup = init() + "&query_id=AAH999"
  for (const bad of [p.toString(), badHash.toString(), dup, "", null, undefined, 42, {}, [], "x".repeat(9000)]) {
    const r = verifyTelegramInitData(bad, TOKEN, NOW)
    assert.ok(!r.ok && r.reason === "bad_request", JSON.stringify(String(bad).slice(0, 40)))
  }
  assert.deepEqual(verifyTelegramInitData(init(), "", NOW), { ok: false, reason: "bad_request" }) // token sozlanmagan
})

test("imzo to'g'ri bo'lsa ham user shakli noto'g'ri bo'lsa rad etiladi (id, bot, JSON)", () => {
  for (const u of [JSON.stringify({ id: -5 }), JSON.stringify({ id: 1.5 }), JSON.stringify({ id: "7" }), JSON.stringify({ id: 9, is_bot: true }), "not json", "[]", "null"]) {
    const r = verifyTelegramInitData(init({ user: u }), TOKEN, NOW)
    assert.ok(!r.ok && r.reason === "bad_request", u)
  }
  const noUser = build({ auth_date: String(sec(-5)) })
  assert.ok(!verifyTelegramInitData(noUser, TOKEN, NOW).ok)
})

test("photo_url faqat https; username/til shakli tekshiriladi", () => {
  const js = verifyTelegramInitData(init({ user: user({ photo_url: "javascript:alert(1)", username: "bad name!", language_code: "<x>" }) }), TOKEN, NOW)
  assert.ok(js.ok && js.identity.photoUrl === undefined && js.identity.username === undefined && js.identity.languageCode === undefined)
})

test("start_param: faqat xavfsiz belgilar", () => {
  const r = verifyTelegramInitData(init({ start_param: "l_abc-DEF_123" }), TOKEN, NOW)
  assert.ok(r.ok && r.startParam === "l_abc-DEF_123")
  const bad = verifyTelegramInitData(init({ start_param: "a b;<script>" }), TOKEN, NOW)
  assert.ok(bad.ok && bad.startParam === undefined)
})

test("ulash parametri: JWT base64url ga o'raladi va faqat ruxsat etilgan belgilar ishlatiladi", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjEsImp0aSI6IngifQ.c2lnbmF0dXJl"
  const p = encodeLinkParam(jwt)
  assert.match(p, /^l_[A-Za-z0-9_-]+$/); assert.ok(p.length <= 512)
  assert.equal(decodeLinkParam(p), jwt)
  for (const bad of [undefined, "", "x_abc", "l_", "l_a.b", "l_a b"]) assert.equal(decodeLinkParam(bad as string | undefined), null)
})

test("Mini App havolasi: asosiy Mini App yoki short name bilan", () => {
  const keep = { u: process.env.TELEGRAM_BOT_USERNAME, s: process.env.TELEGRAM_MINIAPP_SHORT_NAME, n: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME }
  delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME; process.env.TELEGRAM_BOT_USERNAME = "@my_bot"; delete process.env.TELEGRAM_MINIAPP_SHORT_NAME
  assert.equal(telegramLaunchUrl(), "https://t.me/my_bot"); assert.equal(telegramLaunchUrl("l_x"), "https://t.me/my_bot?startapp=l_x")
  process.env.TELEGRAM_MINIAPP_SHORT_NAME = "habits"
  assert.equal(telegramLaunchUrl("l_x"), "https://t.me/my_bot/habits?startapp=l_x")
  for (const [k, v] of [["TELEGRAM_BOT_USERNAME", keep.u], ["TELEGRAM_MINIAPP_SHORT_NAME", keep.s], ["NEXT_PUBLIC_TELEGRAM_BOT_USERNAME", keep.n]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
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
