"use client"
import { useMemo, useState } from "react"
import { Flame, Target } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Ring } from "@/components/ring"
import { Legend, RateChart, ResultsChart } from "./charts"
import type { User } from "@/types/user"
import { computeOverview, dailySeries, habitProgress, monthlySeries, weeklySeries, type HabitLike } from "@/lib/stats/habit-stats"
import { addDays, resolveTimezone, todayKey } from "@/lib/dates"
import { MONTHS, dayMonth } from "@/lib/uz"

type Range = "7" | "30" | "90" | "weeks" | "months"

const pct = (v: number | null) => (v == null ? "—" : `${v}%`)

export function StatisticsView({ user }: { user: User }) {
  const tz = resolveTimezone(user.timezone)
  const all = (user.habits || []) as unknown as HabitLike[]
  const [range, setRange] = useState<Range>("30")
  const [habitId, setHabitId] = useState<string>("all")
  const habits = useMemo(() => (habitId === "all" ? all : all.filter((h) => String(h.id) === habitId)), [all, habitId])
  const today = todayKey(tz)
  const overview = useMemo(() => computeOverview(habits, tz), [habits, tz])

  const data = useMemo(() => {
    if (range === "weeks") return weeklySeries(habits, 12, tz)
    if (range === "months") return monthlySeries(habits, 6, tz)
    return dailySeries(habits, addDays(today, -(Number(range) - 1)), today, tz)
  }, [habits, range, tz, today])
  const label = (l: string) => (range === "months" ? MONTHS[Number(l.slice(5, 7)) - 1] : range === "weeks" ? `${dayMonth(l)} haftasi` : dayMonth(l))
  const progress = useMemo(() => all.map((h) => habitProgress(h, tz)), [all, tz])

  if (all.length === 0) {
    return <div className="surface p-10 text-center"><Target className="mx-auto size-9 text-muted-foreground" /><p className="mt-3 font-medium">Statistika uchun odat kerak</p><p className="text-sm text-muted-foreground">Birinchi odatni qo'shing va kunlarni belgilab boring.</p></div>
  }

  const cards = [
    { k: "Bugun", v: overview.today },
    { k: "Shu hafta", v: overview.week },
    { k: "Shu oy", v: overview.month },
    { k: "Butun tarix", v: overview.overall },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-semibold tracking-tight">Statistika</h2>
          <p className="text-sm text-muted-foreground">Faqat belgilangan kunlar hisoblanadi. Boshlanmagan va hali tugamagan kunlar jazolanmaydi.</p></div>
        <Select value={habitId} onValueChange={setHabitId}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Odatni tanlash"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Barcha odatlar</SelectItem>{all.map((h) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.k} className="surface p-4 flex items-center gap-3">
            <Ring value={c.v.rate} size={52} stroke={6} color="var(--chart-3)" />
            <div className="min-w-0"><p className="text-xs text-muted-foreground">{c.k}</p><p className="text-lg font-semibold tabular">{pct(c.v.rate)}</p>
              <p className="text-[11px] text-muted-foreground tabular">{c.v.completed}/{c.v.due} kun</p></div>
          </div>))}
        <div className="surface p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Flame className="size-4 text-amber-400" />Seriya</div>
          <p className="text-2xl font-semibold tabular">{overview.streak.current} <span className="text-sm text-muted-foreground">kun</span></p>
          <p className="text-[11px] text-muted-foreground">Eng uzun: {overview.streak.longest} kun</p>
        </div>
      </div>

      <section className="surface p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList className="h-auto flex-wrap">
              {([["7", "7 kun"], ["30", "30 kun"], ["90", "90 kun"], ["weeks", "Haftalar"], ["months", "Oylar"]] as const).map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <Legend />
        </div>
        <div><h3 className="text-sm font-medium mb-2">Natijalar</h3><ResultsChart data={data} label={label} /></div>
        <div><h3 className="text-sm font-medium mb-2">Bajarish foizi</h3><RateChart data={data} label={label} />
          <p className="mt-1 text-xs text-muted-foreground">Ma'lumot bo'lmagan kunlar chiziqda uziladi — ular 0% emas.</p></div>
      </section>

      <section className="surface p-4 sm:p-5">
        <h3 className="font-semibold mb-3">Odatlar bo'yicha</h3>
        <ul className="divide-y divide-border">
          {progress.map((p) => (
            <li key={p.habitId} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1"><p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground tabular">{p.status === "upcoming" ? "Hali boshlanmagan" : p.status === "finished" ? "Yakunlangan" : `${p.daysElapsed}/${p.duration}-kun`} · seriya {p.streak.current} (eng uzun {p.streak.longest})</p></div>
              <div className="flex items-center gap-3 text-xs tabular">
                <span className="text-emerald-400">{p.completed}</span><span className="text-amber-400">{p.partial}</span><span className="text-red-400">{p.missed}</span>
                <span className="w-12 text-right font-medium text-sm">{pct(p.rate)}</span>
              </div>
            </li>))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Raqamlar: bajarildi · qisman · o'tkazildi. Muzlatilgan kunlar hisobga kirmaydi.</p>
      </section>
    </div>
  )
}
