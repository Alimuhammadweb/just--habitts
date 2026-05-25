"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Zap, Clock } from "lucide-react"
import type { Habit } from "@/types/user"
import { type Language, translations } from "@/lib/translations"
import {
  HABIT_TEMPLATES, TEMPLATE_CATEGORIES,
  getDifficultyLabel, getDifficultyColor,
  getTemplateName, getTemplateWhy,
  type HabitTemplate,
} from "@/lib/habit-templates"

interface HabitTemplatesModalProps {
  onClose: () => void
  onAdd: (habit: Habit) => void
  language: Language
}

export function HabitTemplatesModal({ onClose, onAdd, language }: HabitTemplatesModalProps) {
  const t = translations[language]
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedTemplate, setSelectedTemplate] = useState<HabitTemplate | null>(null)

  const categories = ["all", "health", "mind", "career", "finance"]
  const categoryLabel = (c: string) => {
    if (c === "all") return language === "uz" ? "Barchasi" : language === "ru" ? "Все" : "All"
    return TEMPLATE_CATEGORIES[c as keyof typeof TEMPLATE_CATEGORIES]?.[language] || c
  }

  const filtered = selectedCategory === "all"
    ? HABIT_TEMPLATES
    : HABIT_TEMPLATES.filter(t => t.category === selectedCategory)

  const handleAdd = (template: HabitTemplate) => {
    const now = new Date()
    const habit: Habit = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: getTemplateName(template, language),
      why: getTemplateWhy(template, language),
      duration: template.duration,
      days: {},
      dayLocks: {},
      missReasons: {},
      notifications: false,
      time: template.timeHour !== undefined
        ? { hour: template.timeHour, minute: template.timeMinute || 0 }
        : null,
      startDate: {
        day: now.getDate(),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        timestamp: now.getTime(),
      },
    }
    onAdd(habit)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-bold text-base">
              {language === "uz" ? "📋 Tayyor odatlar" : language === "ru" ? "📋 Готовые привычки" : "📋 Habit Templates"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {language === "uz" ? "Bir bosish bilan qo'shing" : language === "ru" ? "Добавьте одним нажатием" : "Add with one tap"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 p-3 overflow-x-auto shrink-0 border-b border-border">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                selectedCategory === c
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {categoryLabel(c)}
            </button>
          ))}
        </div>

        {/* Templates grid */}
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {filtered.map(template => (
            <div
              key={template.id}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                selectedTemplate?.id === template.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
              onClick={() => setSelectedTemplate(template.id === selectedTemplate?.id ? null : template)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xl shrink-0">{template.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{getTemplateName(template, language)}</p>
                    <p className="text-xs text-muted-foreground truncate">{getTemplateWhy(template, language)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium ${getDifficultyColor(template.difficulty)}`}>
                    {getDifficultyLabel(template.difficulty, language)}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {template.duration}
                    {language === "uz" ? "k" : language === "ru" ? "д" : "d"}
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {selectedTemplate?.id === template.id && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {template.timeHour !== undefined && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {String(template.timeHour).padStart(2, "0")}:{String(template.timeMinute || 0).padStart(2, "0")}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      {template.duration} {language === "uz" ? "kun" : language === "ru" ? "дней" : "days"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleAdd(template) }}
                    className="w-full h-8 text-xs"
                  >
                    {language === "uz" ? "✅ Qo'shish" : language === "ru" ? "✅ Добавить" : "✅ Add habit"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
