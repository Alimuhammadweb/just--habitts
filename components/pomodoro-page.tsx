"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause, RotateCcw, Calendar, Clock, Flame, Timer, Coffee, Check, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { PomodoroData } from "@/types/user"
import type { PomodoroController } from "@/hooks/use-pomodoro"
import {
  FOCUS_MIN, FOCUS_MAX, FOCUS_PRESETS, SHORT_BREAK_MIN, SHORT_BREAK_MAX, SHORT_BREAK_PRESETS,
  LONG_BREAK_MIN, LONG_BREAK_MAX, LONG_BREAK_PRESETS, LONG_EVERY_MIN, LONG_EVERY_MAX,
  type PomodoroMode, type PomodoroSettingsData,
} from "@/lib/pomodoro"
import { cn } from "@/lib/utils"

interface Props {
  pomodoro: PomodoroController
  pomodoroData?: PomodoroData
}

const MODE_LABEL: Record<PomodoroMode, string> = { focus: "Fokus", short_break: "Qisqa tanaffus", long_break: "Uzoq tanaffus" }

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatFocusTime(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} daq`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h} soat ${r} daq` : `${h} soat`
}

/** Tayyor tanlovlar + o'z qiymatini kiritish. Qiymat serverga saqlanadi (PostgreSQL), noto'g'ri qiymat inline xato beradi. */
function DurationPicker({ label, hint, value, presets, min, max, onSave }: {
  label: string; hint: string; value: number; presets: readonly number[]; min: number; max: number
  onSave: (v: number) => Promise<void>
}) {
  const [custom, setCustom] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(v: number) {
    setError(null); setSaving(true)
    try { await onSave(v); setCustom("") }
    catch (e) { setError(e instanceof Error ? e.message : "Saqlab bo'lmadi") }
    finally { setSaving(false) }
  }
  function submitCustom() {
    const raw = custom.trim()
    const v = Number(raw)
    if (!raw || !Number.isFinite(v)) return setError("Daqiqani raqam bilan kiriting")
    if (!Number.isInteger(v)) return setError("Butun son kiriting")
    if (v < min) return setError(`Kamida ${min} daqiqa bo'lishi kerak`)
    if (v > max) return setError(`Ko'pi bilan ${max} daqiqa`)
    save(v)
  }
  const isCustomValue = !presets.includes(value)

  return (
    <div className="space-y-2.5">
      <div><Label>{label}</Label><p className="text-xs text-muted-foreground">{hint}</p></div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button key={p} size="sm" variant={value === p ? "default" : "outline"} disabled={saving} aria-pressed={value === p} onClick={() => save(p)}>
            {value === p && <Check />}{p} daq
          </Button>
        ))}
        {isCustomValue && <Button size="sm" variant="default" aria-pressed disabled><Check />{value} daq</Button>}
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1 max-w-[220px]">
          <Input type="number" inputMode="numeric" min={min} max={max} step={1} placeholder={`O'z qiymatingiz (${min}–${max})`}
            value={custom} aria-label={`${label}: o'z qiymatingiz`} aria-invalid={!!error}
            onChange={(e) => { setCustom(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === "Enter") submitCustom() }} />
        </div>
        <Button size="sm" variant="secondary" className="h-9" disabled={saving || !custom.trim()} onClick={submitCustom}>
          {saving ? <Loader2 className="animate-spin" /> : null}Saqlash
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tabular tracking-tight">{value}</div>
    </div>
  )
}

