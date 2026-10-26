"use client"
import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/admin-api"
import { fmtDate } from "@/lib/admin-api"
import { ErrorBox, Loading, Pill, Stat } from "./shared"
import { Button } from "@/components/ui/button"

interface Overview {
  generatedAt: string
  users: { total: number; active: number; inactive: number; admins: number; google: number; newToday: number; new7: number; new30: number; active24h: number; active7d: number }
  registrations: { date: string; count: number }[]
  recent: { id: number; name: string; email: string; createdAt: string; isActive: boolean; provider: string }[]
  usage: { habits: number; completedDays: number; partialDays: number; missedDays: number; xpEvents7d: number; xp7d: number; pomodoros7d: number; weeklyTasks: number; weeklyTasksDone: number }
  community: { posts: number; comments: number; reactions: number }
  feedback: { open: number; unread: number }
}

export function OverviewSection({ onNavigate }: { onNavigate: (id: "users" | "feedback" | "community" | "monitoring") => void }) {
  const [d, setD] = useState<Overview | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => { setErr(null); api<Overview>("/api/admin/overview").then(setD).catch((e) => setErr(e.message)) }, [])
  useEffect(load, [load])
  if (err) return <ErrorBox message={err} onRetry={load} />
  if (!d) return <Loading />
  const max = Math.max(1, ...d.registrations.map((r) => r.count))
  const nf = (n: number) => n.toLocaleString("uz-UZ")

  return (
    <div className="space-y-6">
      <section aria-label="Foydalanuvchilar" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Jami foydalanuvchilar" value={nf(d.users.total)} hint={`${nf(d.users.active)} faol • ${nf(d.users.inactive)} bloklangan`} tone="primary" />
        <Stat label="Bugun ro'yxatdan o'tdi" value={nf(d.users.newToday)} hint={`7 kunda: ${nf(d.users.new7)} • 30 kunda: ${nf(d.users.new30)}`} />
        <Stat label="Faol (24 soat / 7 kun)" value={`${nf(d.users.active24h)} / ${nf(d.users.active7d)}`} hint="Kirish va sessiya yangilanishlari bo'yicha" tone="good" />
        <Stat label="Google bilan ulanganlar" value={nf(d.users.google)} hint={`${nf(d.users.admins)} ta admin`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card p-4" aria-label="Ro'yxatdan o'tishlar">
          <h2 className="text-sm font-semibold">So'nggi 14 kunda ro'yxatdan o'tganlar</h2>
          <div className="mt-4 flex h-40 items-end gap-1.5" role="img" aria-label="Kunlik ro'yxatdan o'tishlar diagrammasi">
            {d.registrations.map((r) => (
              <div key={r.date} className="group flex flex-1 flex-col items-center justify-end gap-1" title={`${r.date}: ${r.count}`}>
                <span className="text-[10px] text-muted-foreground tabular-nums">{r.count || ""}</span>
                <div className="w-full rounded-t bg-primary/70 group-hover:bg-primary" style={{ height: `${Math.max(3, (r.count / max) * 100)}%`, minHeight: 3 }} />
                <span className="text-[9px] text-muted-foreground">{r.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4" aria-label="So'nggi ro'yxatdan o'tganlar">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Yangi foydalanuvchilar</h2><Button variant="ghost" size="sm" onClick={() => onNavigate("users")}>Hammasi</Button></div>
          <ul className="mt-3 divide-y divide-border">
            {d.recent.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{u.name}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div>
                <div className="text-right"><p className="text-[11px] text-muted-foreground">{fmtDate(u.createdAt)}</p><div className="mt-0.5 flex justify-end gap-1">{u.provider === "google" && <Pill tone="primary">Google</Pill>}{u.provider === "telegram" && <Pill tone="primary">Telegram</Pill>}{!u.isActive && <Pill tone="bad">Bloklangan</Pill>}</div></div>
              </li>
            ))}
            {!d.recent.length && <li className="py-6 text-center text-sm text-muted-foreground">Hali foydalanuvchilar yo'q</li>}
          </ul>
        </section>
      </div>

      <section aria-label="Ilovadan foydalanish" className="space-y-3">
        <h2 className="text-sm font-semibold">Ilovadan foydalanish</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Odatlar (jami)" value={nf(d.usage.habits)} />
          <Stat label="Belgilangan kunlar" value={nf(d.usage.completedDays + d.usage.partialDays + d.usage.missedDays)} hint={`${nf(d.usage.completedDays)} bajarilgan • ${nf(d.usage.partialDays)} qisman • ${nf(d.usage.missedDays)} o'tkazilgan`} />
          <Stat label="7 kunda XP" value={nf(d.usage.xp7d)} hint={`${nf(d.usage.xpEvents7d)} ta belgilash`} />
          <Stat label="7 kunda pomodoro" value={nf(d.usage.pomodoros7d)} />
          <Stat label="Haftalik vazifalar" value={nf(d.usage.weeklyTasks)} hint={`${nf(d.usage.weeklyTasksDone)} bajarilgan`} />
          <Stat label="Jamiyat" value={nf(d.community.posts)} hint={`${nf(d.community.comments)} izoh • ${nf(d.community.reactions)} reaksiya`} />
          <button onClick={() => onNavigate("feedback")} className="text-left"><Stat label="Ochiq murojaatlar" value={nf(d.feedback.open)} hint={d.feedback.unread ? `${d.feedback.unread} ta o'qilmagan` : "Hammasi o'qilgan"} tone={d.feedback.unread ? "warn" : undefined} /></button>
          <button onClick={() => onNavigate("monitoring")} className="text-left"><Stat label="Tizim holati" value="Ko'rish" hint="Baza, sozlamalar, jurnal" /></button>
        </div>
        <p className="text-[11px] text-muted-foreground">Yangilandi: {fmtDate(d.generatedAt)}. “Faol” — oxirgi vaqtda tizimga kirgan yoki sessiyasi yangilangan foydalanuvchilar (ilova hozircha alohida sahifa-ko'rishlarni yig'maydi).</p>
      </section>
    </div>
  )
}
