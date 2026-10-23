/**
 * Sana yordamchilari. Barcha "kun" tushunchalari foydalanuvchi vaqt zonasidagi
 * kalendar kuni (YYYY-MM-DD kaliti) bo'yicha ishlaydi - 24 soatlik bo'laklar
 * bo'yicha emas. Kalit arifmetikasi UTC orqali bajariladi, shuning uchun DST
 * va mahalliy soat o'zgarishlari natijani buzmaydi.
 */

export const DEFAULT_TIMEZONE = "Asia/Tashkent"

export type DateKey = string // "YYYY-MM-DD"

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function resolveTimezone(tz?: string | null): string {
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE
}

export function isValidDateKey(key: unknown): key is DateKey {
  if (typeof key !== "string") return false
  const m = KEY_RE.exec(key)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/** Berilgan vaqt belgisi (ms) foydalanuvchi vaqt zonasida qaysi kalendar kuniga tushishi. */
export function dateKeyFromTimestamp(ms: number, tz: string = DEFAULT_TIMEZONE): DateKey {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimezone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms))
}

export function todayKey(tz: string = DEFAULT_TIMEZONE, now: number = Date.now()): DateKey {
  return dateKeyFromTimestamp(now, tz)
}

function toUtc(key: DateKey): number {
  const m = KEY_RE.exec(key)
  if (!m) throw new Error(`Noto'g'ri sana kaliti: ${key}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function fromUtc(ms: number): DateKey {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

export function addDays(key: DateKey, n: number): DateKey {
  return fromUtc(toUtc(key) + n * 86_400_000)
}

/** a dan b gacha necha kalendar kuni (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

/** 0 = Dushanba ... 6 = Yakshanba */
export function weekdayIndex(key: DateKey): number {
  return (new Date(toUtc(key)).getUTCDay() + 6) % 7
}

export function weekStart(key: DateKey): DateKey {
  return addDays(key, -weekdayIndex(key))
}

export function weekDays(key: DateKey): DateKey[] {
  const start = weekStart(key)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function monthStart(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`
}

export function monthEnd(key: DateKey): DateKey {
  const [y, m] = key.split("-").map(Number)
  return fromUtc(Date.UTC(y, m, 0))
}

export function rangeKeys(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = []
  const n = diffDays(from, to)
  for (let i = 0; i <= n; i++) out.push(addDays(from, i))
  return out
}

/** "2026-10-22" + "14:30" + tz -> UTC ms. DST chegaralarida eng yaqin haqiqiy vaqtga to'g'rilanadi. */
export function zonedTimeToUtc(key: DateKey, hhmm: string, tz: string = DEFAULT_TIMEZONE): number {
  const [h, mi] = hhmm.split(":").map(Number)
  const [y, mo, d] = key.split("-").map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const zone = resolveTimezone(tz)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  })
  const asZoned = (ms: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  }
  let utc = guess - (asZoned(guess) - guess)
  utc = utc - (asZoned(utc) - guess)
  return utc
}
