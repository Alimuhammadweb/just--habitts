"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Trophy, Flame, Zap, Crown, Star, Shield, Lock,
  CheckCircle2, PlayCircle, Clock, Target, Sword, AlertTriangle,
} from "lucide-react"
import type { User, ActiveChallenge } from "@/types/user"
import { CHALLENGES, type ChallengeDifficulty } from "@/types/user"
import { translations, type Language } from "@/lib/translations"
import { AchievementAnimation } from "./achievement-animation"
import { saveUserToMongoDB } from "@/lib/db-sync"

interface ChallengesPageProps {
  currentUser: User
  onBack: () => void
  language: Language
  onUpdateUser: (user: User) => void
}

const DIFFICULTY_META: Record<ChallengeDifficulty, {
  label: Record<string, string>
  color: string
  bg: string
  border: string
  icon: React.ReactNode
  glow: string
}> = {
  oson: {
    label: { uz: "Oson", ru: "Легко", en: "Easy" },
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: <Star className="h-4 w-4" />,
    glow: "shadow-emerald-500/20",
  },
  ortacha: {
    label: { uz: "O'rtacha", ru: "Средне", en: "Medium" },
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: <Target className="h-4 w-4" />,
    glow: "shadow-yellow-500/20",
  },
  qiyin: {
    label: { uz: "Qiyin", ru: "Сложно", en: "Hard" },
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    icon: <Flame className="h-4 w-4" />,
    glow: "shadow-orange-500/20",
  },
  iroda: {
    label: { uz: "IRODA", ru: "ВОЛЯ", en: "WILL" },
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/40",
    icon: <Sword className="h-4 w-4" />,
    glow: "shadow-red-500/30",
  },
}

