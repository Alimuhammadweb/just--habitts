"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { AlertTriangle, Bell, BellOff, CalendarCheck, CalendarX2, Check, ChevronLeft, ChevronRight, Clock, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { addDays, resolveTimezone, todayKey, weekDays, weekStart, zonedTimeToUtc } from "@/lib/dates"
import { MONTHS, WEEKDAYS_LONG, WEEKDAYS_SHORT, dayMonth, dayOfMonth } from "@/lib/uz"
import {
  createWeeklyTask, deleteWeeklyTask, listOverdueTasks, listWeeklyTasks, patchWeeklyTask,
  type TaskInput, type WeeklyTask,
} from "@/lib/client-api"
import { Ring } from "@/components/ring"
import { TaskDialog } from "./task-dialog"
import { CATEGORY_META, PRIORITY_META, fmtDuration } from "./task-meta"
import { cn } from "@/lib/utils"

const byTime = (a: WeeklyTask, b: WeeklyTask) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.createdAt.localeCompare(b.createdAt)

function weekTitle(start: string) {
  const end = addDays(start, 6)
  const [, m1] = start.split("-").map(Number), [, m2] = end.split("-").map(Number)
  return m1 === m2 ? `${dayOfMonth(start)}–${dayOfMonth(end)} ${MONTHS[m1 - 1]}` : `${dayMonth(start)} – ${dayMonth(end)}`
}

