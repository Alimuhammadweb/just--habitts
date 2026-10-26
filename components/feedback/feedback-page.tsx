"use client"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Bug, Lightbulb, Loader2, MessageSquare, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { api, fmtDate, FEEDBACK_STATUS_LABEL, FEEDBACK_TYPE_LABEL } from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { Thread, type ThreadMessage } from "./thread"

interface Item { id: string; type: string; subject: string; status: string; userUnread: boolean; lastMessageAt: string; lastMessage: ThreadMessage | null }
interface ThreadData { id: string; type: string; subject: string; status: string; messages: ThreadMessage[] }
const TYPES = [{ id: "feedback", icon: MessageSquare }, { id: "suggestion", icon: Lightbulb }, { id: "bug", icon: Bug }] as const

/** Oddiy foydalanuvchi uchun: fikr/taklif/xatolik yuborish va admin bilan shaxsiy yozishma. Admin huquqi KERAK EMAS. */
export function FeedbackPage({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const [items, setItems] = useState<Item[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<"list" | "new" | "thread">("list")
  const [thread, setThread] = useState<ThreadData | null>(null)
  const [form, setForm] = useState({ type: "feedback", subject: "", message: "" })
  const [sending, setSending] = useState(false)

  const load = useCallback(() => { setErr(null); api<{ items: Item[] }>("/api/feedback").then((r) => setItems(r.items)).catch((e) => setErr(e.message)) }, [])
  useEffect(load, [load])

  const open = (id: string) => {
    setView("thread"); setThread(null)
    api<ThreadData>(`/api/feedback/${id}`).then((t) => { setThread(t); load(); onChanged?.() }).catch((e) => { toast({ title: "Ochib bo'lmadi", description: e.message, variant: "destructive" }); setView("list") })
  }
  async function create() {
    setSending(true)
    try {
      const r = await api<{ id: string }>("/api/feedback", { method: "POST", json: form })
      toast({ title: "Yuborildi", description: "Admin javob bersa, shu yerda ko'rasiz." })
      setForm({ type: "feedback", subject: "", message: "" }); load(); open(r.id)
    } catch (e) { toast({ title: "Yuborilmadi", description: (e as Error).message, variant: "destructive" }) } finally { setSending(false) }
  }
  async function reply(body: string) {
    if (!thread) return
    try {
      const m = await api<ThreadMessage>(`/api/feedback/${thread.id}`, { method: "POST", json: { body } })
      setThread({ ...thread, messages: [...thread.messages, m] }); load()
    } catch (e) { toast({ title: "Yuborilmadi", description: (e as Error).message, variant: "destructive" }); throw e }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {view === "list" && (
        <>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-muted-foreground">Fikr, taklif yoki xatolik haqida yozing — javobni shu yerda ko'rasiz. Xabarlaringizni faqat siz va administrator ko'ra oladi.</p>
            <Button onClick={() => setView("new")}><Plus />Yangi</Button>
          </div>
          {err ? <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{err}</div>
            : !items ? <div className="flex justify-center py-12"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
            : !items.length ? <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Hali murojaat yubormagansiz</div>
            : <ul className="space-y-2">{items.map((f) => (
              <li key={f.id}><button onClick={() => open(f.id)} className="w-full rounded-xl border border-border bg-card p-3 text-left hover:border-primary/50">
                <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-medium">{f.userUnread && <span className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle" aria-label="Yangi javob" />}{f.subject}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{FEEDBACK_STATUS_LABEL[f.status]}</span></div>
                <p className="mt-0.5 text-xs text-muted-foreground">{FEEDBACK_TYPE_LABEL[f.type]} • {fmtDate(f.lastMessageAt)}</p>
                {f.lastMessage && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{f.lastMessage.senderRole === "admin" ? "Admin: " : "Siz: "}{f.lastMessage.body}</p>}
              </button></li>))}</ul>}
        </>
      )}

      {view === "new" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="-ml-2" onClick={() => setView("list")} aria-label="Orqaga"><ArrowLeft /></Button><h2 className="font-semibold">Yangi murojaat</h2></div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tur">
            {TYPES.map((t) => (
              <button key={t.id} role="radio" aria-checked={form.type === t.id} onClick={() => setForm({ ...form, type: t.id })}
                className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium", form.type === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                <t.icon className="size-4" />{FEEDBACK_TYPE_LABEL[t.id]}</button>))}
          </div>
          <div className="space-y-1.5"><Label htmlFor="fb-subject">Mavzu</Label><Input id="fb-subject" value={form.subject} maxLength={120} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="fb-msg">Xabar</Label><Textarea id="fb-msg" value={form.message} maxLength={4000} className="min-h-[140px]" onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={form.type === "bug" ? "Nima qildingiz, nima bo'ldi va nima kutgan edingiz?" : "Fikringizni yozing…"} /></div>
          <Button className="w-full" disabled={sending || form.subject.trim().length < 3 || form.message.trim().length < 3} onClick={create}>{sending && <Loader2 className="animate-spin" />}Yuborish</Button>
        </div>
      )}

      {view === "thread" && (
        !thread ? <div className="flex justify-center py-12"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div> : (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="-ml-2" onClick={() => { setView("list"); load() }} aria-label="Orqaga"><ArrowLeft /></Button>
              <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{thread.subject}</h2><p className="text-xs text-muted-foreground">{FEEDBACK_TYPE_LABEL[thread.type]} • {FEEDBACK_STATUS_LABEL[thread.status]}</p></div></div>
            <Thread messages={thread.messages} mine="user" onSend={reply} disabled={thread.status === "closed"} disabledText="Bu murojaat yopilgan. Yangi murojaat yuborishingiz mumkin." />
          </div>)
      )}
    </div>
  )
}
