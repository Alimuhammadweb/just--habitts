"use client"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TaskInput, WeeklyTask, TaskCategory, TaskPriority } from "@/lib/client-api"
import { CATEGORY_META, PRIORITY_META, REMINDER_LABEL } from "./task-meta"
import { isValidDateKey } from "@/lib/dates"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: WeeklyTask | null
  defaultDate: string
  onSubmit: (input: TaskInput) => Promise<void>
}

const DURATIONS = [15, 30, 45, 60, 90, 120]

export function TaskDialog({ open, onOpenChange, task, defaultDate, onSubmit }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState("")
  const [duration, setDuration] = useState<string>("none")
  const [category, setCategory] = useState<TaskCategory>("other")
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [reminder, setReminder] = useState<string>("none")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null); setSaving(false)
    setTitle(task?.title ?? ""); setDescription(task?.description ?? "")
    setDate(task?.date ?? defaultDate); setTime(task?.time ?? "")
    setDuration(task?.durationMin ? String(task.durationMin) : "none")
    setCategory(task?.category ?? "other"); setPriority(task?.priority ?? "medium")
    setReminder(task?.reminderMin != null ? String(task.reminderMin) : "none")
  }, [open, task, defaultDate])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError("Vazifa nomini kiriting")
    if (!isValidDateKey(date)) return setError("Sanani tanlang")
    if (reminder !== "none" && !time) return setError("Eslatma uchun vaqt belgilang")
    setSaving(true); setError(null)
    try {
      await onSubmit({
        title: title.trim(), description: description.trim(), date, time: time || null,
        durationMin: duration === "none" ? null : Number(duration), category, priority,
        reminderMin: reminder === "none" ? null : Number(reminder),
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlab bo'lmadi")
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Vazifani tahrirlash" : "Yangi vazifa"}</DialogTitle>
          <DialogDescription>Kun va vaqtni belgilang. Vazifa o'zi bajarilgan deb belgilanmaydi.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Nomi</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus placeholder="Masalan: Algebra mashqlari" aria-invalid={!!error && !title.trim()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Izoh <span className="text-muted-foreground font-normal">(ixtiyoriy)</span></Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-date">Sana</Label>
              <Input id="t-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-time">Vaqt</Label>
              <Input id="t-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Davomiyligi</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belgilanmagan</SelectItem>
                  {DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{d < 60 ? `${d} daqiqa` : `${d / 60} soat`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Muhimlik</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Turkum</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Turkum">
              {(Object.keys(CATEGORY_META) as TaskCategory[]).map((c) => (
                <button type="button" key={c} role="radio" aria-checked={category === c} onClick={() => setCategory(c)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 h-9 text-sm ${category === c ? CATEGORY_META[c].chip + " ring-1 ring-current" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  <span className={`size-2 rounded-full ${CATEGORY_META[c].dot}`} />{CATEGORY_META[c].label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Eslatma</Label>
            <Select value={reminder} onValueChange={setReminder}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Eslatmasiz</SelectItem>
                {Object.entries(REMINDER_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Eslatma faqat Just Habits brauzerda ochiq turganda ishlaydi.</p>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Bekor qilish</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}{task ? "Saqlash" : "Qo'shish"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
