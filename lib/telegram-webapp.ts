"use client"

// Telegram Mini App (Web Apps API): https://core.telegram.org/bots/webapps
// Bu fayl faqat brauzerda ishlaydi. Bu yerdagi hech narsa "isbot" emas — mijoz faqat XOM initData'ni serverga uzatadi,
// serverda esa imzo bot tokeni bilan tekshiriladi (lib/server/telegram.ts).

interface TelegramWebAppUser { id?: number; language_code?: string }
export interface TelegramWebApp {
  initData: string
  initDataUnsafe?: { user?: TelegramWebAppUser }
  ready: () => void
  expand: () => void
  close: () => void
}
declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }

export const getTelegramWebApp = (): TelegramWebApp | null =>
  typeof window === "undefined" ? null : window.Telegram?.WebApp ?? null

/**
 * Xom initData'ni topadi (Mini App'dan tashqarida bo'sh satr).
 * 1) SDK: Telegram.WebApp.initData  2) ishga tushirish havolasi (#tgWebAppData=…)  3) SDK sessionStorage'da saqlagan nusxa (sahifa yangilanganda).
 */
export function readTelegramInitData(): string {
  if (typeof window === "undefined") return ""
  const fromSdk = getTelegramWebApp()?.initData
  if (fromSdk) return fromSdk
  try {
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("tgWebAppData")
    if (fromHash) return fromHash
  } catch { /* e'tiborsiz */ }
  try {
    const saved = window.sessionStorage.getItem("__telegram__initParams")
    if (saved) {
      const v = (JSON.parse(saved) as Record<string, unknown>).tgWebAppData
      if (typeof v === "string" && v) return v
    }
  } catch { /* e'tiborsiz */ }
  return ""
}

/** Faqat INTERFEYS tili uchun (autentifikatsiya uchun emas): Telegram til kodini ilova tiliga moslaydi. */
export function telegramUiLanguage(): "uz" | "ru" | "en" | null {
  const code = getTelegramWebApp()?.initDataUnsafe?.user?.language_code?.toLowerCase().slice(0, 2)
  return code === "uz" || code === "ru" || code === "en" ? code : null
}
