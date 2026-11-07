"use client"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const selectCls = "h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function Loading({ label = "Yuklanmoqda…" }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{label}</div>
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
      <span className="flex-1">{message}</span>{onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw />Qayta urinish</Button>}
    </div>
  )
}
export function Empty({ text }: { text: string }) { return <div className="py-12 text-center text-sm text-muted-foreground">{text}</div> }

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "primary" | "good" | "warn" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "primary" && "text-primary", tone === "good" && "text-emerald-400", tone === "warn" && "text-amber-400")}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "good" | "bad" | "primary" | "warn" }) {
  const t = { muted: "bg-muted text-muted-foreground", good: "bg-emerald-500/15 text-emerald-300", bad: "bg-red-500/15 text-red-300", primary: "bg-primary/15 text-primary", warn: "bg-amber-500/15 text-amber-300" }[tone]
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", t)}>{children}</span>
}
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
      <span>Jami: {total}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Oldingi</Button>
        <span>{page} / {pages}</span>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Keyingi</Button>
      </div>
    </div>
  )
}
