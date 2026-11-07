"use client"
import { useState } from "react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NotificationSettings } from "@/components/notification-settings"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/types/user"
import type { Language } from "@/types/language"
import { deviceTimezone } from "@/lib/client-api"
import { resolveTimezone } from "@/lib/dates"

const ZONES = ["Asia/Tashkent", "Asia/Samarkand", "Asia/Almaty", "Asia/Bishkek", "Asia/Dushanbe", "Asia/Ashgabat", "Europe/Moscow", "Europe/Istanbul", "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Seoul", "America/New_York", "America/Los_Angeles", "UTC"]

interface Props {
  user: User; language: Language; isDark: boolean
  onLanguage: (l: Language) => void; onToggleTheme: () => void; onTimezone: (tz: string) => Promise<void>; onLogout: () => void
}

export function SettingsPage({ user, language, isDark, onLanguage, onToggleTheme, onTimezone, onLogout }: Props) {
  const { toast } = useToast()
  const tz = resolveTimezone(user.timezone)
  const device = deviceTimezone()
  const zones = Array.from(new Set([tz, ...(device ? [device] : []), ...ZONES]))
  const [saving, setSaving] = useState(false)
  async function changeTz(v: string) {
    setSaving(true)
    try { await onTimezone(v); toast({ title: "Vaqt zonasi yangilandi" }) } catch (e) { toast({ title: "Saqlab bo'lmadi", description: e instanceof Error ? e.message : undefined, variant: "destructive" }) } finally { setSaving(false) }
  }
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div><h2 className="text-2xl font-semibold tracking-tight">Sozlamalar</h2><p className="text-sm text-muted-foreground">Ko'rinish, vaqt va bildirishnomalar.</p></div>
      <section className="surface divide-y divide-border">
        <div className="flex items-center justify-between gap-4 p-4"><div><Label htmlFor="theme">Qorong'i rejim</Label><p className="text-xs text-muted-foreground">Tanlovingiz shu qurilmada saqlanadi.</p></div><Switch id="theme" checked={isDark} onCheckedChange={onToggleTheme} /></div>
        <div className="flex items-center justify-between gap-4 p-4"><div><Label>Vaqt zonasi</Label><p className="text-xs text-muted-foreground">Kunlar, seriyalar va reja shu zona bo'yicha hisoblanadi.</p></div>
          <Select value={tz} onValueChange={changeTz} disabled={saving}><SelectTrigger className="w-52" aria-label="Vaqt zonasi"><SelectValue /></SelectTrigger><SelectContent>{zones.map((z) => <SelectItem key={z} value={z}>{z.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-center justify-between gap-4 p-4"><div><Label>Eski bo'limlar tili</Label><p className="text-xs text-muted-foreground">Odat kartalari, do'stlar va jamiyat bo'limlari uchun.</p></div>
          <Select value={language} onValueChange={(v) => onLanguage(v as Language)}><SelectTrigger className="w-40" aria-label="Til"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="uz">O'zbekcha</SelectItem><SelectItem value="ru">Русский</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></div>
      </section>
      <section className="surface p-4"><NotificationSettings userId={user.id} language={language} userName={user.name} /></section>
      <Button variant="outline" onClick={onLogout}><LogOut />Hisobdan chiqish</Button>
    </div>
  )
}
