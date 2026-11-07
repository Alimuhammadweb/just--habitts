"use client"

import { AlertTriangle, Link2, Loader2, LogOut, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Language } from "@/types/language"

export type TelegramScreenState =
  | { kind: "error"; message: string; code?: string }
  | { kind: "confirmLink"; accountName: string; emailHint: string; telegramName: string }
  | { kind: "signedOut" }

const T = {
  retry: { uz: "Qayta urinish", ru: "Повторить", en: "Try again" },
  close: { uz: "Yopish", ru: "Закрыть", en: "Close" },
  errorTitle: { uz: "Telegram orqali kirib bo'lmadi", ru: "Не удалось войти через Telegram", en: "Couldn't sign in with Telegram" },
  expiredHint: { uz: "Ilovani yopib, bot orqali qaytadan oching.", ru: "Закройте приложение и откройте его заново через бота.", en: "Close the app and open it again from the bot." },
  linkTitle: { uz: "Telegram'ni hisobga ulash", ru: "Подключить Telegram к аккаунту", en: "Link Telegram to your account" },
  linkText: (a: string, tg: string) => ({
    uz: `Telegram hisobingiz (${tg}) quyidagi Just Habits hisobiga ulanadi. Shundan so'ng botdan ochganingizda shu hisobga kirasiz.`,
    ru: `Ваш аккаунт Telegram (${tg}) будет подключён к аккаунту Just Habits ниже. После этого при открытии через бота вы будете входить в него.`,
    en: `Your Telegram account (${tg}) will be linked to the Just Habits account below. After that, opening the app from the bot signs you in to it.`,
  }),
  linkAccount: { uz: "Hisob", ru: "Аккаунт", en: "Account" },
  linkWarn: { uz: "Bu hisob sizniki bo'lmasa, ulamang.", ru: "Если этот аккаунт не ваш — не подключайте.", en: "If this account isn't yours, don't link it." },
  confirm: { uz: "Ha, ulash", ru: "Да, подключить", en: "Yes, link it" },
  cancel: { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" },
  outTitle: { uz: "Siz tizimdan chiqdingiz", ru: "Вы вышли из аккаунта", en: "You've signed out" },
  outText: { uz: "Qayta kirish uchun Telegram hisobingizdan foydalaning.", ru: "Чтобы войти снова, используйте свой аккаунт Telegram.", en: "Use your Telegram account to sign in again." },
  signIn: { uz: "Telegram bilan kirish", ru: "Войти через Telegram", en: "Sign in with Telegram" },
}

export function TelegramAuthScreen({ state, language, busy, onRetry, onConfirm, onCancel, onSignIn, onClose }: {
  state: TelegramScreenState; language: Language; busy: boolean
  onRetry: () => void; onConfirm: () => void; onCancel: () => void; onSignIn: () => void; onClose: () => void
}) {
  const l = language
  return (
    <main className="min-h-dvh app-backdrop flex items-center justify-center px-4 py-10" style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center gap-2"><span className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Zap className="size-5" /></span><span className="text-lg font-semibold">Just Habits</span></div>

        {state.kind === "error" && (
          <div role="alert" className="space-y-4">
            <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <div><p className="font-medium">{T.errorTitle[l]}</p><p className="mt-1">{state.message}</p>
                {state.code === "TELEGRAM_EXPIRED" && <p className="mt-1 text-destructive/80">{T.expiredHint[l]}</p>}</div>
            </div>
            <div className="flex gap-2">
              <Button size="lg" className="h-11 flex-1" onClick={onRetry} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{T.retry[l]}</Button>
              <Button size="lg" variant="outline" className="h-11" onClick={onClose}>{T.close[l]}</Button>
            </div>
          </div>)}

        {state.kind === "confirmLink" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Link2 className="size-5 text-primary" />{T.linkTitle[l]}</h2>
            <p className="text-sm text-muted-foreground">{T.linkText(state.accountName, state.telegramName)[l]}</p>
            <div className="rounded-lg border border-border bg-card/60 p-4 text-sm">
              <p className="text-muted-foreground">{T.linkAccount[l]}</p>
              <p className="font-medium break-words">{state.accountName}</p>
              {state.emailHint && <p className="text-muted-foreground">{state.emailHint}</p>}
            </div>
            <p className="text-xs text-amber-300">{T.linkWarn[l]}</p>
            <div className="flex gap-2">
              <Button size="lg" className="h-11 flex-1" onClick={onConfirm} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{T.confirm[l]}</Button>
              <Button size="lg" variant="outline" className="h-11" onClick={onCancel} disabled={busy}>{T.cancel[l]}</Button>
            </div>
          </div>)}

        {state.kind === "signedOut" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><LogOut className="size-5 text-primary" />{T.outTitle[l]}</h2>
            <p className="text-sm text-muted-foreground">{T.outText[l]}</p>
            <Button size="lg" className="h-11 w-full" onClick={onSignIn} disabled={busy}>{busy && <Loader2 className="animate-spin" />}{T.signIn[l]}</Button>
          </div>)}
      </div>
    </main>
  )
}
