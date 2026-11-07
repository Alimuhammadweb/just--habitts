"use client"
import { useEffect, useMemo, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, CalendarDays, CheckCircle2, Clock, Flame, ListChecks, Plus, Swords, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Ring } from "@/components/ring"
import { ResultsChart, Legend } from "@/components/stats/charts"
import type { User } from "@/types/user"
import { CHALLENGES } from "@/types/user"
import { computeOverview, dailySeries, type HabitLike } from "@/lib/stats/habit-stats"
import { addDays, resolveTimezone, todayKey, weekDays, weekStart } from "@/lib/dates"
import { WEEKDAYS_LONG, dayMonth } from "@/lib/uz"
import { getChallenges, getLeaderboard, listWeeklyTasks, patchWeeklyTask, type LeaderboardResponse, type WeeklyTask } from "@/lib/client-api"
import type { ChallengeView } from "@/lib/server/challenge-engine"
import { cn } from "@/lib/utils"
import type { PageId } from "@/components/app/nav"
import { calculateLevel } from "@/lib/xp-system"

interface Props { user: User; onNavigate: (p: PageId) => void; onAddHabit: () => void; onAddTask: () => void; refreshKey?: number }

export function DashboardPage({ user, onNavigate, onAddHabit, onAddTask }: Props) {
  const tz = resolveTimezone(user.timezone)
  const reduce = useReducedMotion()
  const habits = (user.habits || []) as unknown as HabitLike[]
  const today = todayKey(tz)
  const overview = useMemo(() => computeOverview(habits, tz), [habits, tz])
  const series = useMemo(() => dailySeries(habits, addDays(today, -13), today, tz), [habits, tz, today])

  const [tasks, setTasks] = useState<WeeklyTask[] | null>(null)
  const [tasksErr, setTasksErr] = useState(false)
  const [views, setViews] = useState<ChallengeView[] | null>(null)
  const [board, setBoard] = useState<LeaderboardResponse | null>(null)

  useEffect(() => {
    const days = weekDays(today)
    listWeeklyTasks(days[0], days[6]).then((r) => setTasks(r.tasks)).catch(() => setTasksErr(true))
    getChallenges().then((r) => setViews(r.views)).catch(() => setViews([]))
    getLeaderboard("all").then(setBoard).catch(() => setBoard(null))
  }, [today])

  const name = (user.firstName || user.name || "").split(" ")[0]
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date()))
  const greeting = hour < 5 ? "Xayrli tun" : hour < 12 ? "Xayrli tong" : hour < 18 ? "Xayrli kun" : "Xayrli kech"
  const xp = user.xpData?.totalXP ?? 0, level = calculateLevel(xp), levelPct = xp % 100

  const todayTasks = (tasks || []).filter((t) => t.date === today).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"))
  const weekDone = (tasks || []).filter((t) => t.completed).length
  const dueToday = overview.today.due + overview.today.pending + overview.today.frozen
  const doneToday = overview.today.completed + overview.today.partial
  const pct = dueToday ? Math.round((overview.today.completed / dueToday) * 100) : null

  const recent = useMemo(() => {
    const rows: { habit: string; day: number; status: string; at: number }[] = []
    for (const h of user.habits || []) for (const [i, l] of Object.entries(h.dayLocks || {})) if (l?.markedAt && l.status !== "missed") rows.push({ habit: h.name, day: Number(i) + 1, status: l.status, at: l.markedAt })
    return rows.sort((a, b) => b.at - a.at).slice(0, 5)
  }, [user.habits])

  async function toggleTask(t: WeeklyTask) {
    const next = !t.completed
    setTasks((p) => p?.map((x) => (x.id === t.id ? { ...x, completed: next } : x)) ?? p)
    try { const r = await patchWeeklyTask(t.id, { completed: next }); setTasks((p) => p?.map((x) => (x.id === t.id ? r.task : x)) ?? p) }
    catch { setTasks((p) => p?.map((x) => (x.id === t.id ? t : x)) ?? p) }
  }

  const activeChallenges = (views || []).filter((v) => v.status === "active")
  const appear = (i: number) => reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.04, duration: 0.2 } }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{greeting}, {name}</h2>
          <p className="text-sm text-muted-foreground">{WEEKDAYS_LONG[(new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7]}, {dayMonth(today)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onAddTask}><Plus />Vazifa</Button>
          <Button onClick={onAddHabit}><Plus />Odat</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div {...appear(0)} className="surface p-4 flex items-center gap-4">
          <Ring value={pct} size={72} color="var(--chart-3)"><span className="text-sm font-semibold tabular">{pct == null ? "—" : `${pct}%`}</span></Ring>
          <div><p className="text-sm text-muted-foreground">Bugungi odatlar</p><p className="text-xl font-semibold tabular">{doneToday}<span className="text-muted-foreground text-base"> / {dueToday}</span></p>
            <p className="text-xs text-muted-foreground">{dueToday === 0 ? "Bugun odat yo'q" : overview.today.pending ? `${overview.today.pending} ta kutilmoqda` : "Hammasi belgilandi"}</p></div>
        </motion.div>
        <motion.div {...appear(1)} className="surface p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Seriya</p><Flame className="size-4 text-amber-400" /></div>
          <p className="mt-1 text-3xl font-semibold tabular">{overview.streak.current}<span className="text-base text-muted-foreground"> kun</span></p>
          <p className="text-xs text-muted-foreground">Eng uzun: {overview.streak.longest} kun</p>
        </motion.div>
        <motion.div {...appear(2)} className="surface p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Daraja</p><span className="text-xs tabular text-muted-foreground">{xp} XP</span></div>
          <p className="mt-1 text-3xl font-semibold tabular">{level}</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${levelPct}%`, transition: "width 500ms ease" }} /></div>
          <p className="mt-1 text-xs text-muted-foreground">Keyingi darajagacha {100 - levelPct} XP</p>
        </motion.div>
        <motion.div {...appear(3)} className="surface p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Haftalik reja</p><CalendarDays className="size-4 text-sky-400" /></div>
          {tasks === null && !tasksErr ? <Skeleton className="mt-2 h-8 w-24" /> : tasksErr ? <p className="mt-2 text-sm text-muted-foreground">Yuklab bo'lmadi</p> : (
            <><p className="mt-1 text-3xl font-semibold tabular">{weekDone}<span className="text-base text-muted-foreground"> / {tasks!.length}</span></p><p className="text-xs text-muted-foreground">vazifa bajarildi</p></>)}
        </motion.div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2 min-w-0">
          <section className="surface p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div><h3 className="font-semibold">So'nggi 14 kun</h3><p className="text-xs text-muted-foreground">Haftalik bajarilish: {overview.week.rate == null ? "—" : `${overview.week.rate}%`} · Oylik: {overview.month.rate == null ? "—" : `${overview.month.rate}%`}</p></div>
              <Legend />
            </div>
            {habits.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">Birinchi odatni qo'shing — diagramma shu yerda paydo bo'ladi.</div> : <ResultsChart data={series} height={200} />}
          </section>

          <section className="surface p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Bugungi vazifalar</h3>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("planner")}>Reja<ArrowRight /></Button></div>
            {tasks === null && !tasksErr ? <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              : tasksErr ? <p className="text-sm text-muted-foreground">Vazifalarni yuklab bo'lmadi. Rejaga o'tib qayta urinib ko'ring.</p>
              : todayTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center"><p className="text-sm text-muted-foreground">Bugunga vazifa rejalashtirilmagan.</p><Button size="sm" variant="outline" onClick={onAddTask}><Plus />Vazifa qo'shish</Button></div>
              ) : (
                <ul className="space-y-1.5">{todayTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <button onClick={() => toggleTask(t)} role="checkbox" aria-checked={t.completed} aria-label="Bajarildi deb belgilash"
                      className={cn("size-6 shrink-0 rounded-full border-2 flex items-center justify-center", t.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40")}>{t.completed && <CheckCircle2 className="size-4" />}</button>
                    <span className={cn("flex-1 truncate text-sm", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                    {t.time && <span className="text-xs text-muted-foreground tabular flex items-center gap-1"><Clock className="size-3" />{t.time}</span>}
                  </li>))}</ul>)}
          </section>
        </div>

        <div className="space-y-4 min-w-0">
          <section className="surface p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold flex items-center gap-2"><Swords className="size-4 text-violet-400" />Chelenglar</h3><Button variant="ghost" size="sm" onClick={() => onNavigate("challenges")}>Hammasi<ArrowRight /></Button></div>
            {views === null ? <Skeleton className="h-14" /> : activeChallenges.length === 0 ? <p className="text-sm text-muted-foreground">Faol chelenj yo'q. Yangisini boshlang.</p> : (
              <ul className="space-y-3">{activeChallenges.slice(0, 3).map((v) => { const def = CHALLENGES.find((c) => c.id === v.challengeId)!
                return (<li key={v.challengeId}><div className="flex justify-between text-sm"><span className="truncate">{def.icon} {def.title}</span><span className="tabular text-muted-foreground">{v.progress}/{v.target}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(v.progress / v.target) * 100}%`, background: def.color }} /></div></li>) })}</ul>)}
          </section>

          <section className="surface p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold flex items-center gap-2"><Trophy className="size-4 text-amber-400" />Reyting</h3><Button variant="ghost" size="sm" onClick={() => onNavigate("leaderboard")}>Top 10<ArrowRight /></Button></div>
            {!board ? <Skeleton className="h-24" /> : board.entries.length === 0 ? <p className="text-sm text-muted-foreground">Reyting hali bo'sh.</p> : (
              <ol className="space-y-1.5">{board.entries.slice(0, 5).map((e) => (
                <li key={e.id} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm", e.isMe && "bg-primary/10")}>
                  <span className="w-5 tabular text-muted-foreground">{e.rank}</span><span className="flex-1 truncate">{e.displayName}{e.isMe && " (siz)"}</span><span className="tabular text-muted-foreground">{e.score} XP</span></li>))}</ol>)}
            {board?.me && <p className="mt-2 text-xs text-muted-foreground">Sizning o'rningiz: {board.me.rank}</p>}
          </section>

          <section className="surface p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold flex items-center gap-2"><ListChecks className="size-4 text-emerald-400" />So'nggi faollik</h3></div>
            {recent.length === 0 ? <p className="text-sm text-muted-foreground">Hali belgilangan kun yo'q.</p> : (
              <ul className="space-y-1.5 text-sm">{recent.map((r, i) => (<li key={i} className="flex justify-between gap-2"><span className="truncate">{r.habit} · {r.day}-kun</span>
                <span className={r.status === "completed" ? "text-emerald-400" : r.status === "partial" ? "text-amber-400" : "text-sky-300"}>{r.status === "completed" ? "Bajarildi" : r.status === "partial" ? "Qisman" : "Muzlatildi"}</span></li>))}</ul>)}
          </section>
        </div>
      </div>
    </div>
  )
}
