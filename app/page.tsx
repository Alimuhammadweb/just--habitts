"use client"

import { useState, useEffect } from "react"
import { AuthPage } from "@/components/auth-page"
import { MainApp } from "@/components/main-app"
import type { User } from "@/types/user"
import { authFetch } from "@/lib/api-client"
import { TelegramAuthScreen, type TelegramScreenState } from "@/components/telegram-auth-screen"
import { getTelegramWebApp, readTelegramInitData, telegramUiLanguage } from "@/lib/telegram-webapp"
import type { Language } from "@/types/language"

const AUTH_ERRORS: Record<string, string> = {
  google_unavailable: "Google bilan kirish bu serverda sozlanmagan.",
  google_denied: "Google orqali kirish bekor qilindi.",
  google_state: "Kirish sessiyasi eskirgan. Qaytadan urinib ko'ring.",
  google_failed: "Google bilan kirib bo'lmadi. Qayta urinib ko'ring.",
  google_email_unverified: "Google emailingiz tasdiqlanmagan, shu sababli kirish mumkin emas.",
  google_link_required: "Bu email bilan hisob allaqachon mavjud. Avval parol bilan kiring, so'ng Profil sahifasidan Google'ni ulang.",
  google_in_use: "Bu Google hisobi boshqa foydalanuvchiga ulangan.",
  google_already_linked: "Sizning hisobingizga boshqa Google hisobi ulangan.",
  blocked: "Bu akkaunt bloklangan.",
  rate_limited: "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring.",
  server: "Server xatosi. Keyinroq qayta urinib ko'ring.",
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Telegram Mini App ichida ochilganmi va avtorizatsiya holati (xato / ulashni tasdiqlash / chiqib ketgan)
  const [inTelegram, setInTelegram] = useState(false)
  const [tgScreen, setTgScreen] = useState<TelegramScreenState | null>(null)
  const [tgBusy, setTgBusy] = useState(false)

  const tgLanguage = (): Language => {
    try { const s = localStorage.getItem("habit-language"); if (s === "uz" || s === "ru" || s === "en") return s } catch { /* e'tiborsiz */ }
    return telegramUiLanguage() ?? "uz"
  }

  // Telegram Mini App: XOM initData serverga yuboriladi, imzo serverda tekshiriladi (bot tokeni bilan). Mijoz hech qachon
  // "men falonchiman" deya ayta olmaydi — initDataUnsafe/id/ism yuborilmaydi. Muvaffaqiyatli bo'lsa server HttpOnly cookie qo'yadi.
  async function telegramSignIn(confirmLink = false): Promise<void> {
    const initData = readTelegramInitData()
    if (!initData) { setTgScreen({ kind: "error", message: "Telegram ma'lumotlari topilmadi. Ilovani Telegram'dagi bot orqali oching.", code: "NO_INIT_DATA" }); return }
    setTgBusy(true)
    try {
      const res = await fetch("/api/auth/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, confirmLink }), cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.linkRequest) { setTgScreen({ kind: "confirmLink", ...data.linkRequest }); return }
      if (res.ok) {
        // Sessiya cookie'si haqiqatan saqlandimi? (ba'zi WebView'lar cookie'ni bloklaydi — aks holda keyingi so'rovlar jimgina 401 beradi)
        const probe = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null)
        if (!probe || !probe.ok) { setTgScreen({ kind: "error", message: `Kirish tasdiqlandi, lekin sessiya cookie'si saqlanmadi [${probe?.status ?? "tarmoq"}]. Telegram'ni yangilab qayta urinib ko'ring.`, code: "COOKIES_BLOCKED" }); return }
        try { sessionStorage.removeItem("tgSignedOut") } catch { /* e'tiborsiz */ }
        // Yangi foydalanuvchi uchun interfeys tili Telegram tilidan (faqat ko'rinish; autentifikatsiyaga aloqasi yo'q)
        try { if (!localStorage.getItem("habit-language")) { const l = telegramUiLanguage(); if (l) localStorage.setItem("habit-language", l) } } catch { /* e'tiborsiz */ }
        setTgScreen(null)
        handleSetUser(migrateUserData(data as User))
        if ((data as User).isAdmin) location.assign("/admin")
        return
      }
      setTgScreen({ kind: "error", message: `${data?.error || "Xato"} [${res.status}${data?.code ? " " + data.code : ""}]`, code: data?.code })
    } catch {
      setTgScreen({ kind: "error", message: "Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.", code: "NETWORK" })
    } finally { setTgBusy(false) }
  }

  useEffect(() => {
    // localStorage'da faqat foydalanuvchi ID'si saqlanadi (kim tizimga kirgan).
    // Sahifa ochilganda/yangilanganda haqiqiy ma'lumot HAR DOIM ma'lumotlar bazasidan (PostgreSQL)
    // qayta olinadi - shunda ma'lumot doim bazadagi eng so'nggi holatga mos keladi
    // va eskirgan/buzilgan localStorage nusxasi sessiyani buzmaydi.
    async function restoreSession() {
      try {
        // Telegram Mini App ichida bo'lsak, sessiya HAR DOIM Telegram imzosi bilan aniqlanadi (cookie/localStorage'dagi eski
        // foydalanuvchiga ishonilmaydi) — shu qurilmada boshqa Telegram akkaunt ochsa ham bir-birining ma'lumotini ko'rmaydi.
        if (readTelegramInitData()) {
          setInTelegram(true)
          try { const tg = getTelegramWebApp(); tg?.ready(); tg?.expand() } catch { /* e'tiborsiz */ }
          let signedOut = false
          try { signedOut = sessionStorage.getItem("tgSignedOut") === "1" } catch { /* e'tiborsiz */ }
          if (signedOut) setTgScreen({ kind: "signedOut" })
          else await telegramSignIn(false)
          return
        }

        let userId = localStorage.getItem("sessionUserId")

        // Eski versiyada butun user obyekti sessionStorage/localStorage'da
        // saqlangan bo'lishi mumkin - shundan ID'ni chiqarib olib, migratsiya qilamiz.
        if (!userId) {
          const legacyRaw = localStorage.getItem("sessionUser") || sessionStorage.getItem("sessionUser")
          if (legacyRaw) {
            try {
              const legacyUser = JSON.parse(legacyRaw)
              if (legacyUser?.id !== undefined && legacyUser?.id !== null) {
                userId = String(legacyUser.id)
              }
            } catch {
              // buzilgan eski ma'lumot - e'tiborsiz qoldiramiz
            }
          }
        }

        // Google bilan kirilganda brauzerda id saqlanmagan bo'ladi — sessiya cookie'si orqali serverdan so'raymiz.
        // Faqat Google callback'idan qaytganda (?signed_in=google): oddiy tashrifda /api/auth/me chaqirilmaydi,
        // aks holda sessiyasiz foydalanuvchi har safar 401 TOKEN_EXPIRED oladi.
        const params = new URLSearchParams(location.search)
        const cameFromGoogle = params.get("signed_in") === "google"
        if (!userId && cameFromGoogle) {
          const me = await authFetch("/api/auth/me", { cache: "no-store" })
          if (me.ok) {
            const u = await me.json()
            userId = String(u.id)
            if (u.id === 0) localStorage.setItem("sessionAdmin", JSON.stringify(u))
            localStorage.setItem("sessionUserId", userId)
          } else {
            setAuthNotice("Google tasdiqladi, lekin brauzer sessiya cookie'sini saqlamadi. Cookie'lar yoqilganini tekshiring (lokal: http://localhost manzilida oching) va qayta urinib ko'ring.")
          }
        }

        if (userId === "0") {
          // Admin akkaunt bazada saqlanmaydi (login paytida .env dan hosil bo'ladi),
          // shuning uchun uni alohida kalitdan tiklaymiz.
          const adminRaw = localStorage.getItem("sessionAdmin")
          if (adminRaw) {
            setCurrentUser(migrateUserData(JSON.parse(adminRaw)))
          } else {
            localStorage.removeItem("sessionUserId")
          }
        } else if (userId) {
          const res = await authFetch(`/api/users/${userId}`, { cache: "no-store" })
          if (res.ok) {
            const freshUser = await res.json()
            // Admin sessiya muddati tugab /admin'dan qaytarilgan bo'lsa, token yangilangach admin panelga qaytaramiz
            if (params.get("admin") === "1" && freshUser.isAdmin) { location.replace("/admin"); return }
            setCurrentUser(migrateUserData(freshUser))
            localStorage.setItem("sessionUserId", String(freshUser.id))
          } else {
            // Foydalanuvchi bazada topilmadi yoki bloklangan - sessiyani tozalaymiz
            localStorage.removeItem("sessionUserId")
          }
        }
      } catch (err) {
        console.error("Sessiyani tiklashda xato:", err)
        setAuthNotice("Server bilan bog'lanib bo'lmadi. Internet yoki serverni tekshirib, sahifani yangilang.")
        // Tarmoq xatosi bo'lsa ham foydalanuvchini majburan chiqarib yubormaymiz -
        // shunchaki keyingi safar qayta urinib ko'radi.
      } finally {
        // Google'dan qaytgandagi xato/ulanish xabarlari (?auth_error=… / ?google=linked)
        const sp = new URLSearchParams(location.search)
        const ae = sp.get("auth_error")
        if (ae) setAuthNotice(AUTH_ERRORS[ae] ?? "Google bilan kirib bo'lmadi. Qayta urinib ko'ring.")
        if (ae || sp.has("admin") || sp.has("signed_in")) history.replaceState(null, "", location.pathname + location.hash)
        localStorage.removeItem("sessionUser")
        sessionStorage.removeItem("sessionUser")
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  const handleSetUser = (user: User) => {
    setCurrentUser(user)
    setAuthNotice(null)

    if (user.id === 0) {
      // Admin akkaunt bazada yo'q - alohida kalitda saqlaymiz, DB'ga yozmaymiz
      try {
        localStorage.setItem("sessionUserId", "0")
        localStorage.setItem("sessionAdmin", JSON.stringify(user))
      } catch (err) {
        console.error("Sessiyani saqlashda xato:", err)
      }
      return
    }

    try {
      localStorage.setItem("sessionUserId", String(user.id))
    } catch (err) {
      console.error("Sessiyani saqlashda xato:", err)
    }
    // Eslatma: ma'lumotni serverga butun obyekt sifatida YOZMAYMIZ. XP, odatlar va chelenjlar
    // faqat maxsus server endpointlari orqali o'zgaradi.
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem("sessionUserId")
    localStorage.removeItem("sessionAdmin")
    localStorage.removeItem("sessionUser")
    sessionStorage.removeItem("sessionUser")
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    // Mini App ichida chiqsak, qayta yuklanganda darhol avtomatik kirib ketmasligi uchun belgi qo'yamiz
    if (readTelegramInitData()) {
      try { sessionStorage.setItem("tgSignedOut", "1") } catch { /* e'tiborsiz */ }
      setTgScreen({ kind: "signedOut" })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">{inTelegram ? "Telegram orqali kirilmoqda..." : "Just Habits yuklanmoqda..."}</p>
      </div>
    )
  }

  if (currentUser) {
    return (
      <MainApp
        currentUser={currentUser}
        setCurrentUser={handleSetUser}
        onLogout={handleLogout}
      />
    )
  }

  if (tgScreen) {
    return (
      <TelegramAuthScreen state={tgScreen} language={tgLanguage()} busy={tgBusy}
        onRetry={() => { void telegramSignIn(false) }}
        onConfirm={() => { void telegramSignIn(true) }}
        onCancel={() => { try { getTelegramWebApp()?.close() } catch { /* e'tiborsiz */ } }}
        onSignIn={() => { try { sessionStorage.removeItem("tgSignedOut") } catch { /* e'tiborsiz */ } void telegramSignIn(false) }}
        onClose={() => { try { getTelegramWebApp()?.close() } catch { /* e'tiborsiz */ } }} />
    )
  }

  return (
    <AuthPage
      notice={authNotice}
      onLogin={(user) => {
        handleSetUser(migrateUserData(user))
        // Administrator kirgach foydalanuvchi ilovasiga emas, o'zining boshqaruv paneliga tushadi
        if (user.isAdmin) location.assign("/admin")
      }}
    />
  )
}

function migrateUserData(user: User): User {
  const u = { ...user }
  if (!u.xpData) u.xpData = { totalXP: 0, level: 1, rank: null, weeklyXP: 0, monthlyXP: 0, xpHistory: [], currentXP: 0, lastUpdated: Date.now() }
  if (!u.pomodoroData) u.pomodoroData = { sessions: [], totalPomodoros: 0 }
  if (u.publicProfile === undefined) u.publicProfile = false
  if (!u.completedTasks) u.completedTasks = []
  if (!u.unlockedAvatars) u.unlockedAvatars = []
  if (!u.unlockedThemes) u.unlockedThemes = []
  if (!u.unlockedBadges) u.unlockedBadges = []
  if (!u.unlockedBorders) u.unlockedBorders = []
  if (!u.unlockedFrames) u.unlockedFrames = []
  if (!u.unlockedBackgrounds) u.unlockedBackgrounds = []
  if (u.streakFreezes === undefined) u.streakFreezes = 1
  if (!u.totalFreezesUsed) u.totalFreezesUsed = 0
  if (!u.friends) u.friends = []
  if (!u.friendRequests) u.friendRequests = []
  if (!u.sentRequests) u.sentRequests = []
  if (!u.plannedHabits) u.plannedHabits = []
  if (u.habits) {
    u.habits = u.habits.map(h => ({
      ...h,
      dayLocks: h.dayLocks || {},
      missReasons: h.missReasons || {},
      days: h.days || {},
    }))
  }
  return u
}
