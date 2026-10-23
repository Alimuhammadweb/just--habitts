"use client"
import { useCallback, useEffect, useState } from "react"
import { Crown, RefreshCw, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getLeaderboard, type LeaderboardEntry, type LeaderboardResponse } from "@/lib/client-api"
import { dayMonth } from "@/lib/uz"
import { addDays } from "@/lib/dates"
import { cn } from "@/lib/utils"

const MEDAL = ["text-amber-300", "text-slate-300", "text-orange-400"]

function Row({ e, highlight }: { e: LeaderboardEntry; highlight?: boolean }) {
  const initials = e.displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
  return (
    <li className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 min-h-[56px]", e.isMe || highlight ? "border-primary/40 bg-primary/10" : "border-border bg-card")}>
      <span className={cn("w-7 text-center font-semibold tabular", e.rank <= 3 ? MEDAL[e.rank - 1] : "text-muted-foreground")}>{e.rank === 1 ? <Crown className="mx-auto size-5" /> : e.rank}</span>
      {e.avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.avatarUrl} alt="" className="size-9 rounded-full object-cover" />
        : <span className="size-9 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center">{initials}</span>}
      <div className="min-w-0 flex-1"><p className="truncate font-medium text-sm">{e.displayName}{e.isMe && <span className="ml-1.5 text-xs text-primary">siz</span>}</p><p className="text-xs text-muted-foreground">{e.level}-daraja</p></div>
      <p className="tabular font-semibold">{e.score.toLocaleString("uz")}<span className="ml-1 text-xs font-normal text-muted-foreground">XP</span></p>
    </li>
  )
}

export function LeaderboardView() {
  const [period, setPeriod] = useState<"all" | "week">("week")
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (p: "all" | "week") => {
    setData(null); setError(null)
    try { setData(await getLeaderboard(p)) } catch (e) { setError(e instanceof Error ? e.message : "Yuklab bo'lmadi") }
  }, [])
  useEffect(() => { load(period) }, [period, load])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold tracking-tight">Reyting</h2><p className="text-sm text-muted-foreground">Eng faol 10 foydalanuvchi.</p></div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as "all" | "week")}>
          <TabsList><TabsTrigger value="week">Haftalik</TabsTrigger><TabsTrigger value="all">Umumiy</TabsTrigger></TabsList>
        </Tabs>
      </div>
      {period === "week" && data?.weekStart && <p className="text-xs text-muted-foreground">{dayMonth(data.weekStart)} – {dayMonth(addDays(data.weekStart, 6))} haftasida to'plangan XP. Har dushanba yangi hafta boshlanadi; umumiy XP o'zgarmaydi.</p>}
      {period === "all" && <p className="text-xs text-muted-foreground">Barcha vaqt davomida to'plangan XP bo'yicha.</p>}

      {!data && !error && <div className="space-y-2" aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>}
      {error && <div className="surface p-8 text-center space-y-3"><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={() => load(period)}><RefreshCw />Qayta urinish</Button></div>}
      {data && data.entries.length === 0 && (
        <div className="surface p-10 text-center"><Trophy className="mx-auto size-9 text-muted-foreground" /><p className="mt-3 font-medium">Hozircha reyting bo'sh</p><p className="text-sm text-muted-foreground">{period === "week" ? "Bu hafta hali XP to'plagan foydalanuvchi yo'q. Birinchi bo'ling!" : "XP to'plagan foydalanuvchilar shu yerda ko'rinadi."}</p></div>
      )}
      {data && data.entries.length > 0 && <ol className="space-y-2">{data.entries.map((e) => <Row key={e.id} e={e} />)}</ol>}
      {data?.me && (
        <div className="space-y-1.5"><p className="text-xs text-muted-foreground px-1">Sizning o'rningiz</p><ol><Row e={data.me} highlight /></ol></div>
      )}
      {data && !data.me && data.entries.length > 0 && !data.entries.some((e) => e.isMe) && <p className="text-xs text-muted-foreground px-1">{period === "week" ? "Bu hafta XP to'plab, reytingga kiring." : "XP to'plab, reytingga kiring."}</p>}
    </div>
  )
}
