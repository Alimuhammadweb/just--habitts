"use client"

import { useEffect, useRef } from "react"

export type TelegramAuthPayload = Record<string, string | number>

/**
 * Telegram Login Widget (rasmiy tugma). Skript telegram.org dan yuklanadi va tugma ichida iframe ochadi.
 * Foydalanuvchi tasdiqlagach Telegram imzolangan ma'lumotni `onAuth` ga beradi — uni SERVERga yuborib tekshirish SHART.
 * Eslatma: tugma faqat BotFather'da /setdomain qilingan https domenda ishlaydi (localhost'da emas).
 */
export function TelegramLoginButton({ botUsername, onAuth }: { botUsername: string; onAuth: (data: TelegramAuthPayload) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const handler = useRef(onAuth)
  handler.current = onAuth

  useEffect(() => {
    const el = box.current
    if (!el || !botUsername) return
    const fn = `__tgAuth_${Math.random().toString(36).slice(2)}`
    ;(window as unknown as Record<string, unknown>)[fn] = (u: TelegramAuthPayload) => handler.current(u)
    const s = document.createElement("script")
    s.src = "https://telegram.org/js/telegram-widget.js?22"
    s.async = true
    s.setAttribute("data-telegram-login", botUsername)
    s.setAttribute("data-size", "large")
    s.setAttribute("data-radius", "8")
    s.setAttribute("data-userpic", "false")
    s.setAttribute("data-onauth", `${fn}(user)`)
    el.innerHTML = ""
    el.appendChild(s)
    return () => { delete (window as unknown as Record<string, unknown>)[fn]; el.innerHTML = "" }
  }, [botUsername])

  return <div ref={box} className="flex min-h-[44px] items-center justify-center" aria-label="Telegram bilan kirish" />
}
