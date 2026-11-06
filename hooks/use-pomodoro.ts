"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, pomodoroAct, pomodoroGet, pomodoroSaveSettings, type PomodoroAction, type PomodoroResponse } from "@/lib/client-api"
import { DEFAULT_SETTINGS, durationFor, type PomodoroMode, type PomodoroSettingsData, type PomodoroState } from "@/lib/pomodoro"
import type { User } from "@/types/user"

interface Options {
  enabled: boolean
  /** Server yangilangan foydalanuvchini qaytarganda (seans hisoblangach: statistika, vazifalar, chelenjlar) */
  onUser: (u: User) => void
  /** Taymer yakunlanganda (fokus hisoblandi / tanaffus tugadi) */
  onCompleted: (c: { mode: PomodoroMode; credited: boolean }) => void
  onError: (message: string) => void
}

/**
 * Pomodoro taymeri. HAQIQAT MANBAI — server (PostgreSQL): u faol taymerning qolgan vaqtini beradi.
 * Mijozda `setInterval` faqat ekranni yangilaydi: ko'rsatiladigan vaqt har safar
 * (serverdan kelgan qolgan vaqt) − (kelganidan beri o'tgan haqiqiy vaqt) formulasi bilan qayta hisoblanadi,
 * shuning uchun brauzer fondagi tabni sekinlashtirsa ham, sahifa yangilansa ham vaqt to'g'ri qoladi.
 */
export function usePomodoro({ enabled, onUser, onCompleted, onError }: Options) {
  const [snap, setSnap] = useState<{ state: PomodoroState; at: number } | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<PomodoroMode>("focus")
  const [, force] = useState(0)

  const cb = useRef({ onUser, onCompleted, onError })
  cb.current = { onUser, onCompleted, onError }
  const busyRef = useRef(false)
  const completing = useRef<string | null>(null)
  const lastRefresh = useRef(0)

  const apply = useCallback((res: PomodoroResponse) => {
    setSnap({ state: res.state, at: Date.now() })
    if (res.user) cb.current.onUser(res.user)
    if (res.completed) {
      cb.current.onCompleted({ mode: res.completed.mode, credited: res.completed.credited })
      setSelected(res.completed.mode === "focus" ? res.state.suggestedBreak : "focus")
    }
    // Faol taymer bo'lsa tanlangan rejim uning rejimi bilan mos bo'lsin
    if (res.state.active) setSelected(res.state.active.mode)
  }, [])

  const refresh = useCallback(async (force = false) => {
    if (!enabled) return
    const now = Date.now()
    if (!force && now - lastRefresh.current < 1500) return
    lastRefresh.current = now
    try { apply(await pomodoroGet()) }
    catch (e) { if (!(e instanceof ApiError && e.status === 401)) console.warn("[pomodoro]", e instanceof Error ? e.message : e) }
    finally { setLoading(false) }
  }, [enabled, apply])

  // Boshlang'ich yuklash + sahifa/tab qaytganda qayta sinxronlash
  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    try { Object.keys(localStorage).filter((k) => k.startsWith("timer_")).forEach((k) => localStorage.removeItem(k)) } catch { /* eski brauzer kaliti */ }
    refresh(true)
    const onVisible = () => { if (document.visibilityState === "visible") refresh() }
    const onFocus = () => refresh()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    window.addEventListener("online", onFocus)
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus) }
  }, [enabled, refresh])

  const state = snap?.state ?? null
  const active = state?.active ?? null
  const settings: PomodoroSettingsData = state?.settings ?? DEFAULT_SETTINGS
  const running = active?.status === "running"

  const remainingMs = active
    ? running ? Math.max(0, active.remainingMs - (Date.now() - (snap?.at ?? Date.now()))) : active.remainingMs
    : durationFor(selected, settings) * 1000

  // Ekranni yangilash (vaqt hisobi timestamp'dan; bu faqat qayta chizish uchun)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [running])

  const act = useCallback(async (body: PomodoroAction) => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true)
    try { apply(await pomodoroAct(body)) }
    catch (e) {
      if (e instanceof ApiError && (e.code === "ACTIVE_RUN" || e.code === "NOT_DUE" || e.code === "CANCELLED" || e.status === 404)) await refresh(true)
      else cb.current.onError(e instanceof Error ? e.message : "Noma'lum xato")
    } finally { busyRef.current = false; setBusy(false) }
  }, [apply, refresh])

  // Vaqt tugaganda serverdan yakunlashni so'raymiz. Server o'z soati bilan tekshiradi va faqat bir marta hisoblaydi.
  useEffect(() => {
    if (!active || !running || remainingMs > 0 || completing.current === active.id) return
    const id = active.id
    completing.current = id
    pomodoroAct({ action: "complete", id })
      .then(apply)
      .catch(async (e) => {
        if (!(e instanceof ApiError && e.code === "NOT_DUE")) cb.current.onError(e instanceof Error ? e.message : "Seansni yakunlab bo'lmadi")
        await refresh(true)
        setTimeout(() => { if (completing.current === id) completing.current = null }, e instanceof ApiError && e.code === "NOT_DUE" ? 500 : 3000)
      })
  })

  const start = useCallback(() => act({ action: "start", mode: selected }), [act, selected])
  const pause = useCallback(() => active && act({ action: "pause", id: active.id }), [act, active])
  const resume = useCallback(() => active && act({ action: "resume", id: active.id }), [act, active])
  const reset = useCallback(() => active && act({ action: "reset", id: active.id }), [act, active])

  const saveSettings = useCallback(async (patch: Partial<PomodoroSettingsData>) => {
    const r = await pomodoroSaveSettings(patch) // xatoni chaqiruvchi ko'rsatadi (inline)
    setSnap((p) => p && { ...p, state: { ...p.state, settings: r.settings } })
    return r.settings
  }, [])

  return {
    state, settings, active, loading, busy, running,
    mode: active ? active.mode : selected,
    selectMode: (m: PomodoroMode) => { if (!active) setSelected(m) },
    remainingMs,
    totalMs: (active ? active.plannedSeconds : durationFor(selected, settings)) * 1000,
    start, pause, resume, reset, saveSettings,
  }
}

export type PomodoroController = ReturnType<typeof usePomodoro>
