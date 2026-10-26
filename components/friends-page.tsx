"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft, UserPlus, UserCheck, UserX, Search,
  Users, Trophy, Flame, Star, MessageCircle, RefreshCw,
  Crown, Zap, ChevronRight
} from "lucide-react"
import type { User } from "@/types/user"
import { type Language, translations } from "@/lib/translations"
import { calculateLevel } from "@/lib/xp-system"

interface FriendsPageProps {
  currentUser: User
  language: Language
  onBack: () => void
  onUpdateUser?: (user: User) => void
}

interface FriendData {
  id: number
  name: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
  xpData: { totalXP: number; weeklyXP: number }
  habits?: { days: Record<number, string>; duration: number }[]
  selectedFrame?: string
  _requested?: boolean
}

// ── Avatar component ──────────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = "md", frame }: {
  name: string; avatarUrl?: string; size?: "xs" | "sm" | "md" | "lg"; frame?: string
}) {
  const dim = { xs: "w-7 h-7 text-[10px]", sm: "w-9 h-9 text-xs", md: "w-11 h-11 text-sm", lg: "w-16 h-16 text-lg" }[size]
  const initials = (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().substring(0, 2)
  const frameClass = frame === "neon-edge" ? "ring-2 ring-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
    : frame === "mythic" ? "ring-2 ring-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.6)]"
    : frame === "immortal" ? "ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
    : frame === "ultimate-karambit" ? "ring-2 ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.4)]"
    : frame === "silver-line" ? "ring-2 ring-gray-400"
    : frame === "double-ring" ? "ring-[3px] ring-blue-500 ring-offset-1 ring-offset-background"
    : "ring-2 ring-primary/30"

  return (
    <div className={`${dim} rounded-full ${frameClass} flex items-center justify-center shrink-0 overflow-hidden`}>
      {avatarUrl?.startsWith("http") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover rounded-full" />
      ) : avatarUrl && !avatarUrl.startsWith("http") ? (
        <span className={size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-base"}>{avatarUrl}</span>
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-bold">
          {initials}
        </div>
      )}
    </div>
  )
}

// ── Streak helper ─────────────────────────────────────────────────────────────
function getStreak(habits?: FriendData["habits"]): number {
  if (!habits?.length) return 0
  const habit = habits[0]
  if (!habit?.days) return 0
  const sorted = Object.keys(habit.days).map(Number).sort((a, b) => b - a)
  let streak = 0
  for (const i of sorted) {
    if (habit.days[i] === "completed" || habit.days[i] === "frozen") streak++
    else if (habit.days[i] === "missed") break
  }
  return streak
}

function getWeeklyDone(habits?: FriendData["habits"]): number {
  if (!habits?.length) return 0
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  let count = 0
  habits.forEach(h => {
    Object.values(h.days || {}).forEach(s => {
      if (s === "completed" || s === "frozen") count++
    })
  })
  return count
}

// ── Rank badge ────────────────────────────────────────────────────────────────
function RankBadge({ xp }: { xp: number }) {
  const level = calculateLevel(xp)
  const color = level >= 50 ? "text-yellow-400 bg-yellow-400/10" : level >= 30 ? "text-purple-400 bg-purple-400/10" : level >= 15 ? "text-blue-400 bg-blue-400/10" : "text-green-400 bg-green-400/10"
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>
      Lv.{level}
    </span>
  )
}

