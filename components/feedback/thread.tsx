"use client"
import { useEffect, useRef, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { fmtDate } from "@/lib/admin-api"

export interface ThreadMessage { id: string; senderRole: "user" | "admin"; body: string; createdAt: string }

/** Suhbat xabarlari + javob maydoni (foydalanuvchi va admin tomonida bir xil). `mine` — qaysi rol "men". */
export function Thread({ messages, mine, onSend, disabled, disabledText }: { messages: ThreadMessage[]; mine: "user" | "admin"; onSend: (body: string) => Promise<void>; disabled?: boolean; disabledText?: string }) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }) }, [messages.length])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try { await onSend(body); setText("") } catch { /* xabarni chaqiruvchi ko'rsatadi; matn saqlanib qoladi */ } finally { setSending(false) }
  }
  return (
    <div className="flex flex-col gap-3">
      <ul className="space-y-2.5" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={cn("flex", m.senderRole === mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", m.senderRole === mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm")}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cn("mt-1 text-[10px]", m.senderRole === mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{m.senderRole === "admin" ? "Admin • " : ""}{fmtDate(m.createdAt)}</p>
            </div>
          </li>
        ))}
        <div ref={end} />
      </ul>
      {disabled ? <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{disabledText}</p> : (
        <div className="flex items-end gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Xabar yozing…" className="min-h-[44px] max-h-40" aria-label="Xabar"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send() } }} />
          <Button onClick={send} disabled={sending || !text.trim()} aria-label="Yuborish">{sending ? <Loader2 className="animate-spin" /> : <Send />}</Button>
        </div>
      )}
    </div>
  )
}
