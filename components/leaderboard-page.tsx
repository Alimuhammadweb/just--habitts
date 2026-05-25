"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Trophy, TrendingUp, Crown } from "lucide-react"
import { translations, type Language } from "@/lib/translations"
import type { User } from "@/types/user"
import { calculateLevel, getLevelBadge } from "@/lib/xp-system"
import { Card } from "@/components/ui/card"

interface LeaderboardPageProps {
  language: Language
  onBack: () => void
  currentUserId: number
  allUsers: User[]
}

export function LeaderboardPage({ language, onBack, currentUserId, allUsers }: LeaderboardPageProps) {
  const t = translations[language]

  const rankedUsers = [...allUsers]
    .sort((a, b) => (b.xpData?.totalXP || 0) - (a.xpData?.totalXP || 0))
    .map((user, index) => ({
      ...user,
      position: index + 1,
      level: calculateLevel(user.xpData?.totalXP || 0),
    }))

  const currentUserRank = rankedUsers.find((u) => u.id === currentUserId)

  const getUserAvatar = (user: User) => {
    if (user.avatarUrl && user.avatarUrl.startsWith("http")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl || "/placeholder.svg"} alt="" className="w-full h-full object-cover rounded-full" />
      )
    }
    const displayName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name
    return (
      <span className="text-sm sm:text-base font-bold">
        {displayName
          .split(" ")
          .map((word) => word[0])
          .join("")
          .toUpperCase()
          .substring(0, 2)}
      </span>
    )
  }

  const getUserDisplayName = (user: User) => {
    return user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name
  }

  const getUserBorderStyle = (user: User) => {
    const border = user.selectedBorder || "none"
    const borders: Record<string, string> = {
      none: "border-2 border-border",
      silver: "border-4 border-gray-400 shadow-lg shadow-gray-400/20",
      gold: "border-4 border-yellow-500 shadow-lg shadow-yellow-500/30",
      rainbow: "border-4 border-transparent bg-gradient-to-r from-red-500 via-purple-500 to-blue-500 p-1",
      glow: "border-4 border-purple-500 shadow-lg shadow-purple-500/50",
      elite: "border-4 border-transparent bg-gradient-to-r from-yellow-500 via-purple-500 to-blue-500 p-1",
      legendary: "border-4 border-transparent bg-gradient-to-r from-yellow-400 via-red-500 to-purple-600 p-1",
    }
    return borders[border] || borders.none
  }

  const shouldShowCrown = (user: User) => {
    return user.selectedBorder === "elite" || user.selectedBorder === "legendary" || user.position === 1
  }

  const getUserFrameStyle = (user: User): string => {
    const frameStyles: Record<string, string> = {
      none: "",
      "soft-circle": "ring-4 ring-purple-300/60 ring-offset-1",
      "silver-line": "ring-4 ring-gray-400 shadow-lg shadow-gray-400/30",
      "double-ring": "ring-4 ring-blue-500 ring-offset-4 ring-offset-blue-500/20",
      "doppler-karambit": "ring-4 shadow-xl ring-purple-500",
      "neon-edge": "ring-4 ring-cyan-400 shadow-[0_0_15px_3px_rgba(34,211,238,0.5)]",
      "shadow-frame": "ring-4 ring-gray-600 shadow-[0_0_20px_4px_rgba(0,0,0,0.4)]",
      "crimson-karambit": "ring-4 ring-red-500 shadow-xl",
      "dark-doppler": "ring-4 ring-gray-900 shadow-xl",
      mythic: "ring-4 ring-purple-500 shadow-[0_0_20px_4px_rgba(168,85,247,0.5)] animate-pulse",
      "ultimate-karambit": "ring-[5px] ring-yellow-400 shadow-[0_0_20px_6px_rgba(250,204,21,0.4)]",
      immortal: "ring-[5px] ring-red-500 shadow-[0_0_25px_6px_rgba(239,68,68,0.5)] animate-pulse",
      // Challenge frames
      "frame-reader": "ring-4 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]",
      "frame-warrior": "ring-4 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]",
      "frame-nature": "ring-4 ring-green-400 shadow-[0_0_12px_rgba(74,222,128,0.5)]",
      "frame-lightning": "ring-[5px] ring-yellow-400 shadow-[0_0_18px_rgba(250,204,21,0.7)] animate-pulse",
      "frame-nocturnal": "ring-[5px] ring-slate-700 shadow-[0_0_20px_rgba(15,23,42,0.8)]",
      "frame-iroda-gold": "ring-[6px] ring-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.8)] animate-pulse",
      "frame-immortal-champion": "ring-[7px] ring-red-500 shadow-[0_0_40px_rgba(239,68,68,0.9),0_0_80px_rgba(239,68,68,0.4)] animate-pulse",
    }
    return frameStyles[user.selectedFrame || "none"] || ""
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            {t.leaderboard}
          </h1>
        </div>

        {/* Current User Stats */}
        {currentUserRank && (
          <Card className="bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-xl p-4 sm:p-5 mb-6 border-2 border-primary">
            <div className="flex items-center gap-4">
              <div className="relative">
                {shouldShowCrown(currentUserRank) && (
                  <Crown className="absolute -top-4 left-1/2 -translate-x-1/2 h-8 w-8 text-yellow-500 fill-yellow-500 animate-pulse z-10" />
                )}
                <div className={`${getUserBorderStyle(currentUserRank)} ${getUserFrameStyle(currentUserRank)} rounded-full`}>
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center flex-shrink-0">
                    {getUserAvatar(currentUserRank)}
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{t.yourRank}</p>
                <p className="text-2xl sm:text-3xl font-bold">#{currentUserRank.position}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t.level}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">{getLevelBadge(currentUserRank.level)}</span>
                  <span className="text-2xl sm:text-3xl font-bold">{currentUserRank.level}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">XP</p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{currentUserRank.xpData?.totalXP || 0}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Top 3 Podium */}
        {rankedUsers.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {rankedUsers.slice(0, 3).map((user, idx) => {
              const medals = ["🥇", "🥈", "🥉"]
              const gradients = [
                "from-yellow-500/20 to-yellow-600/20 border-yellow-500",
                "from-gray-400/20 to-gray-500/20 border-gray-400",
                "from-orange-600/20 to-orange-700/20 border-orange-600",
              ]

              return (
                <Card
                  key={user.id}
                  className={`bg-gradient-to-br ${gradients[idx]} border-2 p-4 text-center relative ${
                    user.id === currentUserId ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="text-4xl mb-3">{medals[idx]}</div>
                  <div className="relative inline-block">
                    {shouldShowCrown(user) && (
                      <Crown className="absolute -top-4 left-1/2 -translate-x-1/2 h-6 w-6 text-yellow-500 fill-yellow-500 animate-pulse z-10" />
                    )}
                    <div className={`${getUserBorderStyle(user)} ${getUserFrameStyle(user)} rounded-full`}>
                      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                        {getUserAvatar(user)}
                      </div>
                    </div>
                  </div>
                  <div className="font-semibold truncate mb-1 text-sm mt-2">{getUserDisplayName(user)}</div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {t.level} {user.level} {getLevelBadge(user.level)}
                  </div>
                  <div className="text-lg font-bold text-primary">{user.xpData?.totalXP || 0} XP</div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Full Leaderboard */}
        <Card className="rounded-xl border border-border overflow-hidden">
          <div className="p-4 bg-muted/50 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t.fullRankings}
            </h2>
          </div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {rankedUsers.map((user) => {
              const isCurrentUser = user.id === currentUserId
              const isTop10 = user.position <= 10

              return (
                <div
                  key={user.id}
                  className={`p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:bg-muted/50 transition-colors ${
                    isCurrentUser ? "bg-primary/10" : ""
                  }`}
                >
                  {/* Position */}
                  <div className="w-8 sm:w-12 text-center flex-shrink-0">
                    {user.position <= 3 ? (
                      <span className="text-xl sm:text-2xl">
                        {user.position === 1 ? "🥇" : user.position === 2 ? "🥈" : "🥉"}
                      </span>
                    ) : (
                      <span
                        className={`font-bold text-sm sm:text-base ${isTop10 ? "text-primary" : "text-muted-foreground"}`}
                      >
                        #{user.position}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    {shouldShowCrown(user) && (
                      <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 h-5 w-5 text-yellow-500 fill-yellow-500 z-10" />
                    )}
                    <div className={`${getUserBorderStyle(user)} ${getUserFrameStyle(user)} rounded-full`}>
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center flex-shrink-0">
                        {getUserAvatar(user)}
                      </div>
                    </div>
                  </div>

                  {/* User Info */}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate text-sm sm:text-base flex items-center gap-2">
                      <span className="truncate">{getUserDisplayName(user)}</span>
                      {isCurrentUser && (
                        <span className="text-[10px] sm:text-xs bg-primary text-primary-foreground px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0">
                          {t.you}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 sm:gap-2">
                      <span className="truncate">
                        {t.level} {user.level}
                      </span>
                      <span className="flex-shrink-0">{getLevelBadge(user.level)}</span>
                    </div>
                  </div>

                  {/* XP */}
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-primary text-sm sm:text-base">{user.xpData?.totalXP || 0}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">XP</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