export function PlannerPage({ timezone, autoOpen }: { timezone?: string; autoOpen?: boolean }) {
  const tz = resolveTimezone(timezone)
  const { toast } = useToast()
  const reduce = useReducedMotion()
  const today = todayKey(tz)
  const [wk, setWk] = useState(weekStart(today))
  const [selected, setSelected] = useState(today)
  const [tasks, setTasks] = useState<WeeklyTask[]>([])
  const [overdue, setOverdue] = useState<WeeklyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ open: boolean; task: WeeklyTask | null }>({ open: false, task: null })
  const [toDelete, setToDelete] = useState<WeeklyTask | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const reqId = useRef(0)
  useEffect(() => { if (autoOpen) setDialog({ open: true, task: null }) }, [autoOpen])

  const days = useMemo(() => weekDays(wk), [wk])

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true); setError(null)
    try {
      const [week, od] = await Promise.all([listWeeklyTasks(days[0], days[6]), listOverdueTasks()])
      if (id !== reqId.current) return // eskirgan javob
      setTasks(week.tasks); setOverdue(od.tasks)
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : "Yuklab bo'lmadi")
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [days])
  useEffect(() => { load() }, [load])

  const refreshOverdue = useCallback(() => { listOverdueTasks().then((r) => setOverdue(r.tasks)).catch(() => {}) }, [])

  const inWeek = (date: string) => date >= days[0] && date <= days[6]
  const upsertLocal = (t: WeeklyTask) => setTasks((prev) => (inWeek(t.date) ? [...prev.filter((x) => x.id !== t.id), t] : prev.filter((x) => x.id !== t.id)))

  async function saveTask(input: TaskInput) {
    if (dialog.task) {
      const { task } = await patchWeeklyTask(dialog.task.id, input)
      upsertLocal(task); toast({ title: "Vazifa yangilandi" })
    } else {
      const { task } = await createWeeklyTask(input)
      upsertLocal(task); toast({ title: "Vazifa qo'shildi" })
    }
    refreshOverdue()
  }

  async function toggle(t: WeeklyTask) {
    if (busy.has(t.id)) return
    const next = !t.completed
    const optimistic = { ...t, completed: next, completedAt: next ? new Date().toISOString() : null }
    setBusy((s) => new Set(s).add(t.id))
    upsertLocal(optimistic); setOverdue((o) => (next ? o.filter((x) => x.id !== t.id) : o))
    try {
      const { task } = await patchWeeklyTask(t.id, { completed: next })
      upsertLocal(task)
    } catch (e) {
      upsertLocal(t) // orqaga qaytarish
      refreshOverdue()
      toast({ title: "Belgilab bo'lmadi", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(t.id); return n })
    }
  }

  async function reschedule(t: WeeklyTask, date: string) {
    try {
      const { task } = await patchWeeklyTask(t.id, { date })
      upsertLocal(task); refreshOverdue()
      toast({ title: `${dayMonth(date)} ga ko'chirildi` })
    } catch (e) {
      toast({ title: "Ko'chirib bo'lmadi", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    const t = toDelete; setToDelete(null)
    try {
      await deleteWeeklyTask(t.id)
      setTasks((p) => p.filter((x) => x.id !== t.id)); setOverdue((p) => p.filter((x) => x.id !== t.id))
      toast({ title: "Vazifa o'chirildi" })
    } catch (e) {
      toast({ title: "O'chirib bo'lmadi", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    }
  }

  const perDay = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>()
    for (const d of days) m.set(d, { total: 0, done: 0 })
    for (const t of tasks) { const e = m.get(t.date); if (e) { e.total++; if (t.completed) e.done++ } }
    return m
  }, [tasks, days])
  const total = tasks.length, done = tasks.filter((t) => t.completed).length
  const weekPct = total ? Math.round((done / total) * 100) : null
  const dayTasks = useMemo(() => tasks.filter((t) => t.date === selected).sort(byTime), [tasks, selected])

  const go = (delta: number) => { const n = addDays(wk, delta * 7); setWk(n); setSelected(delta === 0 ? today : addDays(n, (days.indexOf(selected) + 7) % 7)) }
  const goToday = () => { setWk(weekStart(today)); setSelected(today) }

  const nowHM = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date())
  const isOverdue = (t: WeeklyTask) => !t.completed && (t.date < today || (t.date === today && !!t.time && t.time < nowHM))

  useReminders(tasks, tz)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Haftalik reja</h1>
          <p className="text-sm text-muted-foreground">Kunlarga vazifa rejalashtiring va vaqti kelganda belgilang.</p>
        </div>
        <Button onClick={() => setDialog({ open: true, task: null })}><Plus />Yangi vazifa</Button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4 min-w-0">
          {/* Hafta navigatsiyasi */}
          <div className="surface p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => go(-1)} aria-label="Oldingi hafta"><ChevronLeft /></Button>
                <Button variant="outline" size="icon" onClick={() => go(1)} aria-label="Keyingi hafta"><ChevronRight /></Button>
              </div>
              <div className="text-center min-w-0">
                <p className="font-medium tabular truncate">{weekTitle(wk)}</p>
                <p className="text-xs text-muted-foreground">{wk === weekStart(today) ? "Joriy hafta" : wk < weekStart(today) ? "Oldingi hafta" : "Kelgusi hafta"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={goToday} disabled={wk === weekStart(today) && selected === today}>Bugun</Button>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2" role="tablist" aria-label="Hafta kunlari">
              {days.map((d, i) => {
                const s = perDay.get(d)!, isSel = d === selected, isToday = d === today
                return (
                  <button key={d} role="tab" aria-selected={isSel} onClick={() => setSelected(d)}
                    className={cn("flex flex-col items-center gap-1 rounded-xl border py-2 min-h-[64px] sm:min-h-[76px] focus-visible:ring-2 focus-visible:ring-ring",
                      isSel ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent border-border")}>
                    <span className={cn("text-[11px] sm:text-xs", isSel ? "opacity-90" : "text-muted-foreground")}>{WEEKDAYS_SHORT[i]}</span>
                    <span className={cn("text-base sm:text-lg font-semibold tabular leading-none", isToday && !isSel && "text-primary")}>{dayOfMonth(d)}</span>
                    <span className={cn("text-[10px] tabular", isSel ? "opacity-90" : "text-muted-foreground")}>{s.total ? `${s.done}/${s.total}` : "·"}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Kechikkan vazifalar */}
          {overdue.length > 0 && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 sm:p-4">
              <h2 className="flex items-center gap-2 text-sm font-medium text-red-300"><AlertTriangle className="size-4" />Kechikkan vazifalar ({overdue.length})</h2>
              <ul className="mt-2 space-y-1.5">
                {overdue.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <button onClick={() => toggle(t)} aria-label="Bajarildi deb belgilash" className="size-6 shrink-0 rounded-full border border-red-400/40 hover:bg-red-400/10" />
                    <span className="truncate flex-1">{t.title}</span>
                    <span className="text-xs text-muted-foreground tabular shrink-0">{dayMonth(t.date)}{t.time ? ` ${t.time}` : ""}</span>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => reschedule(t, today)}>Bugunga</Button>
                  </li>
                ))}
              </ul>
              {overdue.length > 5 && <p className="mt-2 text-xs text-muted-foreground">Yana {overdue.length - 5} ta kechikkan vazifa bor.</p>}
            </div>
          )}

          {/* Tanlangan kun */}
          <div className="surface p-3 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold">{WEEKDAYS_LONG[days.indexOf(selected)]}, {dayMonth(selected)}</h2>
                <p className="text-xs text-muted-foreground">{dayTasks.length ? `${dayTasks.filter((t) => t.completed).length}/${dayTasks.length} bajarildi` : "Vazifa yo'q"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, task: null })}><Plus />Qo'shish</Button>
            </div>

            {loading ? (
              <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <CalendarX2 className="size-9 text-muted-foreground" />
                <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
                <Button variant="outline" onClick={load}><RefreshCw />Qayta urinish</Button>
              </div>
            ) : dayTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <CalendarCheck className="size-9 text-muted-foreground" />
                <div>
                  <p className="font-medium">{selected < today ? "Bu kunga vazifa qo'yilmagan" : "Bu kun bo'sh"}</p>
                  <p className="text-sm text-muted-foreground">{selected < today ? "O'tgan kunlarga ham vazifa qo'shib, tarixni to'ldirishingiz mumkin." : "Bugun nimani bajarmoqchisiz?"}</p>
                </div>
                <Button onClick={() => setDialog({ open: true, task: null })}><Plus />Vazifa qo'shish</Button>
              </div>
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {dayTasks.map((t) => (
                    <motion.li key={t.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.15 }}
                      className={cn("group flex items-start gap-3 rounded-xl border p-3", t.completed ? "bg-muted/40 border-border" : isOverdue(t) ? "border-red-500/30 bg-red-500/5" : "bg-card border-border hover:border-border-medium")}>
                      <button onClick={() => toggle(t)} disabled={busy.has(t.id)} role="checkbox" aria-checked={t.completed} aria-label={t.completed ? "Bajarilmagan deb belgilash" : "Bajarildi deb belgilash"}
                        className={cn("mt-0.5 size-7 shrink-0 rounded-full border-2 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring", t.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 hover:border-primary")}>
                        {t.completed && <Check className="size-4" strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn("font-medium leading-snug break-words", t.completed && "line-through text-muted-foreground")}>{t.title}</p>
                        {t.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2 break-words">{t.description}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {t.time && <span className={cn("inline-flex items-center gap-1 tabular", isOverdue(t) ? "text-red-300" : "text-muted-foreground")}><Clock className="size-3.5" />{t.time}{t.durationMin ? ` · ${fmtDuration(t.durationMin)}` : ""}</span>}
                          {!t.time && t.durationMin && <span className="text-muted-foreground">{fmtDuration(t.durationMin)}</span>}
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", CATEGORY_META[t.category].chip)}>{CATEGORY_META[t.category].label}</span>
                          <span className={PRIORITY_META[t.priority].cls}>{PRIORITY_META[t.priority].label}</span>
                          {t.reminderMin != null && <Bell className="size-3.5 text-muted-foreground" aria-label="Eslatma yoqilgan" />}
                          {isOverdue(t) && <span className="text-red-300">Kechikkan</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 -mr-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ open: true, task: t })} aria-label="Tahrirlash"><Pencil /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setToDelete(t)} aria-label="O'chirish"><Trash2 /></Button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </section>

        {/* Haftalik xulosa */}
        <aside className="space-y-4">
          <div className="surface p-4 sm:p-5">
            <h2 className="font-semibold mb-3">Haftalik xulosa</h2>
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <div className="flex items-center gap-4">
                <Ring value={weekPct} size={92} stroke={9} color="var(--chart-3)">
                  <span className="text-lg font-semibold tabular">{weekPct == null ? "—" : `${weekPct}%`}</span>
                </Ring>
                <dl className="text-sm space-y-1">
                  <div className="flex gap-2"><dt className="text-muted-foreground">Bajarildi</dt><dd className="tabular font-medium">{done}</dd></div>
                  <div className="flex gap-2"><dt className="text-muted-foreground">Jami</dt><dd className="tabular font-medium">{total}</dd></div>
                  <div className="flex gap-2"><dt className="text-muted-foreground">Qoldi</dt><dd className="tabular font-medium">{total - done}</dd></div>
                </dl>
              </div>
            )}
            {!loading && total === 0 && <p className="mt-3 text-sm text-muted-foreground">Bu haftaga hali vazifa qo'shilmagan.</p>}
            <div className="mt-4 space-y-2" aria-label="Kunlar bo'yicha progress">
              {days.map((d, i) => { const s = perDay.get(d)!; const p = s.total ? (s.done / s.total) * 100 : 0
                return (
                  <div key={d} className="flex items-center gap-2 text-xs">
                    <span className="w-7 text-muted-foreground">{WEEKDAYS_SHORT[i]}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${p}%`, transition: "width 400ms ease" }} /></div>
                    <span className="w-9 text-right tabular text-muted-foreground">{s.total ? `${s.done}/${s.total}` : "—"}</span>
                  </div>)
              })}
            </div>
          </div>
          <ReminderCard />
        </aside>
      </div>

      <TaskDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} task={dialog.task} defaultDate={selected} onSubmit={saveTask} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vazifani o'chirasizmi?</AlertDialogTitle>
            <AlertDialogDescription>«{toDelete?.title}» butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>O'chirish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Eslatmalar: faqat ilova ochiq bo'lganda (brauzer Notification API). Fon xizmati yo'q. ──
function useReminders(tasks: WeeklyTask[], tz: string) {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    const check = () => {
      if (Notification.permission !== "granted") return
      const now = Date.now()
      let fired: string[] = []
      try { fired = JSON.parse(sessionStorage.getItem("planner-fired") || "[]") } catch { /* e'tiborsiz */ }
      for (const t of tasks) {
        if (t.completed || !t.time || t.reminderMin == null || fired.includes(t.id)) continue
        const at = zonedTimeToUtc(t.date, t.time, tz) - t.reminderMin * 60_000
        if (now >= at && now - at < 2 * 60_000) {
          new Notification(t.title, { body: t.time ? `Soat ${t.time}` : undefined, tag: t.id })
          fired.push(t.id)
        }
      }
      try { sessionStorage.setItem("planner-fired", JSON.stringify(fired.slice(-200))) } catch { /* e'tiborsiz */ }
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [tasks, tz])
}

function ReminderCard() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default")
  useEffect(() => { setPerm(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported") }, [])
  return (
    <div className="surface p-4 sm:p-5">
      <h2 className="font-semibold flex items-center gap-2">{perm === "granted" ? <Bell className="size-4" /> : <BellOff className="size-4" />}Eslatmalar</h2>
      {perm === "unsupported" && <p className="mt-2 text-sm text-muted-foreground">Bu brauzer bildirishnomalarni qo'llamaydi. Reja eslatmasiz to'liq ishlaydi.</p>}
      {perm === "granted" && <p className="mt-2 text-sm text-muted-foreground">Yoqilgan. Eslatma vazifa oldidan, faqat ilova ochiq turganda chiqadi.</p>}
      {perm === "denied" && <p className="mt-2 text-sm text-muted-foreground">Brauzer sozlamalarida bildirishnomalar bloklangan. Reja eslatmasiz ishlayveradi.</p>}
      {perm === "default" && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Vazifa vaqtidan oldin bildirishnoma olish mumkin. Diqqat: bu faqat sahifa ochiq bo'lganda ishlaydi; yopiq ilovada eslatma kelmaydi.</p>
          <Button className="mt-3" variant="outline" size="sm" onClick={async () => setPerm(await Notification.requestPermission())}>Bildirishnomalarni yoqish</Button>
        </>
      )}
    </div>
  )
}