export function PomodoroPage({ pomodoro: p, pomodoroData }: Props) {
  const { toast } = useToast()
  const [showHistory, setShowHistory] = useState(false)
  const sessions = pomodoroData?.sessions ?? []
  const stats = p.state?.stats
  const isBreak = p.mode !== "focus"
  const status = !p.active ? "Tayyor" : p.running ? (isBreak ? "Tanaffus" : "Fokus davom etmoqda") : "Pauza"
  const progress = p.totalMs > 0 ? Math.min(1, Math.max(0, 1 - p.remainingMs / p.totalMs)) : 0
  const R = 108, C = 2 * Math.PI * R

  const save = (key: keyof PomodoroSettingsData) => async (v: number) => {
    await p.saveSettings({ [key]: v })
    toast({ title: "Sozlama saqlandi", description: p.active ? "Joriy taymerga ta'sir qilmaydi — keyingi ishga tushirishdan boshlab amal qiladi." : undefined })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-2xl font-semibold tracking-tight">Pomodoro</h2><p className="text-sm text-muted-foreground">Fokus seanslari bazada saqlanadi — sahifani yangilasangiz ham yo'qolmaydi.</p></div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}><Calendar />{showHistory ? "Taymer" : "Tarix"}</Button>
      </div>

      {!showHistory ? (
        <>
          {/* Rejim */}
          <div role="tablist" aria-label="Rejim" className="surface grid grid-cols-3 gap-1 p-1">
            {(["focus", "short_break", "long_break"] as PomodoroMode[]).map((m) => (
              <button key={m} role="tab" aria-selected={p.mode === m} disabled={!!p.active && p.mode !== m} onClick={() => p.selectMode(m)}
                className={cn("flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs sm:text-sm transition-colors disabled:opacity-40",
                  p.mode === m ? (m === "focus" ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300") : "text-muted-foreground hover:text-foreground")}>
                {m === "focus" ? <Timer className="size-4" /> : <Coffee className="size-4" />}{MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {/* Taymer */}
          <section className="surface flex flex-col items-center gap-5 p-6 sm:p-8">
            <div className="relative grid place-items-center">
              <svg width="248" height="248" viewBox="0 0 248 248" className="-rotate-90" aria-hidden>
                <circle cx="124" cy="124" r={R} fill="none" strokeWidth="10" className="stroke-border" />
                <circle cx="124" cy="124" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
                  className={cn("transition-[stroke-dashoffset] duration-300", isBreak ? "stroke-emerald-400" : "stroke-red-400")}
                  strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
              </svg>
              <div className="absolute text-center">
                <div className="text-5xl font-bold tabular font-mono tracking-tight" role="timer" aria-live="off">{p.loading ? "--:--" : formatClock(p.remainingMs)}</div>
                <div className="mt-1 text-sm text-muted-foreground">{p.loading ? "Yuklanmoqda…" : status}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!p.active && <Button size="lg" className="min-w-36" disabled={p.busy || p.loading} onClick={p.start}><Play />Boshlash</Button>}
              {p.active && p.running && <Button size="lg" className="min-w-36" disabled={p.busy} onClick={p.pause}><Pause />Pauza</Button>}
              {p.active && !p.running && <Button size="lg" className="min-w-36" disabled={p.busy} onClick={p.resume}><Play />Davom ettirish</Button>}
              <Button size="lg" variant="outline" disabled={!p.active || p.busy} onClick={p.reset} aria-label="Qayta boshlash (bekor qilish)"><RotateCcw />Reset</Button>
            </div>
            {p.active && !isBreak && <p className="text-xs text-muted-foreground text-center">Reset bosilsa joriy seans bekor qilinadi va hisobga olinmaydi.</p>}
          </section>

          {/* Statistika */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<Flame className="size-3.5 text-red-400" />} label="Jami seanslar" value={stats?.totalSessions ?? pomodoroData?.totalPomodoros ?? 0} />
            <StatCard icon={<Timer className="size-3.5 text-orange-400" />} label="Bugun" value={stats?.todaySessions ?? 0} />
            <StatCard icon={<Clock className="size-3.5 text-sky-400" />} label="Jami fokus vaqti" value={stats ? formatFocusTime(stats.totalFocusSeconds) : "—"} />
            <StatCard icon={<Clock className="size-3.5 text-emerald-400" />} label="Bugungi fokus vaqti" value={stats ? formatFocusTime(stats.todayFocusSeconds) : "—"} />
          </section>

          {/* Sozlamalar */}
          <section className="surface space-y-6 p-5">
            <div><h3 className="font-semibold">Sozlamalar</h3><p className="text-xs text-muted-foreground">Tanlovingiz hisobingizga saqlanadi va qaytganingizda tiklanadi.</p></div>
            <DurationPicker label="Fokus davomiyligi" hint={`Kamida ${FOCUS_MIN} daqiqa.`} value={p.settings.focusMin} presets={FOCUS_PRESETS} min={FOCUS_MIN} max={FOCUS_MAX} onSave={save("focusMin")} />
            <DurationPicker label="Qisqa tanaffus" hint="Har bir fokusdan keyin." value={p.settings.shortBreakMin} presets={SHORT_BREAK_PRESETS} min={SHORT_BREAK_MIN} max={SHORT_BREAK_MAX} onSave={save("shortBreakMin")} />
            <DurationPicker label="Uzoq tanaffus" hint="Bir necha fokusdan keyin." value={p.settings.longBreakMin} presets={LONG_BREAK_PRESETS} min={LONG_BREAK_MIN} max={LONG_BREAK_MAX} onSave={save("longBreakMin")} />
            <div className="flex items-center justify-between gap-4">
              <div><Label>Uzoq tanaffus oralig'i</Label><p className="text-xs text-muted-foreground">Har nechta fokusdan keyin uzoq tanaffus taklif qilinadi.</p></div>
              <Select value={String(p.settings.longBreakEvery)} onValueChange={(v) => p.saveSettings({ longBreakEvery: Number(v) }).then(() => toast({ title: "Sozlama saqlandi" })).catch((e) => toast({ title: "Saqlab bo'lmadi", description: e instanceof Error ? e.message : undefined, variant: "destructive" }))}>
                <SelectTrigger className="w-28" aria-label="Uzoq tanaffus oralig'i"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: LONG_EVERY_MAX - LONG_EVERY_MIN + 1 }, (_, i) => LONG_EVERY_MIN + i).map((n) => <SelectItem key={n} value={String(n)}>{n} ta</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </section>
        </>
      ) : (
        <section className="surface p-5">
          <h3 className="mb-4 font-semibold">Tarix</h3>
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Hali yakunlangan seans yo'q.</p>
          ) : (
            <div className="space-y-2">
              {[...sessions].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
                <div key={`${s.id}-${s.date}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <div className="flex items-center gap-3 text-sm"><Calendar className="size-4 text-muted-foreground" /><span className="tabular">{s.date}</span></div>
                  <div className="flex items-center gap-2"><span>🍅</span><span className="font-semibold tabular">{s.count}</span></div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
