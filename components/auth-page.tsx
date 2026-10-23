"use client"
import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { CalendarDays, Check, Eye, EyeOff, Flame, Loader2, MailCheck, Trophy, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { User } from "@/types/user"
import { passwordProblems } from "@/lib/password-rules"
import { deviceTimezone } from "@/lib/client-api"
import { cn } from "@/lib/utils"

type Mode = "login" | "register" | "forgot" | "reset"
type Errors = Partial<Record<"name" | "email" | "password" | "confirm" | "form", string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function PasswordField({ id, label, value, onChange, error, autoComplete, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string; hint?: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} className="pr-11 h-11" />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"} aria-pressed={show}
          className="absolute right-1 top-1/2 -translate-y-1/2 size-9 rounded-md text-muted-foreground hover:text-foreground flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {hint}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function AuthPage({ onLogin }: { onLogin: (user: User) => void }) {
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<Mode>("login")
  const [name, setName] = useState(""); const [email, setEmail] = useState("")
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [resetEnabled, setResetEnabled] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/auth/config").then((r) => r.json()).then((c) => setResetEnabled(!!c.passwordReset)).catch(() => {})
    const t = new URLSearchParams(window.location.search).get("reset")
    if (t && /^[a-f0-9]{64}$/.test(t)) { setResetToken(t); setMode("reset") }
  }, [])

  const switchMode = (m: Mode) => { setMode(m); setErrors({}); setInfo(null); setPassword(""); setConfirm("") }
  const problems = passwordProblems(password)

  function validate(): Errors {
    const e: Errors = {}
    if (mode === "register" && !name.trim()) e.name = "Ismingizni kiriting"
    if (mode !== "reset" && !EMAIL_RE.test(email.trim())) e.email = "To'g'ri email kiriting"
    if (mode === "login" && !password) e.password = "Parolni kiriting"
    if ((mode === "register" || mode === "reset") && problems.length) e.password = `Parol: ${problems.join(", ").toLowerCase()}`
    if ((mode === "register" || mode === "reset") && confirm !== password) e.confirm = "Parollar mos kelmadi"
    return e
  }

  async function post(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  async function login() {
    const { res, data } = await post("/api/auth/login", { email: email.trim(), password })
    if (!res.ok) {
      const msg = res.status === 429 ? data.error : res.status === 503 ? "Server bilan bog'lanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring." : res.status === 403 ? "Bu akkaunt bloklangan." : "Email yoki parol noto'g'ri."
      setErrors({ form: msg }); return
    }
    onLogin(data as User)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = validate(); setErrors(v); setInfo(null)
    if (Object.keys(v).length) return
    setLoading(true)
    try {
      if (mode === "login") await login()
      else if (mode === "register") {
        const { res, data } = await post("/api/users", { name: name.trim(), email: email.trim(), password, timezone: deviceTimezone() })
        if (!res.ok) { setErrors(res.status === 409 ? { email: "Bu email allaqachon ro'yxatdan o'tgan" } : { form: data.error || "Ro'yxatdan o'tib bo'lmadi" }); return }
        await login()
      } else if (mode === "forgot") {
        const { res, data } = await post("/api/auth/forgot", { email: email.trim() })
        if (res.status === 501) setErrors({ form: "Parolni tiklash bu serverda sozlanmagan." }); else setInfo(data.message || "Havola yuborildi.")
      } else if (mode === "reset" && resetToken) {
        const { res, data } = await post("/api/auth/reset", { token: resetToken, password })
        if (!res.ok) { setErrors({ form: data.error || "Parolni yangilab bo'lmadi" }); return }
        window.history.replaceState(null, "", window.location.pathname)
        switchMode("login"); setInfo("Parol yangilandi. Endi yangi parol bilan kiring.")
      }
    } catch {
      setErrors({ form: "Tarmoq xatosi. Internetni tekshirib qayta urinib ko'ring." })
    } finally { setLoading(false) }
  }

  const title = { login: "Qaytganingiz bilan", register: "Hisob yarating", forgot: "Parolni tiklash", reset: "Yangi parol o'rnating" }[mode]
  const submitLabel = { login: "Kirish", register: "Ro'yxatdan o'tish", forgot: "Havola yuborish", reset: "Parolni saqlash" }[mode]
  const Perk = ({ icon: Icon, title: t, text }: { icon: typeof Zap; title: string; text: string }) => (
    <li className="flex gap-3"><span className="mt-0.5 size-9 shrink-0 rounded-lg bg-primary/15 text-primary flex items-center justify-center"><Icon className="size-4" /></span><div><p className="font-medium">{t}</p><p className="text-sm text-muted-foreground">{text}</p></div></li>)

  return (
    <div className="min-h-dvh app-backdrop lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="hidden lg:flex flex-col justify-between border-r border-border bg-sidebar/60 p-12">
        <div className="flex items-center gap-2"><span className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Zap className="size-5" /></span><span className="text-lg font-semibold">Just Habits</span></div>
        <div className="max-w-md space-y-8">
          <div><h1 className="text-4xl font-semibold tracking-tight leading-tight">Kichik kunlik qadamlar, katta natija.</h1>
            <p className="mt-3 text-muted-foreground">Odatlaringizni kuzating, haftangizni rejalashtiring va o'sishingizni aniq raqamlarda ko'ring.</p></div>
          <ul className="space-y-5">
            <Perk icon={Flame} title="Odatlar va seriya" text="Har kun belgilang, seriyangizni uzmang." />
            <Perk icon={CalendarDays} title="Haftalik reja" text="Vazifalarni kunlarga bo'lib, vaqti kelganda bajaring." />
            <Perk icon={Trophy} title="Chelenglar va reyting" text="Maqsadlar qo'ying va eng faollar qatoriga kiring." />
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Ma'lumotlaringiz sizniki. Parollar xavfsiz xeshlanadi.</p>
      </aside>

      <main className="flex min-h-dvh items-center justify-center px-4 py-10" style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>
        <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="w-full max-w-[400px]">
          <div className="lg:hidden mb-6 flex items-center gap-2"><span className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Zap className="size-5" /></span><span className="text-lg font-semibold">Just Habits</span></div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" && "Hisobingizga kiring va bugungi rejangizni davom ettiring."}
            {mode === "register" && "Odatlaringizni kuzatishni bugun boshlang. Bepul."}
            {mode === "forgot" && "Emailingizni kiriting — tiklash havolasini yuboramiz."}
            {mode === "reset" && "Yangi parolni kiriting va tasdiqlang."}
          </p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            {info && <div role="status" className="flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"><MailCheck className="size-4 mt-0.5 shrink-0" />{info}</div>}
            {errors.form && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{errors.form}</div>}

            {mode === "register" && (
              <div className="space-y-1.5"><Label htmlFor="name">Ism</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} aria-invalid={!!errors.name} className="h-11" />
                {errors.name && <p role="alert" className="text-xs text-destructive">{errors.name}</p>}</div>)}
            {mode !== "reset" && (
              <div className="space-y-1.5"><Label htmlFor="email">Email</Label>
                <Input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!errors.email} className="h-11" />
                {errors.email && <p role="alert" className="text-xs text-destructive">{errors.email}</p>}</div>)}
            {mode !== "forgot" && (
              <PasswordField id="password" label={mode === "reset" ? "Yangi parol" : "Parol"} value={password} onChange={setPassword} error={errors.password}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                hint={(mode === "register" || mode === "reset") && (
                  <ul className="space-y-0.5 pt-1 text-xs" aria-label="Parol talablari">
                    {[["Kamida 8 ta belgi", password.length >= 8], ["Harf va raqam", /[A-Za-z]/.test(password) && /\d/.test(password)]].map(([t, ok]) => (
                      <li key={String(t)} className={cn("flex items-center gap-1.5", ok ? "text-emerald-400" : "text-muted-foreground")}><Check className={cn("size-3", !ok && "opacity-30")} />{t as string}</li>))}
                  </ul>)} />)}
            {(mode === "register" || mode === "reset") && <PasswordField id="confirm" label="Parolni tasdiqlang" value={confirm} onChange={setConfirm} error={errors.confirm} autoComplete="new-password" />}

            {mode === "login" && resetEnabled && <div className="text-right -mt-1"><button type="button" onClick={() => switchMode("forgot")} className="text-sm text-primary hover:underline">Parolni unutdingizmi?</button></div>}

            <Button type="submit" size="lg" className="w-full h-11" disabled={loading}>{loading && <Loader2 className="animate-spin" />}{loading ? "Iltimos, kuting…" : submitLabel}</Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? <>Hisobingiz yo'qmi? <button onClick={() => switchMode("register")} className="text-primary hover:underline font-medium">Ro'yxatdan o'ting</button></>
              : <>{mode === "register" ? "Hisobingiz bormi? " : ""}<button onClick={() => switchMode("login")} className="text-primary hover:underline font-medium">{mode === "register" ? "Kirish" : "Kirishga qaytish"}</button></>}
          </p>
        </motion.div>
      </main>
    </div>
  )
}
