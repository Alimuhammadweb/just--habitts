"use client"
import { Calendar, ChevronRight, ListChecks, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HabitCard } from "@/components/habit-card"
import type { Habit, DayStatus } from "@/types/user"
import type { Language } from "@/types/language"

interface Props {
  habits: Habit[]
  plannedCount: number
  language: Language
  onAdd: () => void
  onTemplates: () => void
  onPlanned: () => void
  onDelete: (id: number) => void
  onUpdateDay: (habitId: number, dayIndex: number, status: DayStatus | "none", reason?: string) => void
}

export function HabitsPage({ habits, plannedCount, language, onAdd, onTemplates, onPlanned, onDelete, onUpdateDay }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold tracking-tight">Odatlar</h2>
          <p className="text-sm text-muted-foreground">{habits.length ? `${habits.length} ta odat` : "Hali odat qo'shilmagan"}</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={onTemplates}><ListChecks />Shablonlar</Button><Button onClick={onAdd}><Plus />Odat qo'shish</Button></div>
      </div>
      {plannedCount > 0 && (
        <button onClick={onPlanned} className="flex w-full items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-left hover:bg-amber-500/15">
          <span className="flex items-center gap-2 text-sm font-medium text-amber-200"><Calendar className="size-4" />{plannedCount} ta rejalashtirilgan odat</span><ChevronRight className="size-4 text-amber-300" /></button>)}
      {habits.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 p-12 text-center"><ListChecks className="size-10 text-muted-foreground" />
          <div><p className="font-medium">Birinchi odatingizni qo'shing</p><p className="text-sm text-muted-foreground max-w-sm">O'zingiz yarating yoki tayyor shablonlardan tanlang. Har kuni belgilab borasiz.</p></div>
          <div className="flex gap-2"><Button variant="outline" onClick={onTemplates}>Shablonlar</Button><Button onClick={onAdd}><Plus />Qo'shish</Button></div></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {habits.map((h) => <HabitCard key={h.id} habit={h} onDelete={onDelete} onUpdateDay={onUpdateDay} language={language} />)}
        </div>
      )}
    </div>
  )
}
