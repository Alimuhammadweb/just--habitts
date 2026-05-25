"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Clock, Play, Pause, RotateCcw, Calendar, ArrowLeft } from "lucide-react"
import { translations, type Language } from "@/lib/translations"
import type { PomodoroData } from "@/types/user"

interface PomodoroPageProps {
  language: Language
  onBack: () => void
  userId: number
  isTimerRunning: boolean
  timerTimeLeft: number
  timerDuration: number
  onTimerStateChange: (isRunning: boolean, timeLeft: number, duration?: number) => void
  pomodoroData?: PomodoroData
}

export function PomodoroPage({
  language,
  onBack,
  userId,
  isTimerRunning,
  timerTimeLeft,
  timerDuration,
  onTimerStateChange,
  pomodoroData: pomodoroDataProp,
}: PomodoroPageProps) {
  const t = translations[language]
  // Use data from DB (passed via prop) instead of localStorage
  const pomodoroData: PomodoroData = pomodoroDataProp || { sessions: [], totalPomodoros: 0 }
  const [showHistory, setShowHistory] = useState(false)

  const toggleTimer = () => {
    onTimerStateChange(!isTimerRunning, timerTimeLeft, timerDuration)
  }

  const resetTimer = () => {
    onTimerStateChange(false, timerDuration * 60, timerDuration)
  }

  const changeDuration = (newDuration: number) => {
    onTimerStateChange(false, newDuration * 60, newDuration)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getTodayPomodoros = () => {
    const today = new Date().toISOString().split("T")[0]
    const session = pomodoroData.sessions.find((s) => s.date === today)
    return session?.count || 0
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(language === "ru" ? "ru-RU" : language === "en" ? "en-US" : "uz-UZ")
  }

  const handleBackClick = () => {
    if (showHistory) {
      setShowHistory(false)
    } else {
      onBack()
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" size="icon" onClick={handleBackClick}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">{t.pomodoro}</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs sm:text-sm"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {t.history}
          </Button>
        </div>

        {!showHistory ? (
          <>
            {/* Tomato Icon */}
            <div className="text-center mb-8">
              <div className="inline-block text-8xl sm:text-9xl animate-bounce">🍅</div>
            </div>

            {/* Timer Display */}
            <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 mb-8 text-center">
              <div className="text-6xl sm:text-8xl font-bold mb-4 font-mono">{formatTime(timerTimeLeft)}</div>
              <div className="flex items-center justify-center gap-4 mb-6">
                <Button size="lg" onClick={toggleTimer} className="rounded-full h-16 w-16 sm:h-20 sm:w-20">
                  {isTimerRunning ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={resetTimer}
                  className="rounded-full h-16 w-16 sm:h-20 sm:w-20 bg-transparent"
                >
                  <RotateCcw className="h-8 w-8" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{isTimerRunning ? t.pause : t.start}</p>
            </div>

            {/* Duration Selection */}
            <div className="bg-card border border-border rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t.setTimer}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[15, 25, 45, 60].map((mins) => (
                  <Button
                    key={mins}
                    variant={timerDuration === mins ? "default" : "outline"}
                    onClick={() => changeDuration(mins)}
                    disabled={isTimerRunning}
                    className="h-12"
                  >
                    {mins} {t.minutes}
                  </Button>
                ))}
              </div>
            </div>

            {/* Today's Stats */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-6 text-white text-center">
              <div className="text-4xl sm:text-5xl font-bold mb-2">{getTodayPomodoros()}</div>
              <p className="text-sm sm:text-base opacity-90">
                {t.today} - {t.tomatoCompleted}
              </p>
            </div>
          </>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-6">{t.history}</h2>
            {pomodoroData.sessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t.didNotWork}</p>
            ) : (
              <div className="space-y-3">
                {[...pomodoroData.sessions]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{formatDate(session.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🍅</span>
                        <span className="font-bold text-lg">{session.count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
