import type { TaskCategory, TaskPriority } from "@/lib/client-api"

export const CATEGORY_META: Record<TaskCategory, { label: string; dot: string; chip: string }> = {
  study: { label: "O'qish", dot: "bg-sky-400", chip: "bg-sky-500/10 text-sky-300 border-sky-500/20" },
  programming: { label: "Dasturlash", dot: "bg-violet-400", chip: "bg-violet-500/10 text-violet-300 border-violet-500/20" },
  health: { label: "Sog'liq", dot: "bg-emerald-400", chip: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  personal: { label: "Shaxsiy", dot: "bg-amber-400", chip: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  work: { label: "Ish", dot: "bg-cyan-400", chip: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20" },
  other: { label: "Boshqa", dot: "bg-slate-400", chip: "bg-slate-500/10 text-slate-300 border-slate-500/20" },
}
export const PRIORITY_META: Record<TaskPriority, { label: string; cls: string }> = {
  low: { label: "Past", cls: "text-slate-400" },
  medium: { label: "O'rta", cls: "text-amber-400" },
  high: { label: "Yuqori", cls: "text-red-400" },
}
export const REMINDER_LABEL: Record<number, string> = { 0: "Vaqtida", 5: "5 daqiqa oldin", 10: "10 daqiqa oldin", 15: "15 daqiqa oldin", 30: "30 daqiqa oldin", 60: "1 soat oldin" }
export const fmtDuration = (m: number | null) => (m == null ? "" : m < 60 ? `${m} daq` : `${Math.floor(m / 60)} soat${m % 60 ? ` ${m % 60} daq` : ""}`)
