"use client"
import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { LogOut, MoreHorizontal, Moon, PanelLeftClose, PanelLeftOpen, Shield, Sun, Timer, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { MOBILE_PRIMARY, NAV, type PageId } from "./nav"

export interface ShellUser { name: string; level: number; avatarUrl?: string; isAdmin: boolean }
interface Props {
  page: PageId
  onNavigate: (p: PageId) => void
  user: ShellUser
  isDark: boolean
  onToggleTheme: () => void
  onLogout: () => void
  onAdmin: () => void
  pomodoro?: { running: boolean; label: string }
  badges?: Partial<Record<PageId, boolean>>
  children: React.ReactNode
}

function Avatar({ user, size = 32 }: { user: ShellUser; size?: number }) {
  const initials = user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
  return user.avatarUrl && /^(https?:|data:)/.test(user.avatarUrl) ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full bg-primary/15 text-primary font-semibold flex items-center justify-center" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>
  )
}

export function AppShell({ page, onNavigate, user, isDark, onToggleTheme, onLogout, onAdmin, pomodoro, badges, children }: Props) {
  const reduce = useReducedMotion()
  const [collapsed, setCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => { try { setCollapsed(localStorage.getItem("sidebar-collapsed") === "1") } catch { /* e'tiborsiz */ } }, [])
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem("sidebar-collapsed", c ? "0" : "1") } catch { /* e'tiborsiz */ } return !c })
  const current = NAV.find((n) => n.id === page)

  const NavButton = ({ id, compact }: { id: PageId; compact?: boolean }) => {
    const item = NAV.find((n) => n.id === id)!
    const active = page === id
    const btn = (
      <button onClick={() => { onNavigate(id); setMoreOpen(false) }} aria-current={active ? "page" : undefined}
        className={cn("relative flex w-full items-center gap-3 rounded-lg px-3 h-10 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring",
          active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground", compact && "justify-center px-0")}>
        {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" />}
        <item.icon className="size-[18px] shrink-0" />
        {!compact && <span className="truncate">{item.label}</span>}
        {badges?.[id] && <span className="absolute right-2 top-2.5 size-2 rounded-full bg-red-500" aria-label="Yangi" />}
      </button>
    )
    return compact ? (
      <Tooltip><TooltipTrigger asChild>{btn}</TooltipTrigger><TooltipContent side="right">{item.label}</TooltipContent></Tooltip>
    ) : btn
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh app-backdrop">
        {/* Desktop sidebar */}
        <aside className={cn("hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col border-r border-sidebar-border bg-sidebar", collapsed ? "w-[72px]" : "w-64")} style={{ transition: "width 200ms ease" }}>
          <div className={cn("flex h-16 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
            <span className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0"><Zap className="size-4" /></span>
            {!collapsed && <span className="font-semibold tracking-tight">Just Habits</span>}
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1" aria-label="Asosiy navigatsiya">
            {NAV.filter((n) => n.group === "main").map((n) => <NavButton key={n.id} id={n.id} compact={collapsed} />)}
            <div className="my-3 border-t border-sidebar-border" />
            {NAV.filter((n) => n.group === "more").map((n) => <NavButton key={n.id} id={n.id} compact={collapsed} />)}
          </nav>
          <div className="border-t border-sidebar-border p-3 space-y-2">
            <button onClick={() => onNavigate("profile")} className={cn("flex w-full items-center gap-2.5 rounded-lg p-2 hover:bg-sidebar-accent/60", collapsed && "justify-center")}>
              <Avatar user={user} />
              {!collapsed && <span className="min-w-0 text-left"><span className="block truncate text-sm font-medium">{user.name}</span><span className="block text-xs text-muted-foreground">{user.level}-daraja</span></span>}
            </button>
            <Button variant="ghost" size="sm" className={cn("w-full text-muted-foreground", collapsed ? "px-0" : "justify-start")} onClick={toggleCollapsed} aria-label={collapsed ? "Menyuni kengaytirish" : "Menyuni yig'ish"}>
              {collapsed ? <PanelLeftOpen /> : <><PanelLeftClose />Yig'ish</>}
            </Button>
          </div>
        </aside>

        <div className={cn(collapsed ? "lg:pl-[72px]" : "lg:pl-64")} style={{ transition: "padding 200ms ease" }}>
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 sm:px-6">
              <span className="lg:hidden size-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center"><Zap className="size-4" /></span>
              <h1 className="text-base font-semibold truncate">{current?.label}</h1>
              <div className="ml-auto flex items-center gap-1">
                {pomodoro?.running && (
                  <button onClick={() => onNavigate("pomodoro")} className="mr-1 inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 h-8 text-xs font-mono text-red-300">
                    <Timer className="size-3.5" />{pomodoro.label}
                  </button>
                )}
                <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label={isDark ? "Yorug' rejim" : "Qorong'i rejim"}>{isDark ? <Sun /> : <Moon />}</Button>
                {user.isAdmin && <Button variant="ghost" size="icon" onClick={onAdmin} aria-label="Admin paneli"><Shield /></Button>}
                <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Chiqish"><LogOut /></Button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-5 pb-28 lg:pb-10">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={page} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.14 }}>
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Pastki navigatsiya">
          <ul className="mx-auto grid max-w-xl grid-cols-5">
            {MOBILE_PRIMARY.map((id) => { const n = NAV.find((x) => x.id === id)!; const active = page === id
              return (
                <li key={id}><button onClick={() => onNavigate(id)} aria-current={active ? "page" : undefined}
                  className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] focus-visible:ring-2 focus-visible:ring-ring", active ? "text-primary" : "text-muted-foreground")}>
                  <n.icon className="size-5" /><span>{n.label.replace("Haftalik reja", "Reja").replace("Bosh sahifa", "Bosh")}</span></button></li>)
            })}
            <li><button onClick={() => setMoreOpen(true)} className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px]", !MOBILE_PRIMARY.includes(page) ? "text-primary" : "text-muted-foreground")}>
              <MoreHorizontal className="size-5" /><span>Yana</span></button></li>
          </ul>
        </nav>
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <SheetHeader><SheetTitle>Bo'limlar</SheetTitle></SheetHeader>
            <div className="grid grid-cols-3 gap-2 p-4 pt-0">
              {NAV.filter((n) => !MOBILE_PRIMARY.includes(n.id)).map((n) => (
                <button key={n.id} onClick={() => { onNavigate(n.id); setMoreOpen(false) }}
                  className={cn("relative flex flex-col items-center gap-2 rounded-xl border p-3 min-h-[76px] text-xs", page === n.id ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                  <n.icon className="size-5" />{n.label}
                  {badges?.[n.id] && <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500" />}
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
