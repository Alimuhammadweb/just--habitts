"use client"

import { useState } from "react"
import { NotificationSettings } from "@/components/notification-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Edit, Camera, Save, Crown, Sparkles } from "lucide-react"
import type { User } from "@/types/user"
import { translations, type Language } from "@/lib/translations"
import { getLevelBadge, getLevelName, calculateLevel, getXPForNextLevel } from "@/lib/xp-system"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface ProfilePageProps {
  onClose: () => void
  currentUser: User
  onUpdateProfile: (updates: Partial<User>) => void
  language?: Language
}

export function ProfilePage({ onClose, currentUser, onUpdateProfile, language = "en" }: ProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [firstName, setFirstName] = useState(currentUser.firstName || "")
  const [lastName, setLastName] = useState(currentUser.lastName || "")
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || "")
  const [selectedBadge, setSelectedBadge] = useState(currentUser.selectedBadge || "none")
  const [selectedBorder, setSelectedBorder] = useState(currentUser.selectedBorder || "none")
  const [selectedFrame, setSelectedFrame] = useState(currentUser.selectedFrame || "none")
  const [selectedBackground, setSelectedBackground] = useState(currentUser.selectedBackground || "default")

  if (!currentUser || !currentUser.xpData) {
    return null
  }

  const t = translations[language]
  const level = calculateLevel(currentUser.xpData.totalXP || 0)
  const levelName = getLevelName(level)
  const levelBadge = getLevelBadge(level)
  const nextLevelXP = getXPForNextLevel(level)
  const currentLevelXP = level > 0 ? getXPForNextLevel(level - 1) : 0
  const xpInCurrentLevel = (currentUser.xpData.totalXP || 0) - currentLevelXP
  const xpNeededForNextLevel = nextLevelXP - currentLevelXP
  const levelProgress = Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100)

  const getMotivationalTag = () => {
    const totalXP = currentUser.xpData.totalXP || 0
    if (totalXP >= 1000) {
      return language === "uz" ? "Afsonaviy Shaxs" : language === "ru" ? "Легендарная Личность" : "Legendary Person"
    }
    if (totalXP >= 500) {
      return language === "uz"
        ? "Kuchli Intizomli Odam"
        : language === "ru"
          ? "Сильный Дисциплинированный Человек"
          : "Strong Disciplined Person"
    }
    if (totalXP >= 200) {
      return language === "uz" ? "Maqsadga Intiluvchi" : language === "ru" ? "Целеустремленный" : "Goal-Oriented"
    }
    if (totalXP >= 100) {
      return language === "uz" ? "O'sib Boruvchi Yulduz" : language === "ru" ? "Восходящая Звезда" : "Rising Star"
    }
    return language === "uz" ? "Yangi Boshlagan" : language === "ru" ? "Новичок" : "Beginner"
  }

  const handleSave = () => {
    onUpdateProfile({
      firstName,
      lastName,
      avatarUrl,
      selectedBadge,
      selectedBorder,
      selectedFrame,
      selectedBackground,
    })
    setIsEditing(false)
  }

  const getAvatarDisplay = () => {
    if (avatarUrl && (avatarUrl.startsWith("http") || avatarUrl.startsWith("data:"))) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl || "/placeholder.svg"} alt="Avatar" className="w-full h-full object-cover rounded-full" />
      )
    }
    const displayName = firstName && lastName ? `${firstName} ${lastName}` : currentUser.name
    return (
      <span className="text-4xl sm:text-5xl font-bold text-white">
        {displayName
          .split(" ")
          .map((word) => word[0])
          .join("")
          .toUpperCase()
          .substring(0, 2)}
      </span>
    )
  }

  const getBorderStyle = () => {
    const borders: Record<string, { border: string; crown?: boolean }> = {
      none: { border: "border-2 border-border" },
      silver: { border: "border-4 border-gray-400 shadow-lg shadow-gray-400/30" },
      gold: { border: "border-4 border-yellow-500 shadow-lg shadow-yellow-500/30" },
      rainbow: { border: "border-4 border-transparent bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 p-1" },
      glow: { border: "border-4 border-purple-500 shadow-lg shadow-purple-500/50 animate-pulse" },
      elite: {
        border: "border-4 border-transparent bg-gradient-to-r from-yellow-500 via-purple-500 to-blue-500 p-1",
        crown: true,
      },
      legendary: {
        border:
          "border-4 border-transparent bg-gradient-to-r from-yellow-400 via-red-500 to-purple-600 p-1 animate-pulse",
        crown: true,
      },
    }
    return borders[selectedBorder] || borders.none
  }

  const borderStyle = getBorderStyle()

  const getFrameStyle = (frame: string): { outer: string; inner: string } => {
    const styles: Record<string, { outer: string; inner: string }> = {
      none: { outer: "", inner: "" },
      "soft-circle": { outer: "ring-4 ring-purple-300/60 ring-offset-2 ring-offset-background", inner: "" },
      "silver-line": { outer: "ring-4 ring-gray-400 ring-offset-2 ring-offset-background shadow-lg shadow-gray-400/30", inner: "" },
      "double-ring": { outer: "ring-4 ring-blue-500 ring-offset-4 ring-offset-blue-500/30 shadow-lg shadow-blue-500/30", inner: "" },
      "doppler-karambit": { outer: "ring-4 ring-offset-2 ring-offset-background shadow-xl", inner: "bg-gradient-to-br from-purple-500 via-blue-500 to-green-500" },
      "neon-edge": { outer: "ring-4 ring-cyan-400 ring-offset-2 ring-offset-background shadow-[0_0_20px_4px_rgba(34,211,238,0.5)]", inner: "" },
      "shadow-frame": { outer: "ring-4 ring-gray-600 ring-offset-2 ring-offset-background shadow-[0_0_30px_6px_rgba(0,0,0,0.5)]", inner: "" },
      "crimson-karambit": { outer: "ring-4 ring-offset-2 ring-offset-background shadow-xl", inner: "bg-gradient-to-br from-red-600 via-red-400 to-orange-500" },
      "dark-doppler": { outer: "ring-4 ring-offset-2 ring-offset-background shadow-xl", inner: "bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900" },
      mythic: { outer: "ring-4 ring-offset-2 ring-offset-background shadow-[0_0_25px_6px_rgba(168,85,247,0.6)] animate-pulse", inner: "bg-gradient-to-br from-purple-600 via-pink-500 to-purple-800" },
      "ultimate-karambit": { outer: "ring-[5px] ring-offset-2 ring-offset-background shadow-[0_0_30px_8px_rgba(250,204,21,0.5)]", inner: "bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500" },
      immortal: { outer: "ring-[5px] ring-offset-2 ring-offset-background shadow-[0_0_35px_10px_rgba(239,68,68,0.6)] animate-pulse", inner: "bg-gradient-to-br from-red-500 via-orange-400 to-yellow-300" },
      // Challenge frames
      "frame-reader": { outer: "ring-4 ring-emerald-400 ring-offset-2 ring-offset-background shadow-[0_0_15px_rgba(52,211,153,0.6)]", inner: "" },
      "frame-warrior": { outer: "ring-4 ring-red-500 ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(239,68,68,0.7)]", inner: "" },
      "frame-nature": { outer: "ring-4 ring-green-400 ring-offset-2 ring-offset-background shadow-[0_0_18px_rgba(74,222,128,0.6)]", inner: "" },
      "frame-lightning": { outer: "ring-[5px] ring-yellow-400 ring-offset-2 ring-offset-background shadow-[0_0_25px_rgba(250,204,21,0.8)] animate-pulse", inner: "" },
      "frame-nocturnal": { outer: "ring-[5px] ring-slate-700 ring-offset-2 ring-offset-background shadow-[0_0_30px_rgba(15,23,42,0.9),0_0_15px_rgba(99,102,241,0.5)]", inner: "" },
      "frame-iroda-gold": { outer: "ring-[6px] ring-yellow-500 ring-offset-2 ring-offset-background shadow-[0_0_40px_rgba(234,179,8,0.9)] animate-pulse", inner: "" },
      "frame-immortal-champion": { outer: "ring-[7px] ring-red-500 ring-offset-2 ring-offset-background shadow-[0_0_50px_rgba(239,68,68,1),0_0_100px_rgba(239,68,68,0.5)] animate-pulse", inner: "" },
    }
    return styles[frame] || styles.none
  }

  const frameStyle = getFrameStyle(selectedFrame)
  const unlockedAvatars = currentUser.isAdmin
    ? ["none", "starter", "beginner", "warrior", "master", "legend"]
    : currentUser.unlockedAvatars || []
  const unlockedThemes = currentUser.isAdmin
    ? ["default", "fire", "ocean", "forest", "sunset"]
    : currentUser.unlockedThemes || []
  const unlockedBadges = currentUser.isAdmin
    ? [
        "none",
        "starter",
        "beginner",
        "warrior",
        "master",
        "legend",
        "tiny-green-dot",
        "mini-flame",
        "lightning",
        "shield",
        "halo",
        "star",
        "golden-tomato",
        "tomato-seed",
        "brain",
        "crown",
        "legendary",
      ]
    : currentUser.unlockedBadges || []
  const unlockedBorders = currentUser.isAdmin
    ? ["none", "silver", "gold", "rainbow", "glow", "elite", "legendary"]
    : currentUser.unlockedBorders || []
  const unlockedFrames = currentUser.isAdmin
    ? [
        "none",
        "soft-circle",
        "silver-line",
        "double-ring",
        "doppler-karambit",
        "neon-edge",
        "shadow-frame",
        "crimson-karambit",
        "dark-doppler",
        "mythic",
        "ultimate-karambit",
        "immortal",
        "frame-reader",
        "frame-warrior",
        "frame-nature",
        "frame-lightning",
        "frame-nocturnal",
        "frame-iroda-gold",
        "frame-immortal-champion",
      ]
    : [
        ...(currentUser.unlockedFrames || []),
        ...((currentUser.challengeRewards || []).filter(r => r.type === "frame").map(r => r.value)),
      ]
  const unlockedBackgrounds = currentUser.isAdmin
    ? ["default", "soft-gradient", "animated-lines", "elite-theme",
       "paint-sunrise", "paint-ocean", "paint-zen", "paint-fire", "paint-aurora",
       "paint-crimson", "paint-elite", "paint-iroda-fire"]
    : [
        ...(currentUser.unlockedBackgrounds || []),
        ...((currentUser.challengeRewards || []).filter(r => r.type === "paint").map(r => r.value)),
      ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-3 sm:p-4 z-50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg p-4 sm:p-6 max-w-lg sm:max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">{t.profile || "Profile"}</h2>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <Button variant="outline" size="icon" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 sm:h-10 sm:w-10">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10">
            <Sparkles className="h-32 w-32" />
          </div>
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="relative">
              <div className={`${borderStyle.border} ${frameStyle.outer}`} style={{ borderRadius: "9999px" }}>
                <div className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center overflow-hidden ${frameStyle.inner || "bg-gradient-to-br from-primary to-purple-500"}`}>
                  {getAvatarDisplay()}
                </div>
              </div>
              {borderStyle.crown && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <Crown className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-500 fill-yellow-500 animate-pulse" />
                </div>
              )}
              {selectedBadge && selectedBadge !== "none" && (
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-2xl border-4 border-background shadow-lg">
                  {selectedBadge === "beginner"
                    ? "🌱"
                    : selectedBadge === "warrior"
                      ? "⚔️"
                      : selectedBadge === "master"
                        ? "🎯"
                        : selectedBadge === "legend"
                          ? "🏆"
                          : selectedBadge === "starter"
                            ? "✨"
                            : "🏅"}
                </div>
              )}
            </div>
            <div className="text-center">
              <h3 className="text-2xl sm:text-3xl font-bold mb-1">
                {firstName && lastName ? `${firstName} ${lastName}` : currentUser.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-2">{currentUser.email}</p>
              <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 text-sm">
                <Sparkles className="h-3 w-3 mr-1" />
                {getMotivationalTag()}
              </Badge>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-3xl">{levelBadge}</span>
                <span className="font-semibold text-lg">
                  {t.level || "Level"} {level} - {levelName}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Card className="p-4 mb-6 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">
              {language === "uz"
                ? "Keyingi darajagacha"
                : language === "ru"
                  ? "До следующего уровня"
                  : "Progress to Next Level"}
            </span>
            <span className="text-sm font-bold text-primary">
              {xpInCurrentLevel} / {xpNeededForNextLevel} XP
            </span>
          </div>
          <Progress value={levelProgress} className="h-3 mb-2" />
          <p className="text-xs text-muted-foreground text-center">
            {nextLevelXP - (currentUser.xpData.totalXP || 0)} XP{" "}
            {language === "uz" ? "qoldi" : language === "ru" ? "осталось" : "remaining"}
          </p>
        </Card>

        {isEditing && (
          <Card className="p-4 mb-6 border-2 border-primary">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {language === "uz" ? "Profilni tahrirlash" : language === "ru" ? "Редактировать профиль" : "Edit Profile"}
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="firstName">
                  {language === "uz" ? "Ism" : language === "ru" ? "Имя" : "First Name"}
                </Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="lastName">
                  {language === "uz" ? "Familya" : language === "ru" ? "Фамилия" : "Last Name"}
                </Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="avatarUrl">
                  {language === "uz"
                    ? "Rasm linki orqali"
                    : language === "ru"
                      ? "Через ссылку на изображение"
                      : "Image URL"}
                </Label>
                <Input
                  id="avatarUrl"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "uz"
                    ? "Rasm URL manzilini kiriting"
                    : language === "ru"
                      ? "Введите URL изображения"
                      : "Enter image URL"}
                </p>
              </div>
              <div>
                <Label>
                  {language === "uz" ? "Nishon tanlash" : language === "ru" ? "Выбрать значок" : "Select Badge"}
                </Label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {["none", "starter", "beginner", "warrior", "master", "legend"].map((badge) => {
                    const isUnlocked = badge === "none" || unlockedBadges.includes(badge)
                    return (
                      <button
                        key={badge}
                        onClick={() => isUnlocked && setSelectedBadge(badge)}
                        disabled={!isUnlocked}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedBadge === badge
                            ? "border-primary bg-primary/10 scale-110"
                            : isUnlocked
                              ? "border-border hover:border-primary/50 hover:scale-105"
                              : "border-border opacity-30 cursor-not-allowed"
                        }`}
                      >
                        <span className="text-2xl">
                          {badge === "none"
                            ? "—"
                            : badge === "starter"
                              ? "✨"
                              : badge === "beginner"
                                ? "🌱"
                                : badge === "warrior"
                                  ? "⚔️"
                                  : badge === "master"
                                    ? "🎯"
                                    : "🏆"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <Label>
                  {language === "uz" ? "Chegara tanlash" : language === "ru" ? "Выбрать рамку" : "Select Border"}
                </Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {["none", "silver", "gold", "rainbow", "glow", "elite", "legendary"].map((border) => {
                    const isUnlocked = border === "none" || unlockedBorders.includes(border)
                    const borderPreview: Record<string, string> = {
                      none: "border-2 border-border",
                      silver: "border-4 border-gray-400",
                      gold: "border-4 border-yellow-500",
                      rainbow: "border-4 border-transparent bg-gradient-to-r from-red-500 via-purple-500 to-blue-500",
                      glow: "border-4 border-purple-500 shadow-lg shadow-purple-500/50",
                      elite: "border-4 border-transparent bg-gradient-to-r from-yellow-500 via-purple-500 to-blue-500",
                      legendary:
                        "border-4 border-transparent bg-gradient-to-r from-yellow-400 via-red-500 to-purple-600",
                    }
                    return (
                      <button
                        key={border}
                        onClick={() => isUnlocked && setSelectedBorder(border)}
                        disabled={!isUnlocked}
                        className={`p-3 rounded-lg transition-all relative ${
                          selectedBorder === border
                            ? "ring-2 ring-primary scale-110"
                            : isUnlocked
                              ? "hover:ring-2 hover:ring-primary/50 hover:scale-105"
                              : "border-border opacity-30 cursor-not-allowed"
                        } ${borderPreview[border]}`}
                      >
                        <div className="w-8 h-8 bg-muted rounded-full mx-auto" />
                        {(border === "elite" || border === "legendary") && isUnlocked && (
                          <Crown className="h-4 w-4 absolute -top-2 left-1/2 -translate-x-1/2 text-yellow-500 fill-yellow-500" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <Label>
                  {language === "uz" ? "Ramka tanlash" : language === "ru" ? "Выбрать рамку профиля" : "Select Frame"}
                </Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[
                    "none",
                    "soft-circle",
                    "silver-line",
                    "double-ring",
                    "doppler-karambit",
                    "neon-edge",
                    "shadow-frame",
                    "crimson-karambit",
                    "dark-doppler",
                    "mythic",
                    "ultimate-karambit",
                    "immortal",
                  ].map((frame) => {
                    const isUnlocked = frame === "none" || unlockedFrames.includes(frame)
                    const frameNames: Record<string, string> = {
                      none: language === "uz" ? "Yo'q" : language === "ru" ? "Нет" : "None",
                      "soft-circle": language === "uz" ? "Yumshoq" : language === "ru" ? "Мягкий" : "Soft",
                      "silver-line": language === "uz" ? "Kumush" : language === "ru" ? "Серебро" : "Silver",
                      "double-ring": language === "uz" ? "Qo'sh" : language === "ru" ? "Двойной" : "Double",
                      "doppler-karambit": "Doppler",
                      "neon-edge": "Neon",
                      "shadow-frame": language === "uz" ? "Soya" : language === "ru" ? "Тень" : "Shadow",
                      "crimson-karambit": "Crimson",
                      "dark-doppler": "Dark",
                      mythic: language === "uz" ? "Afsona" : language === "ru" ? "Мифический" : "Mythic",
                      "ultimate-karambit": "Ultimate",
                      immortal: language === "uz" ? "O'lmas" : language === "ru" ? "Бессмертный" : "Immortal",
                    }
                    return (
                      <button
                        key={frame}
                        onClick={() => isUnlocked && setSelectedFrame(frame)}
                        disabled={!isUnlocked}
                        title={frameNames[frame]}
                        className={`p-2 rounded-lg border-2 transition-all text-xs flex flex-col items-center gap-1 ${
                          selectedFrame === frame
                            ? "border-primary bg-primary/10 scale-105"
                            : isUnlocked
                              ? "border-border hover:border-primary/50"
                              : "border-border opacity-30 cursor-not-allowed"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full ${getFrameStyle(frame).outer} ${getFrameStyle(frame).inner || "bg-gradient-to-br from-primary to-purple-500"}`} />
                        <span className="text-[10px] truncate w-full text-center">{frameNames[frame]}</span>
                        {!isUnlocked && <span className="text-[9px] text-muted-foreground">🔒</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <Label>
                  {language === "uz" ? "Fon tanlash" : language === "ru" ? "Выбрать фон" : "Select Background"}
                </Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {["default", "soft-gradient", "animated-lines", "elite-theme",
                    "paint-sunrise", "paint-ocean", "paint-zen", "paint-fire",
                    "paint-aurora", "paint-crimson", "paint-elite", "paint-iroda-fire"].map((bg) => {
                    const isUnlocked = bg === "default" || unlockedBackgrounds.includes(bg)
                    const bgNames: Record<string, string> = {
                      default: language === "uz" ? "Standart" : language === "ru" ? "Стандартный" : "Default",
                      "soft-gradient": language === "uz" ? "Gradient" : language === "ru" ? "Градиент" : "Gradient",
                      "animated-lines": language === "uz" ? "Animatsiya" : language === "ru" ? "Анимация" : "Animated",
                      "elite-theme": language === "uz" ? "Elita" : language === "ru" ? "Элита" : "Elite",
                      "paint-sunrise": "☀️ Sunrise",
                      "paint-ocean": "🌊 Ocean",
                      "paint-zen": "🧘 Zen",
                      "paint-fire": "🔥 Fire",
                      "paint-aurora": "🌌 Aurora",
                      "paint-crimson": "⚔️ Crimson",
                      "paint-elite": "🏆 Elite",
                      "paint-iroda-fire": "🔱 Iroda",
                    }
                    const bgPreview: Record<string, string> = {
                      default: "bg-muted",
                      "soft-gradient": "bg-gradient-to-br from-purple-500/20 to-blue-500/20",
                      "animated-lines": "bg-gradient-to-r from-cyan-500/20 to-purple-500/20",
                      "elite-theme": "bg-gradient-to-br from-yellow-500/20 to-red-500/20",
                    }
                    const paintGradients: Record<string, string> = {
                      "paint-sunrise": "linear-gradient(135deg, #f97316, #eab308)",
                      "paint-ocean": "linear-gradient(135deg, #06b6d4, #3b82f6)",
                      "paint-zen": "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                      "paint-fire": "linear-gradient(135deg, #ef4444, #f97316, #eab308)",
                      "paint-aurora": "linear-gradient(135deg, #10b981, #06b6d4, #6366f1)",
                      "paint-crimson": "linear-gradient(135deg, #7f1d1d, #ef4444, #991b1b)",
                      "paint-elite": "linear-gradient(135deg, #d4af37, #c0c0c0, #b8860b)",
                      "paint-iroda-fire": "linear-gradient(135deg, #7c2d12, #dc2626, #f97316, #eab308)",
                    }
                    const isPaint = bg.startsWith("paint-")
                    return (
                      <button
                        key={bg}
                        onClick={() => isUnlocked && setSelectedBackground(bg)}
                        disabled={!isUnlocked}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedBackground === bg
                            ? "border-primary scale-105"
                            : isUnlocked
                              ? "border-border hover:border-primary/50"
                              : "border-border opacity-30 cursor-not-allowed"
                        }`}
                        style={isPaint && isUnlocked ? { background: paintGradients[bg] + "66" } : {}}
                      >
                        <div className="text-xs font-medium">{bgNames[bg]}</div>
                        {!isUnlocked && <div className="text-[9px] text-muted-foreground">🔒</div>}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Button onClick={handleSave} className="w-full gap-2">
                <Save className="h-4 w-4" />
                {language === "uz" ? "Saqlash" : language === "ru" ? "Сохранить" : "Save Changes"}
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-lg p-4 text-center border border-purple-500/30">
            <div className="text-3xl sm:text-4xl font-bold text-purple-500 mb-1">{currentUser.xpData.totalXP || 0}</div>
            <div className="text-sm text-muted-foreground">{t.totalXP || "Total XP"}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-lg p-4 text-center border border-blue-500/30">
            <div className="text-3xl sm:text-4xl font-bold text-blue-500 mb-1">#{currentUser.xpData.rank || "—"}</div>
            <div className="text-sm text-muted-foreground">{t.globalRank || "Global Rank"}</div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <h3 className="font-semibold text-base">{t.statistics || "Statistics"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xl font-bold">{currentUser.habits?.length || 0}</div>
              <div className="text-xs text-muted-foreground">{t.totalHabits || "Total Habits"}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xl font-bold">{currentUser.xpData.weeklyXP || 0}</div>
              <div className="text-xs text-muted-foreground">{t.weeklyXP || "Weekly XP"}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xl font-bold">{currentUser.xpData.monthlyXP || 0}</div>
              <div className="text-xs text-muted-foreground">{t.monthlyXP || "Monthly XP"}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xl font-bold">{(currentUser.completedTasks || []).length}</div>
              <div className="text-xs text-muted-foreground">
                {language === "uz" ? "Topshiriqlar" : language === "ru" ? "Задачи" : "Tasks Completed"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Badge variant="outline" className="justify-center py-2">
            🎨 {unlockedThemes.length} {language === "uz" ? "Tema" : language === "ru" ? "Темы" : "Themes"}
          </Badge>
          <Badge variant="outline" className="justify-center py-2">
            🏅 {unlockedBadges.length} {language === "uz" ? "Nishon" : language === "ru" ? "Значки" : "Badges"}
          </Badge>
          <Badge variant="outline" className="justify-center py-2">
            🖼️ {unlockedBorders.length} {language === "uz" ? "Chegara" : language === "ru" ? "Рамки" : "Borders"}
          </Badge>
          <Badge variant="outline" className="justify-center py-2">
            👤 {unlockedAvatars.length} {language === "uz" ? "Avatar" : language === "ru" ? "Аватары" : "Avatars"}
          </Badge>
        </div>

        <Button onClick={onClose} className="w-full">
          {t.close || "Close"}
        </Button>
      </div>
    </div>
  )
}
