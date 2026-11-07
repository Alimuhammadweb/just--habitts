"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Share2, Download, X } from "lucide-react"
import type { User } from "@/types/user"
import { type Language, translations } from "@/lib/translations"
import { calculateLevel, getLevelBadge } from "@/lib/xp-system"

interface StreakShareCardProps {
  user: User
  language: Language
  onClose: () => void
}

export function StreakShareCard({ user, language, onClose }: StreakShareCardProps) {
  const t = translations[language]
  const cardRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)

  const completedDays = user.habits.reduce(
    (sum, h) => sum + Object.values(h.days).filter((s) => s === "completed" || s === "frozen").length, 0
  )

  // Current streak calculation
  let currentStreak = 0
  if (user.habits.length > 0) {
    const allStatuses = user.habits[0]?.days
    if (allStatuses) {
      const sorted = Object.keys(allStatuses).map(Number).sort((a, b) => b - a)
      for (const idx of sorted) {
        const s = allStatuses[idx]
        if (s === "completed" || s === "frozen") currentStreak++
        else if (s === "missed") break
      }
    }
  }

  const level = calculateLevel(user.xpData.totalXP)
  const levelBadge = getLevelBadge(level)
  const completionRate = user.habits.length > 0
    ? Math.round((completedDays / (user.habits.reduce((s, h) => s + h.duration, 0))) * 100)
    : 0

  const shareText = language === "uz"
    ? `Just Habits da ${currentStreak} kunlik seriyam bor! 🔥 ${completedDays} kun odat bajardim. Siz ham urinib ko'ring!`
    : language === "ru"
      ? `У меня серия ${currentStreak} дней в Just Habits! 🔥 Выполнил ${completedDays} дней. Попробуйте и вы!`
      : `I have a ${currentStreak}-day streak on Just Habits! 🔥 Completed ${completedDays} days. Try it too!`

  const handleShare = async () => {
    setSharing(true)
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Just Habits",
          text: shareText,
          url: process.env.NEXT_PUBLIC_APP_URL || window.location.origin,
        })
      } else {
        await navigator.clipboard.writeText(shareText)
        alert(t.shareCardCopied || "Matn nusxalandi! Istalgan joyga joylashtiring.")
      }
    } catch {}
    setSharing(false)
  }

  const handleDownload = async () => {
    if (!cardRef.current) return

    try {
      // Use html2canvas-like approach with CSS
      const svgData = generateSVGCard(user.name, currentStreak, completedDays, completionRate, levelBadge)
      const blob = new Blob([svgData], { type: "image/svg+xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `just-habits-streak-${currentStreak}.svg`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("Download failed:", e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-sm">{t.shareCardTitle || "Natijangizni ulashing"}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Share card preview */}
        <div ref={cardRef} className="p-4">
          <div className="rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 relative">
            {/* Stars background */}
            <div className="absolute inset-0 opacity-20">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-white rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    opacity: Math.random() * 0.8 + 0.2,
                  }}
                />
              ))}
            </div>

            <div className="relative">
              {/* App name */}
              <p className="text-blue-300 text-xs font-medium mb-4">⚡ Just Habits</p>

              {/* Name */}
              <h2 className="text-white text-xl font-bold mb-1">{user.name}</h2>
              <p className="text-blue-300 text-xs mb-5">{levelBadge} Daraja {level}</p>

              {/* Main stat */}
              <div className="flex items-end gap-2 mb-5">
                <span className="text-6xl font-black text-white">{currentStreak}</span>
                <div className="mb-2">
                  <div className="text-3xl">🔥</div>
                  <p className="text-blue-300 text-xs">{t.streakDays || "kunlik seriya"}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/10 rounded-lg p-2 text-center">
                  <p className="text-white font-bold text-sm">{completedDays}</p>
                  <p className="text-blue-300 text-[10px]">{t.completedDays || "bajarilgan"}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-2 text-center">
                  <p className="text-white font-bold text-sm">{completionRate}%</p>
                  <p className="text-blue-300 text-[10px]">{t.successRate || "muvaffaqiyat"}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-2 text-center">
                  <p className="text-white font-bold text-sm">{user.xpData.totalXP}</p>
                  <p className="text-blue-300 text-[10px]">XP</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Share text preview */}
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2">{shareText}</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 p-4 pt-2">
          <Button onClick={handleDownload} variant="outline" size="sm" className="flex-1 text-xs h-9">
            <Download className="w-3 h-3 mr-1" />
            {t.downloadCard || "Yuklab olish"}
          </Button>
          <Button onClick={handleShare} size="sm" className="flex-1 text-xs h-9" disabled={sharing}>
            <Share2 className="w-3 h-3 mr-1" />
            {sharing ? "..." : (t.shareCard || "Ulashish")}
          </Button>
        </div>
      </div>
    </div>
  )
}

function generateSVGCard(name: string, streak: number, completedDays: number, rate: number, badge: string): string {
  return `<svg width="400" height="220" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="50%" style="stop-color:#1e3a5f"/>
      <stop offset="100%" style="stop-color:#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="400" height="220" rx="16" fill="url(#bg)"/>
  <text x="20" y="36" font-family="system-ui" font-size="12" fill="#93c5fd">⚡ Just Habits</text>
  <text x="20" y="68" font-family="system-ui" font-size="22" font-weight="bold" fill="white">${name}</text>
  <text x="20" y="88" font-family="system-ui" font-size="11" fill="#93c5fd">${badge} Daraja</text>
  <text x="20" y="148" font-family="system-ui" font-size="72" font-weight="900" fill="white">${streak}</text>
  <text x="110" y="138" font-family="system-ui" font-size="32" fill="white">🔥</text>
  <text x="110" y="155" font-family="system-ui" font-size="11" fill="#93c5fd">kunlik seriya</text>
  <rect x="20" y="168" width="110" height="38" rx="8" fill="rgba(255,255,255,0.1)"/>
  <text x="75" y="183" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="bold" fill="white">${completedDays}</text>
  <text x="75" y="198" text-anchor="middle" font-family="system-ui" font-size="9" fill="#93c5fd">bajarilgan</text>
  <rect x="140" y="168" width="110" height="38" rx="8" fill="rgba(255,255,255,0.1)"/>
  <text x="195" y="183" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="bold" fill="white">${rate}%</text>
  <text x="195" y="198" text-anchor="middle" font-family="system-ui" font-size="9" fill="#93c5fd">muvaffaqiyat</text>
  <rect x="260" y="168" width="120" height="38" rx="8" fill="rgba(59,130,246,0.3)"/>
  <text x="320" y="183" text-anchor="middle" font-family="system-ui" font-size="11" fill="#93c5fd">just-habits.vercel.app</text>
  <text x="320" y="198" text-anchor="middle" font-family="system-ui" font-size="9" fill="#93c5fd">Bepul yuklab oling</text>
</svg>`
}