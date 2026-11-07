"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Info, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { CHALLENGES, type Challenge, type User } from "@/types/user"
import { challengeAction, getChallenges } from "@/lib/client-api"
import type { ChallengeView } from "@/lib/server/challenge-engine"
import { dayMonth } from "@/lib/uz"
import { cn } from "@/lib/utils"

const DIFF: Record<string, string> = { oson: "Oson", ortacha: "O'rtacha", qiyin: "Qiyin", iroda: "Iroda" }
const KIND_NOTE: Record<string, string> = {
  self_report: "Kuniga bir marta o'zingiz belgilaysiz (server faollikni tekshira olmaydi).",
  pomodoro_total: "Progress yakunlangan pomodorolardan avtomatik hisoblanadi.",
  habit_days: "Progress odatlaringizdagi bajarilgan kunlardan avtomatik hisoblanadi. Kun tugagach hisobga olinadi.",
  habit_and_pomodoro_days: "Har kuni odat bajarilib, kamida bitta pomodoro tugatilishi kerak. Kun tugagach hisobga olinadi.",
}

export function ChallengesView({ user, onUserChange }: { user: User; onUserChange: (u: User) => void }) {
  const { toast } = useToast()
  const [views, setViews] = useState<ChallengeView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"active" | "all" | "done">("active")
  const [pending, setPending] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<Challenge | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try { const r = await getChallenges(); setViews(r.views); onUserChange(r.user) } catch (e) { setError(e instanceof Error ? e.message : "Yuklab bo'lmadi") }
  }, [onUserChange])
  useEffect(() => { load() }, [load])

  const byId = useMemo(() => new Map((views || []).map((v) => [v.challengeId, v])), [views])
  const completed = new Set(user.completedChallenges || [])

  async function act(action: "start" | "checkin", c: Challenge) {
    setPending(c.id)
    try {
      const r = await challengeAction(action, c.id)
      setViews(r.views); onUserChange(r.user)
      if (r.justCompleted.includes(c.id)) toast({ title: `«${c.title}» yakunlandi 🎉`, description: `Mukofot: ${c.reward.name}` })
      else toast({ title: action === "start" ? "Chelenj boshlandi" : "Bugun belgilandi" })
    } catch (e) {
      toast({ title: "Amal bajarilmadi", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); load()
    } finally { setPending(null); setConfirm(null) }
  }

  const list = CHALLENGES.filter((c) => {
    const v = byId.get(c.id)
    if (tab === "done") return completed.has(c.id)
    if (tab === "active") return v?.status === "active"
    return true
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold tracking-tight">Chelenglar</h2><p className="text-sm text-muted-foreground">Mukofot maqsadga haqiqatan erishilganda va faqat bir marta beriladi.</p></div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}><TabsList>
          <TabsTrigger value="active">Faol</TabsTrigger><TabsTrigger value="all">Hammasi</TabsTrigger><TabsTrigger value="done">Bajarilgan</TabsTrigger></TabsList></Tabs>
      </div>

      {!views && !error && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>}
      {error && <div className="surface p-8 text-center space-y-3"><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={load}><RefreshCw />Qayta urinish</Button></div>}

      {views && list.length === 0 && <div className="surface p-10 text-center text-sm text-muted-foreground">{tab === "active" ? "Faol chelenj yo'q. «Hammasi» bo'limidan birini boshlang." : "Bu yerda hali hech narsa yo'q."}</div>}

      {views && list.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const v = byId.get(c.id), isDone = completed.has(c.id), status = isDone ? "completed" : v?.status
            const pct = v ? (v.progress / v.target) * 100 : isDone ? 100 : 0
            return (
              <article key={c.id} className="surface p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden>{c.icon}</span>
                  <div className="min-w-0 flex-1"><h3 className="font-semibold leading-tight">{c.title}</h3><p className="text-xs text-muted-foreground">{DIFF[c.difficulty]} · {c.durationDays} kun</p></div>
                  {status === "completed" && <CheckCircle2 className="size-5 text-emerald-400" aria-label="Bajarilgan" />}
                  {status === "expired" && <span className="text-xs rounded-full border border-red-500/30 text-red-300 px-2 py-0.5">Muddati o'tdi</span>}
                </div>
                <p className="text-sm text-muted-foreground">{c.description}</p>
                {(v || isDone) && (<div><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Progress</span><span className="tabular">{v ? `${v.progress}/${v.target}` : "bajarilgan"}</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color, transition: "width 400ms ease" }} /></div>
                  {v && status === "active" && <p className="mt-1 text-xs text-muted-foreground">Oxirgi kun: {dayMonth(v.endDateKey)} · {v.daysLeft} kun qoldi</p>}</div>)}
                <p className="text-xs text-muted-foreground flex gap-1.5"><Info className="size-3.5 mt-0.5 shrink-0" />{KIND_NOTE[v?.kind ?? (c.id === 7 || c.id === 12 ? "pomodoro_total" : [13, 16].includes(c.id) ? "habit_days" : c.id === 17 ? "habit_and_pomodoro_days" : c.id === 18 ? "habit_days" : "self_report")]}</p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">Mukofot: {c.reward.name}</span>
                  {status === "active" && v?.kind === "self_report" && (
                    <Button size="sm" disabled={!v.canCheckIn || pending === c.id} onClick={() => act("checkin", c)}>{pending === c.id && <Loader2 className="animate-spin" />}{v.todayDone ? "Bugun belgilangan" : "Bugunni belgilash"}</Button>)}
                  {(!v || status === "expired") && !isDone && <Button size="sm" variant="outline" disabled={pending === c.id} onClick={() => setConfirm(c)}>{status === "expired" ? "Qayta boshlash" : "Boshlash"}</Button>}
                </div>
              </article>)
          })}
        </div>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && !pending && setConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.task}. Chelenj bugundan boshlanadi va {confirm?.durationDays} kun davom etadi. Muddat o'tib ketsa yoki kun o'tkazib yuborilsa, uni qayta boshlashga to'g'ri keladi.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="ghost" onClick={() => setConfirm(null)}>Bekor qilish</Button>
            <Button onClick={() => confirm && act("start", confirm)} disabled={pending !== null}>{pending !== null && <Loader2 className="animate-spin" />}Boshlash</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