export function ChallengesPage({ currentUser, onBack, language, onUpdateUser }: ChallengesPageProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | ChallengeDifficulty>("all")
  const [showAnimation, setShowAnimation] = useState<"snow" | "confetti" | "sparkles" | "fireworks" | "stars" | null>(null)
  const [selectedChallenge, setSelectedChallenge] = useState<typeof CHALLENGES[0] | null>(null)
  const [confirmStart, setConfirmStart] = useState<typeof CHALLENGES[0] | null>(null)
  const [confirmDay, setConfirmDay] = useState<{ challenge: typeof CHALLENGES[0]; dayIdx: number } | null>(null)

  const activeChallenges: ActiveChallenge[] = currentUser.activeChallenges || []
  const completedChallenges: number[] = currentUser.completedChallenges || []

  const getActiveChallenge = (id: number) => activeChallenges.find(a => a.challengeId === id)
  const isCompleted = (id: number) => completedChallenges.includes(id)
  const isActive = (id: number) => !!getActiveChallenge(id)

  const filtered = CHALLENGES.filter(c => activeFilter === "all" || c.difficulty === activeFilter)
  const completedCount = completedChallenges.length
  const totalCount = CHALLENGES.length

  // Start a challenge
  const handleStart = (challenge: typeof CHALLENGES[0]) => {
    if (isActive(challenge.id) || isCompleted(challenge.id)) return
    setConfirmStart(challenge)
  }

  const confirmStartChallenge = () => {
    if (!confirmStart) return
    const newActive: ActiveChallenge = {
      challengeId: confirmStart.id,
      startedAt: Date.now(),
      completedDays: [],
      isCompleted: false,
    }
    const updated: User = {
      ...currentUser,
      activeChallenges: [...activeChallenges, newActive],
    }
    onUpdateUser(updated)
    saveUserToMongoDB(updated)
    setConfirmStart(null)
    setShowAnimation("sparkles")
    setTimeout(() => setShowAnimation(null), 3000)
  }

  // Mark a day as done
  const handleMarkDay = (challenge: typeof CHALLENGES[0]) => {
    const active = getActiveChallenge(challenge.id)
    if (!active) return
    const today = new Date()
    const todayIdx = Math.floor((today.getTime() - active.startedAt) / (1000 * 60 * 60 * 24))
    if (active.completedDays.includes(todayIdx)) return // already done today
    setConfirmDay({ challenge, dayIdx: todayIdx })
  }

  const confirmMarkDay = () => {
    if (!confirmDay) return
    const { challenge, dayIdx } = confirmDay
    const active = getActiveChallenge(challenge.id)
    if (!active) return

    const newDays = [...active.completedDays, dayIdx]
    const isDone = newDays.length >= challenge.durationDays

    const updatedActive = activeChallenges.map(a =>
      a.challengeId === challenge.id
        ? { ...a, completedDays: newDays, isCompleted: isDone, completedAt: isDone ? Date.now() : undefined }
        : a
    )

    // Unlock reward
    const rewards = currentUser.challengeRewards || []
    const newRewards = isDone
      ? [...rewards, challenge.reward]
      : rewards

    const updated: User = {
      ...currentUser,
      activeChallenges: updatedActive,
      completedChallenges: isDone ? [...completedChallenges, challenge.id] : completedChallenges,
      challengeRewards: newRewards,
      // Apply reward to profile
      ...(isDone && challenge.reward.type === "frame" ? { selectedFrame: challenge.reward.value } : {}),
      ...(isDone && challenge.reward.type === "border" ? { selectedBorder: challenge.reward.value } : {}),
      ...(isDone && challenge.reward.type === "paint" ? { selectedBackground: challenge.reward.value } : {}),
    }

    onUpdateUser(updated)
    saveUserToMongoDB(updated)
    setConfirmDay(null)

    if (isDone) {
      const anims: Array<typeof showAnimation> = ["fireworks", "confetti", "stars"]
      setShowAnimation(anims[Math.floor(Math.random() * anims.length)])
      setTimeout(() => setShowAnimation(null), 6000)
    } else {
      setShowAnimation("sparkles")
      setTimeout(() => setShowAnimation(null), 2000)
    }
  }

  const getDayStatus = (challenge: typeof CHALLENGES[0]) => {
    const active = getActiveChallenge(challenge.id)
    if (!active) return null
    const today = new Date()
    const todayIdx = Math.floor((today.getTime() - active.startedAt) / (1000 * 60 * 60 * 24))
    const doneTodayAlready = active.completedDays.includes(todayIdx)
    return { todayIdx, doneTodayAlready, completedDays: active.completedDays, active }
  }

  const getProgressPct = (challenge: typeof CHALLENGES[0]) => {
    const active = getActiveChallenge(challenge.id)
    if (!active) return 0
    return Math.round((active.completedDays.length / challenge.durationDays) * 100)
  }

  const lang = language

  return (
    <div className="min-h-screen bg-background">
      {showAnimation && <AchievementAnimation type={showAnimation} />}

      {/* ── Confirm Start Modal ── */}
      {confirmStart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-4xl text-center mb-3">{confirmStart.icon}</div>
            <h3 className="text-xl font-bold text-center mb-2">{confirmStart.title}</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {lang === "uz"
                ? `Bu chelengni boshlaysizmi? ${confirmStart.durationDays} kun davom etadi.`
                : lang === "ru"
                  ? `Начать этот челлендж? Займёт ${confirmStart.durationDays} дней.`
                  : `Start this challenge? It lasts ${confirmStart.durationDays} days.`}
            </p>
            {confirmStart.difficulty === "iroda" && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">
                  {lang === "uz"
                    ? "Bu IRODA darajasidagi cheleng! Juda qiyin. Haqiqatan tayyor ekanligingizga ishonch hosil qiling."
                    : lang === "ru"
                      ? "Это IRODA-уровень! Очень сложно. Убедитесь, что действительно готовы."
                      : "This is IRODA level! Very hard. Make sure you're truly ready."}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmStart(null)}>
                {lang === "uz" ? "Bekor" : lang === "ru" ? "Отмена" : "Cancel"}
              </Button>
              <Button className="flex-1 bg-primary" onClick={confirmStartChallenge}>
                {lang === "uz" ? "Boshlash" : lang === "ru" ? "Начать" : "Start"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Day Modal ── */}
      {confirmDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-4xl text-center mb-3">{confirmDay.challenge.icon}</div>
            <h3 className="text-xl font-bold text-center mb-2">
              {lang === "uz" ? "Bugungi kun bajarildi?" : lang === "ru" ? "Сегодня выполнено?" : "Today done?"}
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-2">
              {confirmDay.challenge.task}
            </p>
            <p className="text-xs text-center text-muted-foreground mb-6">
              {lang === "uz" ? "Kun" : lang === "ru" ? "День" : "Day"} {confirmDay.dayIdx + 1} / {confirmDay.challenge.durationDays}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDay(null)}>
                {lang === "uz" ? "Yo'q" : lang === "ru" ? "Нет" : "No"}
              </Button>
              <Button className="flex-1 bg-primary" onClick={confirmMarkDay}>
                {lang === "uz" ? "Ha, bajardim!" : lang === "ru" ? "Да, выполнено!" : "Yes, done!"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selectedChallenge && !confirmStart && !confirmDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <button onClick={() => setSelectedChallenge(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">✕</button>
            <div className="text-5xl text-center mb-4">{selectedChallenge.icon}</div>
            <h3 className="text-2xl font-bold text-center mb-1">{selectedChallenge.title}</h3>
            <div className="flex justify-center mb-4">
              <Badge className={`${DIFFICULTY_META[selectedChallenge.difficulty].bg} ${DIFFICULTY_META[selectedChallenge.difficulty].color} ${DIFFICULTY_META[selectedChallenge.difficulty].border} border`}>
                {DIFFICULTY_META[selectedChallenge.difficulty].icon}
                <span className="ml-1">{DIFFICULTY_META[selectedChallenge.difficulty].label[lang]}</span>
              </Badge>
            </div>
            <p className="text-sm text-center text-muted-foreground mb-4">{selectedChallenge.description}</p>

            <div className="bg-muted/50 rounded-xl p-3 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{lang === "uz" ? "Davomiyligi" : lang === "ru" ? "Длительность" : "Duration"}</span>
                <span className="font-semibold">{selectedChallenge.durationDays} {lang === "uz" ? "kun" : lang === "ru" ? "дней" : "days"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{lang === "uz" ? "Vazifa" : lang === "ru" ? "Задача" : "Task"}</span>
                <span className="font-semibold text-right max-w-[60%]">{selectedChallenge.task}</span>
              </div>
            </div>

            {/* Reward preview */}
            <div className="rounded-xl p-4 mb-6" style={{ background: selectedChallenge.reward.preview.startsWith("linear") ? selectedChallenge.reward.preview : `${selectedChallenge.color}22` }}>
              <p className="text-xs text-white/70 mb-1">{lang === "uz" ? "Mukofot" : lang === "ru" ? "Награда" : "Reward"}</p>
              <p className="font-bold text-white">{selectedChallenge.reward.name}</p>
              <p className="text-xs text-white/80 mt-1">{selectedChallenge.reward.description}</p>
            </div>

            {isCompleted(selectedChallenge.id) ? (
              <div className="flex items-center justify-center gap-2 py-3 bg-green-500/20 rounded-xl text-green-400 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                {lang === "uz" ? "Bajarildi! Mukofot ochildi" : lang === "ru" ? "Выполнено! Награда получена" : "Done! Reward unlocked"}
              </div>
            ) : isActive(selectedChallenge.id) ? (
              <Button className="w-full" onClick={() => { setSelectedChallenge(null); handleMarkDay(selectedChallenge) }}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {lang === "uz" ? "Bugungi kunni belgilash" : lang === "ru" ? "Отметить сегодня" : "Mark today"}
              </Button>
            ) : (
              <Button className="w-full" onClick={() => { setSelectedChallenge(null); handleStart(selectedChallenge) }}>
                <PlayCircle className="h-4 w-4 mr-2" />
                {lang === "uz" ? "Chelengni boshlash" : lang === "ru" ? "Начать челлендж" : "Start Challenge"}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-3 sm:p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black">
              {lang === "uz" ? "Chelenglar" : lang === "ru" ? "Челленджи" : "Challenges"}
            </h1>
            <p className="text-xs text-muted-foreground">{completedCount}/{totalCount} {lang === "uz" ? "bajarildi" : lang === "ru" ? "выполнено" : "completed"}</p>
          </div>
        </div>

        {/* Overview Card */}
        <div className="relative overflow-hidden rounded-2xl mb-5 p-5 text-white"
          style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81, #4c1d95)" }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 bg-white blur-3xl" />
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Trophy className="h-8 w-8 text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="text-purple-200 text-xs mb-1">
                {lang === "uz" ? "Umumiy progress" : lang === "ru" ? "Общий прогресс" : "Overall progress"}
              </p>
              <div className="text-3xl font-black mb-2">
                {completedCount} <span className="text-purple-300 text-xl font-normal">/ {totalCount}</span>
              </div>
              <Progress value={(completedCount / totalCount) * 100} className="h-2 bg-white/20" />
            </div>
          </div>

          {/* Active challenges mini row */}
          {activeChallenges.filter(a => !a.isCompleted).length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/20">
              <p className="text-xs text-purple-300 mb-2">
                {lang === "uz" ? "Faol chelenglar" : lang === "ru" ? "Активные" : "Active"}
              </p>
              <div className="flex gap-2 flex-wrap">
                {activeChallenges.filter(a => !a.isCompleted).map(a => {
                  const ch = CHALLENGES.find(c => c.id === a.challengeId)
                  if (!ch) return null
                  const pct = Math.round((a.completedDays.length / ch.durationDays) * 100)
                  return (
                    <div key={a.challengeId} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1.5">
                      <span className="text-base">{ch.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-white leading-none">{ch.title}</p>
                        <p className="text-[10px] text-purple-300">{pct}%</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Difficulty Filter */}
        <div className="flex gap-2 flex-wrap mb-5">
          {(["all", "oson", "ortacha", "qiyin", "iroda"] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={activeFilter === f ? "default" : "outline"}
              onClick={() => setActiveFilter(f)}
              className={`h-8 text-xs gap-1 ${f === "iroda" && activeFilter !== "iroda" ? "border-red-500/40 text-red-400" : ""}`}
            >
              {f === "all" ? (lang === "uz" ? "Hammasi" : lang === "ru" ? "Все" : "All") :
               f === "iroda" ? <><Sword className="h-3 w-3" /> IRODA</> :
               <>{DIFFICULTY_META[f].icon} {DIFFICULTY_META[f].label[lang]}</>}
            </Button>
          ))}
        </div>

        {/* Challenges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(challenge => {
            const meta = DIFFICULTY_META[challenge.difficulty]
            const dayStatus = getDayStatus(challenge)
            const progress = getProgressPct(challenge)
            const done = isCompleted(challenge.id)
            const active = isActive(challenge.id)
            const isIroda = challenge.difficulty === "iroda"

            return (
              <Card
                key={challenge.id}
                onClick={() => setSelectedChallenge(challenge)}
                className={`relative overflow-hidden cursor-pointer transition-all hover:scale-[1.01] hover:shadow-xl p-4
                  ${done ? "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/40" :
                    isIroda ? "bg-gradient-to-br from-red-950/40 to-black border-2 border-red-500/40 shadow-lg shadow-red-500/10" :
                    active ? `${meta.bg} border-2 ${meta.border} shadow-lg ${meta.glow}` :
                    "border border-border hover:border-primary/40"}
                `}
              >
                {/* IRODA special glow effect */}
                {isIroda && !done && (
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-red-500/5 to-transparent" />
                )}

                <div className="flex items-start gap-3 mb-3">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0
                    ${done ? "bg-green-500/20" : isIroda ? "bg-red-500/20" : `${meta.bg}`}
                  `}>
                    {done ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : challenge.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className={`font-bold text-base ${isIroda && !done ? "text-red-300" : ""}`}>
                        {challenge.title}
                      </h3>
                      {isIroda && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/40 border text-[10px] px-1.5">
                          <Sword className="h-3 w-3 mr-0.5" /> IRODA
                        </Badge>
                      )}
                      {!isIroda && (
                        <Badge className={`${meta.bg} ${meta.color} ${meta.border} border text-[10px] px-1.5`}>
                          {meta.label[lang]}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{challenge.description}</p>
                  </div>

                  {!active && !done && <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {challenge.durationDays} {lang === "uz" ? "kun" : lang === "ru" ? "дн" : "d"}
                  </div>
                  {active && dayStatus && (
                    <div className="flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-400" />
                      <span className="text-orange-400">{dayStatus.completedDays.length} {lang === "uz" ? "kun bajarildi" : lang === "ru" ? "дней" : "days done"}</span>
                    </div>
                  )}
                </div>

                {/* Progress bar for active */}
                {active && !done && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{lang === "uz" ? "Progress" : lang === "ru" ? "Прогресс" : "Progress"}</span>
                      <span className="font-semibold" style={{ color: challenge.color }}>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {/* Reward preview */}
                <div className={`rounded-xl p-2.5 flex items-center gap-2.5 mb-3
                  ${done ? "bg-green-500/20" : "bg-muted/40"}
                `}>
                  <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{
                    background: challenge.reward.preview.startsWith("linear") ? challenge.reward.preview : challenge.color + "33",
                    border: `1px solid ${challenge.color}44`,
                  }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground capitalize">{challenge.reward.type}</p>
                    <p className="text-xs font-semibold truncate">{challenge.reward.name}</p>
                  </div>
                  {done && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                </div>

                {/* Action button */}
                <div onClick={e => e.stopPropagation()}>
                  {done ? (
                    <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      {lang === "uz" ? "Bajarildi ✓" : lang === "ru" ? "Выполнено ✓" : "Completed ✓"}
                    </div>
                  ) : active ? (
                    dayStatus?.doneTodayAlready ? (
                      <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        {lang === "uz" ? "Bugun belgilangan" : lang === "ru" ? "Сегодня отмечено" : "Today marked"}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full h-9"
                        style={{ background: challenge.color }}
                        onClick={() => handleMarkDay(challenge)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        {lang === "uz" ? "Bugunni belgilash" : lang === "ru" ? "Отметить сегодня" : "Mark today"}
                      </Button>
                    )
                  ) : (
                    <Button
                      size="sm"
                      variant={isIroda ? "default" : "outline"}
                      className={`w-full h-9 gap-1.5 ${isIroda ? "bg-red-600 hover:bg-red-700 text-white border-0" : ""}`}
                      onClick={() => handleStart(challenge)}
                    >
                      <PlayCircle className="h-4 w-4" />
                      {lang === "uz" ? "Boshlash" : lang === "ru" ? "Начать" : "Start"}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
