"use client"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { api, fmtDate, FEEDBACK_STATUS_LABEL, FEEDBACK_TYPE_LABEL } from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { Thread, type ThreadMessage } from "@/components/feedback/thread"
import { Empty, ErrorBox, Loading, Pager, Pill, selectCls } from "./shared"

interface Item { id: string; type: string; subject: string; status: string; adminUnread: boolean; lastMessageAt: string; messageCount: number; user: { id: number; name: string; email: string }; lastMessage: { body: string; senderRole: string } | null }
interface ThreadData { id: string; type: string; subject: string; status: string; createdAt: string; user: { id: number; name: string; email: string }; messages: ThreadMessage[] }
const statusTone = (s: string) => (s === "open" ? "warn" : s === "in_progress" ? "primary" : s === "resolved" ? "good" : "muted") as "warn" | "primary" | "good" | "muted"

export function FeedbackSection({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast()
  const [status, setStatus] = useState(""); const [type, setType] = useState(""); const [q, setQ] = useState(""); const [qd, setQd] = useState(""); const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: Item[]; total: number; pageSize: number; counts: Record<string, number> } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadData | null>(null)

  useEffect(() => { const t = setTimeout(() => { setQd(q.trim()); setPage(1) }, 300); return () => clearTimeout(t) }, [q])
  const load = useCallback(() => {
    setErr(null)
    const sp = new URLSearchParams({ page: String(page) }); if (status) sp.set("status", status); if (type) sp.set("type", type); if (qd) sp.set("q", qd)
    api<typeof data>(`/api/admin/feedback?${sp}`).then(setData).catch((e) => setErr(e.message))
  }, [page, status, type, qd])
  useEffect(load, [load])

  const open = useCallback((id: string) => {
    setOpenId(id); setThread(null)
    api<ThreadData>(`/api/admin/feedback/${id}`).then((t) => { setThread(t); load(); onChanged() }).catch((e) => toast({ title: "Ochib bo'lmadi", description: e.message, variant: "destructive" }))
  }, [load, onChanged, toast])

  async function reply(body: string) {
    if (!thread) return
    try {
      const r = await api<{ message: ThreadMessage; status: string }>(`/api/admin/feedback/${thread.id}`, { method: "POST", json: { body } })
      setThread({ ...thread, status: r.status, messages: [...thread.messages, r.message] }); load()
    } catch (e) { toast({ title: "Yuborilmadi", description: (e as Error).message, variant: "destructive" }); throw e }
  }
  async function setStatusTo(s: string) {
    if (!thread) return
    try { await api(`/api/admin/feedback/${thread.id}`, { method: "PATCH", json: { status: s } }); setThread({ ...thread, status: s }); load() }
    catch (e) { toast({ title: "Holat o'zgarmadi", description: (e as Error).message, variant: "destructive" }) }
  }

  const list = (
    <div className={cn("space-y-3", openId && "hidden lg:block")}>
      <div className="flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mavzu, ism yoki email" className="min-w-[180px] flex-1" aria-label="Qidirish" />
        <select className={selectCls} value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} aria-label="Tur"><option value="">Barcha tur</option>{Object.entries(FEEDBACK_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[["", "Hammasi"], ...Object.entries(FEEDBACK_STATUS_LABEL)].map(([k, v]) => (
          <button key={k} onClick={() => { setStatus(k); setPage(1) }} aria-pressed={status === k} className={cn("rounded-full px-3 h-8 text-xs font-medium", status === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{v}{k && data?.counts[k] ? ` (${data.counts[k]})` : ""}</button>
        ))}
      </div>
      {err ? <ErrorBox message={err} onRetry={load} /> : !data ? <Loading /> : !data.items.length ? <Empty text="Murojaatlar yo'q" /> : (
        <ul className="space-y-2">
          {data.items.map((f) => (
            <li key={f.id}><button onClick={() => open(f.id)} className={cn("w-full rounded-xl border bg-card p-3 text-left hover:border-primary/50", openId === f.id ? "border-primary" : "border-border")}>
              <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium">{f.adminUnread && <span className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle" aria-label="O'qilmagan" />}{f.subject}</span><Pill tone={statusTone(f.status)}>{FEEDBACK_STATUS_LABEL[f.status]}</Pill></div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{FEEDBACK_TYPE_LABEL[f.type]} • {f.user.name} • {fmtDate(f.lastMessageAt)}</p>
              {f.lastMessage && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{f.lastMessage.senderRole === "admin" ? "Siz: " : ""}{f.lastMessage.body}</p>}
            </button></li>
          ))}
        </ul>
      )}
      {data && <Pager page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </div>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      {list}
      <div className={cn(!openId && "hidden lg:block")}>
        {!openId ? <div className="rounded-xl border border-dashed border-border"><Empty text="Suhbatni ko'rish uchun murojaatni tanlang" /></div> : !thread ? <Loading /> : (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-start gap-2">
              <Button variant="ghost" size="icon" className="lg:hidden -ml-2" onClick={() => setOpenId(null)} aria-label="Orqaga"><ArrowLeft /></Button>
              <div className="min-w-0 flex-1"><h2 className="font-semibold">{thread.subject}</h2><p className="text-xs text-muted-foreground">{FEEDBACK_TYPE_LABEL[thread.type]} • {thread.user.name} ({thread.user.email}) • {fmtDate(thread.createdAt)}</p></div>
              <select className={selectCls} value={thread.status} onChange={(e) => setStatusTo(e.target.value)} aria-label="Holat">{Object.entries(FEEDBACK_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
            <Thread messages={thread.messages} mine="admin" onSend={reply} />
          </div>
        )}
      </div>
    </div>
  )
}
