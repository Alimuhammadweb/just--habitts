"use client"
import { useCallback, useEffect, useState } from "react"
import { Search, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { api, AUDIT_LABEL, fmtDate, fmtDay } from "@/lib/admin-api"
import { Empty, ErrorBox, Loading, Pager, Pill, selectCls } from "./shared"

interface Row { id: number; name: string; email: string; createdAt: string; lastLoginAt: string | null; isActive: boolean; isAdmin: boolean; provider: string; totalXP: number; level: number; streak: number; habits: number }
interface Detail {
  id: number; name: string; email: string; firstName: string | null; lastName: string | null; timezone: string | null; createdAt: string; lastLoginAt: string | null
  isActive: boolean; isAdmin: boolean; provider: string; publicProfile: boolean
  xp: { total: number; level: number; weekly: number; monthly: number }
  stats: { completedDays: number; currentStreak: number; longestStreak: number; pomodoros: number }
  counts: { habits: number; weeklyTasks: number; feedback: number; friends: number; posts: number; comments: number; activeSessions: number }
  history: { id: number; action: string; actorName: string; createdAt: string }[]
}
type Confirm = { kind: "active" | "admin"; value: boolean } | null

export function UsersSection({ meId }: { meId: number }) {
  const { toast } = useToast()
  const [q, setQ] = useState(""); const [qDebounced, setQd] = useState("")
  const [status, setStatus] = useState(""); const [role, setRole] = useState(""); const [provider, setProvider] = useState(""); const [sort, setSort] = useState("newest")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ users: Row[]; total: number; pageSize: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { const t = setTimeout(() => { setQd(q.trim()); setPage(1) }, 300); return () => clearTimeout(t) }, [q])
  const load = useCallback(() => {
    setErr(null)
    const sp = new URLSearchParams({ page: String(page), sort })
    if (qDebounced) sp.set("q", qDebounced); if (status) sp.set("status", status); if (role) sp.set("role", role); if (provider) sp.set("provider", provider)
    api<{ users: Row[]; total: number; pageSize: number }>(`/api/admin/users?${sp}`).then(setData).catch((e) => setErr(e.message))
  }, [page, sort, qDebounced, status, role, provider])
  useEffect(load, [load])

  const loadDetail = useCallback((id: number) => { setDetail(null); api<Detail>(`/api/admin/users/${id}`).then(setDetail).catch((e) => toast({ title: "Yuklab bo'lmadi", description: e.message, variant: "destructive" })) }, [toast])
  useEffect(() => { if (openId != null) loadDetail(openId) }, [openId, loadDetail])

  async function apply() {
    if (!confirm || !detail) return
    setBusy(true)
    try {
      await api(`/api/admin/users/${detail.id}`, { method: "PATCH", json: confirm.kind === "active" ? { isActive: confirm.value } : { isAdmin: confirm.value } })
      toast({ title: "Saqlandi" }); setConfirm(null); loadDetail(detail.id); load()
    } catch (e) { toast({ title: "Bajarilmadi", description: (e as Error).message, variant: "destructive" }) } finally { setBusy(false) }
  }
  const self = detail?.id === meId

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, email yoki ID bo'yicha qidirish" className="pl-9" aria-label="Qidirish" /></div>
        <select className={selectCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Holat"><option value="">Barcha holat</option><option value="active">Faol</option><option value="inactive">Bloklangan</option></select>
        <select className={selectCls} value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }} aria-label="Rol"><option value="">Barcha rol</option><option value="user">Foydalanuvchi</option><option value="admin">Admin</option></select>
        <select className={selectCls} value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1) }} aria-label="Kirish usuli"><option value="">Barcha usul</option><option value="password">Parol</option><option value="google">Google</option><option value="telegram">Telegram</option></select>
        <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash"><option value="newest">Yangilari avval</option><option value="oldest">Eskilari avval</option><option value="login">Oxirgi kirish</option><option value="xp">XP bo'yicha</option></select>
      </div>

      {err ? <ErrorBox message={err} onRetry={load} /> : !data ? <Loading /> : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Foydalanuvchi</th><th className="px-4 py-2.5 font-medium">Ro'yxatdan o'tgan</th><th className="px-4 py-2.5 font-medium hidden md:table-cell">Oxirgi kirish</th><th className="px-4 py-2.5 font-medium hidden lg:table-cell">Odatlar / XP</th><th className="px-4 py-2.5 font-medium">Holat</th></tr></thead>
              <tbody className="divide-y divide-border">
                {data.users.map((u) => (
                  <tr key={u.id} tabIndex={0} onClick={() => setOpenId(u.id)} onKeyDown={(e) => e.key === "Enter" && setOpenId(u.id)} className="cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 outline-none">
                    <td className="px-4 py-3"><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDay(u.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap hidden md:table-cell">{fmtDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{u.habits} • {u.totalXP} XP (L{u.level})</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{u.isAdmin && <Pill tone="primary">Admin</Pill>}<Pill tone={u.isActive ? "good" : "bad"}>{u.isActive ? "Faol" : "Bloklangan"}</Pill>{u.provider === "google" && <Pill>Google</Pill>}{u.provider === "telegram" && <Pill>Telegram</Pill>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.users.length && <Empty text="Mos foydalanuvchi topilmadi" />}
          <div className="px-4 pb-3"><Pager page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} /></div>
        </div>
      )}

      <Sheet open={openId != null} onOpenChange={(o) => { if (!o) { setOpenId(null); setDetail(null) } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>{detail?.name ?? "Yuklanmoqda…"}</SheetTitle><SheetDescription>{detail?.email}</SheetDescription></SheetHeader>
          {!detail ? <Loading /> : (
            <div className="space-y-5 px-4 pb-6 text-sm">
              <div className="flex flex-wrap gap-1.5">{detail.isAdmin && <Pill tone="primary">Admin</Pill>}<Pill tone={detail.isActive ? "good" : "bad"}>{detail.isActive ? "Faol" : "Bloklangan"}</Pill><Pill>{detail.provider === "google" ? "Google" : detail.provider === "telegram" ? "Telegram" : "Parol"}</Pill></div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {([["ID", detail.id], ["Ro'yxatdan o'tgan", fmtDate(detail.createdAt)], ["Oxirgi kirish", fmtDate(detail.lastLoginAt)], ["Vaqt zonasi", detail.timezone ?? "—"], ["Faol sessiyalar", detail.counts.activeSessions], ["Ochiq profil", detail.publicProfile ? "Ha" : "Yo'q"],
                  ["XP / daraja", `${detail.xp.total} / ${detail.xp.level}`], ["Hozirgi / eng uzun seriya", `${detail.stats.currentStreak} / ${detail.stats.longestStreak}`], ["Odatlar", detail.counts.habits], ["Bajarilgan kunlar", detail.stats.completedDays],
                  ["Haftalik vazifalar", detail.counts.weeklyTasks], ["Pomodoro", detail.stats.pomodoros], ["Do'stlar", detail.counts.friends], ["Post / izoh", `${detail.counts.posts} / ${detail.counts.comments}`], ["Murojaatlar", detail.counts.feedback]] as [string, React.ReactNode][]).map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>))}
              </dl>
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">Hisobni boshqarish</p>
                {self && <p className="text-xs text-muted-foreground">O'z hisobingizning holati yoki rolini bu yerdan o'zgartirib bo'lmaydi.</p>}
                <div className="flex flex-wrap gap-2">
                  {detail.isActive
                    ? <Button variant="destructive" size="sm" disabled={self || detail.isAdmin} onClick={() => setConfirm({ kind: "active", value: false })}><UserX />Bloklash</Button>
                    : <Button size="sm" disabled={self} onClick={() => setConfirm({ kind: "active", value: true })}><UserCheck />Faollashtirish</Button>}
                  {detail.isAdmin
                    ? <Button variant="outline" size="sm" disabled={self} onClick={() => setConfirm({ kind: "admin", value: false })}><ShieldOff />Adminlikni olib tashlash</Button>
                    : <Button variant="outline" size="sm" disabled={self || !detail.isActive} onClick={() => setConfirm({ kind: "admin", value: true })}><ShieldCheck />Admin qilish</Button>}
                </div>
                {detail.isAdmin && detail.isActive && !self && <p className="text-xs text-muted-foreground">Admin hisobini bloklash uchun avval adminlikni olib tashlang.</p>}
              </div>
              {!!detail.history.length && (
                <div className="space-y-2 border-t border-border pt-4"><p className="text-xs font-medium text-muted-foreground">Admin amallari tarixi</p>
                  <ul className="space-y-1.5">{detail.history.map((h) => <li key={h.id} className="flex justify-between gap-2 text-xs"><span>{AUDIT_LABEL[h.action] ?? h.action} — {h.actorName}</span><span className="text-muted-foreground whitespace-nowrap">{fmtDate(h.createdAt)}</span></li>)}</ul></div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "admin" ? (confirm.value ? "Admin huquqini berasizmi?" : "Adminlikni olib tashlaysizmi?") : confirm?.value ? "Hisobni faollashtirasizmi?" : "Hisobni bloklaysizmi?"}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.kind === "admin" ? (confirm.value ? "Bu foydalanuvchi barcha foydalanuvchi ma'lumotlarini ko'ra va boshqara oladi. Faqat ishonchli odamga bering." : "Foydalanuvchi oddiy hisobga o'tadi va admin paneliga kira olmaydi.") : confirm?.value ? "Foydalanuvchi yana tizimga kira oladi." : "Foydalanuvchi tizimdan chiqariladi va qayta kira olmaydi. Ma'lumotlari o'chirilmaydi."} Amal jurnalga yoziladi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Bekor qilish</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); apply() }}>Tasdiqlash</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
