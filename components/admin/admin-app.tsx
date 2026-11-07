"use client"
import { useCallback, useEffect, useState } from "react"
import { Activity, ArrowLeft, LayoutDashboard, LifeBuoy, LogOut, MessageSquare, Shield, Users, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { api } from "@/lib/admin-api"
import type { User } from "@/types/user"
import { OverviewSection } from "./overview"
import { UsersSection } from "./users"
import { CommunitySection } from "./community"
import { FeedbackSection } from "./feedback"
import { MonitoringSection } from "./monitoring"

const SECTIONS = [
  { id: "overview", label: "Umumiy ko'rinish", icon: LayoutDashboard },
  { id: "users", label: "Foydalanuvchilar", icon: Users },
  { id: "community", label: "Jamiyat postlari", icon: MessageSquare },
  { id: "feedback", label: "Murojaatlar", icon: LifeBuoy },
  { id: "monitoring", label: "Monitoring", icon: Activity },
] as const
type SectionId = (typeof SECTIONS)[number]["id"]
const isSection = (v: string): v is SectionId => SECTIONS.some((s) => s.id === v)

export function AdminApp() {
  const [section, setSection] = useState<SectionId>("overview")
  const [me, setMe] = useState<User | null>(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const read = () => { const h = location.hash.slice(1); setSection(isSection(h) ? h : "overview") }
    read(); window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
  }, [])
  useEffect(() => { api<User>("/api/auth/me").then(setMe).catch(() => {}) }, [])

  const refreshUnread = useCallback(() => {
    api<{ items: unknown[]; total: number }>("/api/admin/feedback?unread=1&pageSize=1").then((r) => setUnread(r.total)).catch(() => {})
  }, [])
  useEffect(() => { refreshUnread(); const t = setInterval(refreshUnread, 60_000); return () => clearInterval(t) }, [refreshUnread])

  const go = (id: SectionId) => { setSection(id); if (location.hash !== `#${id}`) history.pushState(null, "", `#${id}`) }
  const logout = () => {
    try { ["sessionUserId", "sessionAdmin", "sessionUser"].forEach((k) => localStorage.removeItem(k)) } catch { /* e'tiborsiz */ }
    fetch("/api/auth/logout", { method: "POST" }).finally(() => location.assign("/"))
  }
  const current = SECTIONS.find((s) => s.id === section)!

  return (
    <div className="min-h-dvh app-backdrop">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-16 items-center gap-2 px-4">
          <span className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Shield className="size-4" /></span>
          <div className="leading-tight"><span className="block font-semibold tracking-tight">Just Habits</span><span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Admin paneli</span></div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1" aria-label="Admin navigatsiyasi">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => go(s.id)} aria-current={section === s.id ? "page" : undefined}
              className={cn("relative flex w-full items-center gap-3 rounded-lg px-3 h-10 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring",
                section === s.id ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
              {section === s.id && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" />}
              <s.icon className="size-[18px] shrink-0" /><span className="truncate">{s.label}</span>
              {s.id === "feedback" && unread > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{unread}</span>}
            </button>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3 space-y-1">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => location.assign("/")}><ArrowLeft />Foydalanuvchi ilovasi</Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={logout}><LogOut />Chiqish</Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="mx-auto flex h-14 max-w-[1300px] items-center gap-2 px-4 sm:px-6">
            <span className="lg:hidden size-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center"><Zap className="size-4" /></span>
            <h1 className="text-base font-semibold truncate">{current.label}</h1>
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden sm:inline truncate max-w-[200px]">{me?.name ?? ""}</span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Admin</span>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => location.assign("/")} aria-label="Foydalanuvchi ilovasi"><ArrowLeft /></Button>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={logout} aria-label="Chiqish"><LogOut /></Button>
            </div>
          </div>
          <nav className="lg:hidden flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Admin bo'limlari">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => go(s.id)} aria-current={section === s.id ? "page" : undefined}
                className={cn("shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium", section === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <s.icon className="size-3.5" />{s.label}{s.id === "feedback" && unread > 0 && <span className="ml-0.5">({unread})</span>}
              </button>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-[1300px] px-4 sm:px-6 py-5 pb-16">
          {section === "overview" && <OverviewSection onNavigate={go} />}
          {section === "users" && <UsersSection meId={me?.id ?? -1} />}
          {section === "community" && <CommunitySection />}
          {section === "feedback" && <FeedbackSection onChanged={refreshUnread} />}
          {section === "monitoring" && <MonitoringSection />}
        </main>
      </div>
    </div>
  )
}
