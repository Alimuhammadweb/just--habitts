"use client"
import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { api, AUDIT_LABEL, fmtDate } from "@/lib/admin-api"
import { Empty, ErrorBox, Loading, Pager, Stat } from "./shared"

interface System { serverTime: string; node: string; env: string; database: { ok: boolean; latencyMs: number; migrations: number | null; lastMigration: string | null }; features: Record<string, boolean>; housekeeping: { expiredRefreshTokens: number | null; rateLimitRows: number | null } }
interface Audit { total: number; page: number; pageSize: number; items: { id: number; action: string; actorName: string; actorId: number; targetType: string | null; targetId: string | null; createdAt: string; meta: Record<string, unknown> }[] }
const FEATURES: [string, string, string][] = [
  ["googleSignIn", "Google bilan kirish", "GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET"],
  ["passwordReset", "Parolni tiklash (email)", "RESEND_API_KEY, RESEND_FROM, APP_URL"],
  ["weeklyEmailCron", "Haftalik email (cron)", "CRON_SECRET"],
  ["envAdminLogin", "Admin kirishi (.env)", "ADMIN_EMAIL va ADMIN_PASSWORD"],
  ["appUrl", "APP_URL", "Google/Resend havolalari uchun"],
]

export function MonitoringSection() {
  const [sys, setSys] = useState<System | null>(null); const [sysErr, setSysErr] = useState<string | null>(null)
  const [audit, setAudit] = useState<Audit | null>(null); const [auditErr, setAuditErr] = useState<string | null>(null); const [page, setPage] = useState(1)
  useEffect(() => { api<System>("/api/admin/system").then(setSys).catch((e) => setSysErr(e.message)) }, [])
  const loadAudit = useCallback(() => { setAuditErr(null); api<Audit>(`/api/admin/audit?page=${page}`).then(setAudit).catch((e) => setAuditErr(e.message)) }, [page])
  useEffect(loadAudit, [loadAudit])

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-label="Tizim holati">
        <h2 className="text-sm font-semibold">Tizim holati</h2>
        {sysErr ? <ErrorBox message={sysErr} /> : !sys ? <Loading /> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Ma'lumotlar bazasi" value={sys.database.ok ? "Ishlayapti" : "Xato"} hint={`${sys.database.latencyMs} ms`} tone={sys.database.ok ? "good" : "warn"} />
              <Stat label="Migratsiyalar" value={sys.database.migrations ?? "—"} hint={sys.database.lastMigration ?? undefined} />
              <Stat label="Muddati o'tgan tokenlar" value={sys.housekeeping.expiredRefreshTokens ?? "—"} hint="Vaqti-vaqti bilan avtomatik tozalanadi" />
              <Stat label="Server" value={sys.node} hint={`${sys.env} • ${fmtDate(sys.serverTime)}`} />
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {FEATURES.map(([k, label, hint]) => (
                <li key={k} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  {sys.features[k] ? <CheckCircle2 className="size-4 text-emerald-400" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className="flex-1">{label}</span><span className="text-xs text-muted-foreground hidden sm:inline">{sys.features[k] ? "Sozlangan" : `Sozlanmagan — ${hint}`}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-3" aria-label="Admin amallari jurnali">
        <h2 className="text-sm font-semibold">Admin amallari jurnali</h2>
        {auditErr ? <ErrorBox message={auditErr} onRetry={loadAudit} /> : !audit ? <Loading /> : !audit.items.length ? <Empty text="Hali amallar yozilmagan" /> : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Vaqt</th><th className="px-4 py-2.5 font-medium">Admin</th><th className="px-4 py-2.5 font-medium">Amal</th><th className="px-4 py-2.5 font-medium hidden md:table-cell">Obyekt</th></tr></thead>
              <tbody className="divide-y divide-border">{audit.items.map((a) => (
                <tr key={a.id}><td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{fmtDate(a.createdAt)}</td><td className="px-4 py-2.5">{a.actorName}</td><td className="px-4 py-2.5">{AUDIT_LABEL[a.action] ?? a.action}</td><td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{a.targetType ? `${a.targetType} #${a.targetId}` : "—"}</td></tr>))}</tbody>
            </table></div>
            <div className="px-4 pb-3"><Pager page={page} pageSize={audit.pageSize} total={audit.total} onPage={setPage} /></div>
          </div>
        )}
      </section>
    </div>
  )
}
