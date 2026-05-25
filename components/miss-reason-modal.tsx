"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { translations, type Language } from "@/lib/translations"

interface MissReasonModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  language: Language
  habitName: string
}

export default function MissReasonModal({ isOpen, onClose, onConfirm, language, habitName }: MissReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("")
  const [customReason, setCustomReason] = useState<string>("")
  const t = translations[language]

  if (!isOpen) return null

  const predefinedReasons = [
    t.missReasons.forgot,
    t.missReasons.busy,
    t.missReasons.tired,
    t.missReasons.sick,
    t.missReasons.noMood,
  ]

  const handleSubmit = () => {
    const finalReason = selectedReason === "custom" ? customReason : selectedReason
    if (finalReason.trim()) {
      onConfirm(finalReason)
      setSelectedReason("")
      setCustomReason("")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-2">{t.whySkip}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {habitName} - {t.skipReason}
        </p>

        <div className="space-y-2 mb-4">
          {predefinedReasons.map((reason) => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                selectedReason === reason
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 bg-background"
              }`}
            >
              {reason}
            </button>
          ))}

          <button
            onClick={() => setSelectedReason("custom")}
            className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
              selectedReason === "custom"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 bg-background"
            }`}
          >
            {t.missReasons.other}
          </button>

          {selectedReason === "custom" && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={t.writeReason}
              className="w-full p-3 rounded-lg border-2 border-border bg-background focus:border-primary focus:outline-none resize-none"
              rows={3}
            />
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
            {t.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedReason || (selectedReason === "custom" && !customReason.trim())}
            className="flex-1"
          >
            {t.confirm}
          </Button>
        </div>
      </div>
    </div>
  )
}
