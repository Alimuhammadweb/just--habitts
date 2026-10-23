"use client"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { DailyPoint, PeriodPoint } from "@/lib/stats/habit-stats"
import { dayMonth } from "@/lib/uz"

const C = { completed: "#34d399", partial: "#fbbf24", missed: "#f2677a", line: "#7c8cff" }
const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const

function TipBox({ active, payload, label, fmtLabel }: { active?: boolean; payload?: { payload: Record<string, number | string | boolean | null> }[]; label?: string; fmtLabel: (l: string) => string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as Record<string, number | boolean | null | string>
  const hasData = p.hasData !== false && ((p.due as number) || 0) + ((p.frozen as number) || 0) + ((p.pending as number) || 0) > 0
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium mb-1">{fmtLabel(String(label))}</p>
      {!hasData ? <p className="text-muted-foreground">Ma'lumot yo'q</p> : (
        <ul className="space-y-0.5 tabular">
          <li className="flex justify-between gap-4"><span style={{ color: C.completed }}>Bajarildi</span><span>{p.completed as number}</span></li>
          <li className="flex justify-between gap-4"><span style={{ color: C.partial }}>Qisman</span><span>{p.partial as number}</span></li>
          <li className="flex justify-between gap-4"><span style={{ color: C.missed }}>O'tkazildi</span><span>{p.missed as number}</span></li>
          {(p.frozen as number) > 0 && <li className="flex justify-between gap-4"><span className="text-sky-300">Muzlatilgan</span><span>{p.frozen as number}</span></li>}
          {(p.pending as number) > 0 && <li className="flex justify-between gap-4"><span className="text-muted-foreground">Kutilmoqda</span><span>{p.pending as number}</span></li>}
          <li className="flex justify-between gap-4 border-t border-border pt-1 mt-1"><span>Foiz</span><span>{p.rate == null ? "—" : `${p.rate}%`}</span></li>
        </ul>
      )}
    </div>
  )
}

/** Natijalar ustunli diagrammasi. Ma'lumot bo'lmagan kunlar bo'sh qoladi (0 emas). */
export function ResultsChart({ data, height = 220, label = (l) => dayMonth(l) }: { data: (DailyPoint | PeriodPoint)[]; height?: number; label?: (l: string) => string }) {
  const rows = data.map((d) => ({ ...d, key: "date" in d ? d.date : d.label }))
  return (
    <div style={{ height }} role="img" aria-label="Bajarilgan, qisman va o'tkazilgan kunlar diagrammasi">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="key" tickFormatter={(v) => label(String(v)).split("-")[0] + (rows.length <= 8 ? "" : "")} {...axis} interval="preserveStartEnd" minTickGap={14} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<TipBox fmtLabel={label} />} />
          <Bar dataKey="completed" stackId="a" fill={C.completed} radius={[0, 0, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="partial" stackId="a" fill={C.partial} isAnimationActive={false} />
          <Bar dataKey="missed" stackId="a" fill={C.missed} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Foiz chizig'i; ma'lumot yo'q nuqtalar uziladi (connectNulls=false). */
export function RateChart({ data, height = 220, label = (l) => dayMonth(l) }: { data: (DailyPoint | PeriodPoint)[]; height?: number; label?: (l: string) => string }) {
  const rows = data.map((d) => ({ ...d, key: "date" in d ? d.date : d.label }))
  return (
    <div style={{ height }} role="img" aria-label="Bajarish foizi chizig'i">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="key" tickFormatter={(v) => label(String(v))} {...axis} interval="preserveStartEnd" minTickGap={18} />
          <YAxis domain={[0, 100]} unit="%" {...axis} />
          <Tooltip content={<TipBox fmtLabel={label} />} />
          <Line type="monotone" dataKey="rate" stroke={C.line} strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {[["Bajarildi", C.completed], ["Qisman", C.partial], ["O'tkazildi", C.missed]].map(([n, c]) => (
        <li key={n} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: c }} />{n}</li>
      ))}
    </ul>
  )
}