// ── FriendCard ────────────────────────────────────────────────────────────────
function FriendCard({ friend, onRemove, loading, language }: {
  friend: FriendData
  onRemove: (id: number) => void
  loading: boolean
  language: Language
}) {
  const streak = getStreak(friend.habits)
  const done = getWeeklyDone(friend.habits)
  const displayName = friend.firstName && friend.lastName
    ? `${friend.firstName} ${friend.lastName}`
    : friend.name

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 group">
      <div className="flex items-center gap-3">
        <Avatar name={displayName} avatarUrl={friend.avatarUrl} size="md" frame={friend.selectedFrame} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-sm truncate">{displayName}</p>
            <RankBadge xp={friend.xpData?.totalXP || 0} />
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-orange-400">
              <Flame className="w-3 h-3" /> {streak}
            </span>
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Zap className="w-3 h-3" /> {friend.xpData?.totalXP || 0}
            </span>
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Star className="w-3 h-3" /> {done}
              {language === "uz" ? "/7k" : language === "ru" ? "/7д" : "/7d"}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(friend.id)}
          disabled={loading}
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <UserX className="w-4 h-4" />
        </Button>
      </div>

      {/* Weekly progress bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>{language === "uz" ? "Bu hafta" : language === "ru" ? "Эта неделя" : "This week"}</span>
          <span>{Math.min(100, Math.round((done / 7) * 100))}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (done / 7) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main FriendsPage ──────────────────────────────────────────────────────────
export function FriendsPage({ currentUser, language, onBack, onUpdateUser }: FriendsPageProps) {
  const t = translations[language]
  const [tab, setTab] = useState<"friends" | "search" | "requests">("friends")
  const [friends, setFriends] = useState<FriendData[]>([])
  const [requests, setRequests] = useState<FriendData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<FriendData[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimer = useRef<NodeJS.Timeout>()

  const L = {
    title: language === "uz" ? "Do'stlar" : language === "ru" ? "Друзья" : "Friends",
    friendsTab: language === "uz" ? "Do'stlar" : language === "ru" ? "Друзья" : "Friends",
    searchTab: language === "uz" ? "Qidirish" : language === "ru" ? "Поиск" : "Search",
    requestsTab: language === "uz" ? "So'rovlar" : language === "ru" ? "Запросы" : "Requests",
    searchPlaceholder: language === "uz" ? "Ism yoki email..." : language === "ru" ? "Имя или email..." : "Name or email...",
    noFriends: language === "uz" ? "Hali do'stlar yo'q" : language === "ru" ? "Пока нет друзей" : "No friends yet",
    noFriendsHint: language === "uz" ? "Qidirish bo'limidan do'st qo'shing" : language === "ru" ? "Найдите друзей в поиске" : "Find friends in search",
    noResults: language === "uz" ? "Hech narsa topilmadi" : language === "ru" ? "Ничего не найдено" : "No results found",
    noRequests: language === "uz" ? "So'rovlar yo'q" : language === "ru" ? "Нет запросов" : "No requests",
    add: language === "uz" ? "Qo'shish" : language === "ru" ? "Добавить" : "Add",
    sent: language === "uz" ? "Yuborildi ✓" : language === "ru" ? "Отправлено ✓" : "Sent ✓",
    alreadyFriend: language === "uz" ? "Do'st ✓" : language === "ru" ? "Друг ✓" : "Friend ✓",
    accept: language === "uz" ? "Qabul" : language === "ru" ? "Принять" : "Accept",
    decline: language === "uz" ? "Rad" : language === "ru" ? "Отклонить" : "Decline",
    wants: language === "uz" ? "do'st bo'lmoqchi" : language === "ru" ? "хочет дружить" : "wants to be friends",
    searching: language === "uz" ? "Qidirilmoqda..." : language === "ru" ? "Поиск..." : "Searching...",
  }

  const loadFriends = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/friends?userId=${currentUser.id}`)
      if (!res.ok) throw new Error("fetch failed")
      const data = await res.json()
      setFriends(data.friends || [])
      setRequests(data.requests || [])
    } catch (e) {
      console.error("[Friends] load error:", e)
    } finally {
      setLoading(false)
    }
  }, [currentUser.id])

  useEffect(() => { loadFriends() }, [loadFriends])

  const handleSearch = (q: string) => {
    setSearchQuery(q)
    clearTimeout(searchTimer.current)
    if (q.length < 2) { setSearchResults([]); return }
    setSearchLoading(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(q)}&userId=${currentUser.id}`)
        const data = await res.json()
        setSearchResults(data.users || [])
      } catch {}
      setSearchLoading(false)
    }, 400)
  }

  const doAction = async (targetId: number, action: string) => {
    setActionLoading(targetId)
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, targetId, action }),
      })
      if (!res.ok) throw new Error("action failed")

      // Update search results state
      if (action === "send") {
        setSearchResults(prev => prev.map(u => u.id === targetId ? { ...u, _requested: true } : u))
      }

      // Reload friends
      await loadFriends()

      // Update currentUser locally (so badge disappears immediately)
      if (action === "accept" || action === "decline" || action === "remove" || action === "send") {
        const updatedFriends = action === "remove"
          ? (currentUser.friends || []).filter(id => id !== targetId)
          : action === "accept"
            ? [...(currentUser.friends || []), targetId]
            : currentUser.friends || []
        const updatedRequests = action === "accept" || action === "decline"
          ? (currentUser.friendRequests || []).filter(id => id !== targetId)
          : currentUser.friendRequests || []
        const updatedSent = action === "send"
          ? [...(currentUser.sentRequests || []), targetId]
          : currentUser.sentRequests || []

        const updated = { ...currentUser, friends: updatedFriends, friendRequests: updatedRequests, sentRequests: updatedSent }
        onUpdateUser?.(updated)
      }
    } catch (e) {
      console.error("[Friends] action error:", e)
    } finally {
      setActionLoading(null)
    }
  }

  const isFriend = (id: number) => (currentUser.friends || []).includes(id)
  const hasSent = (id: number) => (currentUser.sentRequests || []).includes(id)

  // Leaderboard-style ranking among friends
  const rankedFriends = [...friends].sort(
    (a, b) => (b.xpData?.totalXP || 0) - (a.xpData?.totalXP || 0)
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="font-bold">{L.title}</h1>
            {friends.length > 0 && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                {friends.length}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={loadFriends} disabled={loading} className="h-8 w-8">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-t border-border">
          {([
            { id: "friends", label: L.friendsTab, count: friends.length },
            { id: "search", label: L.searchTab },
            { id: "requests", label: L.requestsTab, count: requests.length, highlight: requests.length > 0 },
          ] as const).map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors relative flex items-center justify-center gap-1.5 ${
                tab === item.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  item.highlight ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {item.count}
                </span>
              )}
              {tab === item.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* FRIENDS TAB */}
        {tab === "friends" && (
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : rankedFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <Users className="w-10 h-10 text-primary/50" />
                </div>
                <h3 className="font-semibold text-base mb-1">{L.noFriends}</h3>
                <p className="text-sm text-muted-foreground mb-5">{L.noFriendsHint}</p>
                <Button size="sm" onClick={() => setTab("search")} className="gap-2">
                  <Search className="w-4 h-4" />
                  {L.searchTab}
                </Button>
              </div>
            ) : (
              <>
                {/* Mini leaderboard header */}
                {rankedFriends.length >= 2 && (
                  <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-semibold text-yellow-300">
                        {language === "uz" ? "Do'stlar reytingi" : language === "ru" ? "Рейтинг друзей" : "Friends Leaderboard"}
                      </span>
                    </div>
                    <div className="flex justify-around">
                      {rankedFriends.slice(0, 3).map((f, i) => (
                        <div key={f.id} className="flex flex-col items-center gap-1">
                          <div className="relative">
                            <Avatar name={f.firstName && f.lastName ? `${f.firstName} ${f.lastName}` : f.name} avatarUrl={f.avatarUrl} size={i === 0 ? "md" : "sm"} />
                            <span className="absolute -bottom-1 -right-1 text-sm">
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[60px] text-center">
                            {(f.firstName || f.name).split(" ")[0]}
                          </span>
                          <span className="text-[10px] font-bold text-yellow-400">{f.xpData?.totalXP || 0} XP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rankedFriends.map((friend, idx) => (
                  <div key={friend.id} className="relative">
                    {idx < 3 && (
                      <span className="absolute top-3 right-3 text-xs z-10">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                      </span>
                    )}
                    <FriendCard
                      friend={friend}
                      onRemove={(id) => doAction(id, "remove")}
                      loading={actionLoading === friend.id}
                      language={language}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {tab === "search" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={L.searchPlaceholder}
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl"
                autoFocus
              />
              {searchLoading && (
                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
              )}
            </div>

            {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">{L.noResults}</div>
            )}

            {searchResults.map(user => {
              const friend = isFriend(user.id)
              const sent = user._requested || hasSent(user.id)
              const displayName = user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}` : user.name

              return (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-all">
                  <Avatar name={displayName} avatarUrl={user.avatarUrl} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{displayName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <RankBadge xp={user.xpData?.totalXP || 0} />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        {user.xpData?.totalXP || 0} XP
                      </span>
                    </div>
                  </div>
                  {friend ? (
                    <span className="text-xs text-green-400 flex items-center gap-1 shrink-0">
                      <UserCheck className="w-3 h-3" /> {L.alreadyFriend}
                    </span>
                  ) : sent ? (
                    <span className="text-xs text-muted-foreground shrink-0">{L.sent}</span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => doAction(user.id, "send")}
                      disabled={actionLoading === user.id}
                      className="h-8 text-xs px-3 shrink-0 gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      {L.add}
                    </Button>
                  )}
                </div>
              )
            })}

            {!searchQuery && (
              <div className="text-center py-10 text-muted-foreground">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">
                  {language === "uz" ? "Do'st qidirish uchun ism yoki email kiriting" : language === "ru" ? "Введите имя или email для поиска" : "Type name or email to search"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === "requests" && (
          <div className="space-y-3">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-muted-foreground opacity-40" />
                </div>
                <p className="text-muted-foreground text-sm">{L.noRequests}</p>
              </div>
            ) : (
              requests.map(req => {
                const displayName = req.firstName && req.lastName
                  ? `${req.firstName} ${req.lastName}` : req.name
                return (
                  <div key={req.id} className="p-4 rounded-2xl border border-border bg-card space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={displayName} avatarUrl={req.avatarUrl} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground">{L.wants}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <RankBadge xp={req.xpData?.totalXP || 0} />
                          <span className="text-xs text-yellow-400">{req.xpData?.totalXP || 0} XP</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => doAction(req.id, "accept")}
                        disabled={actionLoading === req.id}
                        size="sm"
                        className="flex-1 h-9 bg-green-600 hover:bg-green-700 gap-1.5"
                      >
                        <UserCheck className="w-4 h-4" />
                        {L.accept}
                      </Button>
                      <Button
                        onClick={() => doAction(req.id, "decline")}
                        disabled={actionLoading === req.id}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
                      >
                        <UserX className="w-4 h-4" />
                        {L.decline}
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
