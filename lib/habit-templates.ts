import type { Language } from "@/lib/translations"

export interface HabitTemplate {
  id: string
  emoji: string
  nameUz: string
  nameRu: string
  nameEn: string
  whyUz: string
  whyRu: string
  whyEn: string
  duration: number
  category: "health" | "mind" | "career" | "social" | "finance"
  difficulty: "easy" | "medium" | "hard"
  timeHour?: number
  timeMinute?: number
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  // 🏃 Sog'liq
  { id: "morning-run", emoji: "🏃", nameUz: "Ertalab yugurish", nameRu: "Утренняя пробежка", nameEn: "Morning run",
    whyUz: "Sog'lom tana — baxtli hayot", whyRu: "Здоровое тело — счастливая жизнь", whyEn: "Healthy body, happy life",
    duration: 30, category: "health", difficulty: "medium", timeHour: 7, timeMinute: 0 },
  { id: "drink-water", emoji: "💧", nameUz: "2L suv ichish", nameRu: "Пить 2л воды", nameEn: "Drink 2L water",
    whyUz: "Suv — hayot manbai", whyRu: "Вода — источник жизни", whyEn: "Water is life",
    duration: 21, category: "health", difficulty: "easy" },
  { id: "sleep-early", emoji: "😴", nameUz: "23:00 da yotish", nameRu: "Ложиться в 23:00", nameEn: "Sleep at 11PM",
    whyUz: "Yaxshi uyqu — kuchli kun", whyRu: "Хороший сон — продуктивный день", whyEn: "Good sleep = great day",
    duration: 30, category: "health", difficulty: "medium", timeHour: 23, timeMinute: 0 },
  { id: "no-sugar", emoji: "🚫🍬", nameUz: "Shakar iste'mol qilmaslik", nameRu: "Не есть сахар", nameEn: "No sugar",
    whyUz: "Sog'lom ovqatlanish odati", whyRu: "Здоровое питание", whyEn: "Healthy eating habit",
    duration: 30, category: "health", difficulty: "hard" },
  { id: "workout", emoji: "💪", nameUz: "Sport mashqlari", nameRu: "Тренировка", nameEn: "Workout",
    whyUz: "Kuchli tana — kuchli ruh", whyRu: "Сильное тело — сильный дух", whyEn: "Strong body, strong mind",
    duration: 60, category: "health", difficulty: "medium", timeHour: 18, timeMinute: 0 },
  { id: "walk-steps", emoji: "🚶", nameUz: "10,000 qadam", nameRu: "10,000 шагов", nameEn: "10,000 steps",
    whyUz: "Harakatda hayot", whyRu: "В движении жизнь", whyEn: "Movement is life",
    duration: 30, category: "health", difficulty: "easy" },

  // 🧠 Aql
  { id: "read-book", emoji: "📚", nameUz: "30 daqiqa kitob o'qish", nameRu: "30 минут чтения", nameEn: "Read 30 minutes",
    whyUz: "Bilim — eng yaxshi investitsiya", whyRu: "Знания — лучшая инвестиция", whyEn: "Knowledge is power",
    duration: 30, category: "mind", difficulty: "easy", timeHour: 21, timeMinute: 0 },
  { id: "meditate", emoji: "🧘", nameUz: "10 daqiqa meditatsiya", nameRu: "10 минут медитации", nameEn: "10min meditation",
    whyUz: "Tinch aql — kuchli qarorlar", whyRu: "Спокойный ум — правильные решения", whyEn: "Calm mind, better decisions",
    duration: 21, category: "mind", difficulty: "easy", timeHour: 7, timeMinute: 30 },
  { id: "journaling", emoji: "✍️", nameUz: "Kundalik yozish", nameRu: "Вести дневник", nameEn: "Daily journaling",
    whyUz: "O'z-o'zini anglash kuchi", whyRu: "Сила самопознания", whyEn: "Power of self-reflection",
    duration: 30, category: "mind", difficulty: "easy", timeHour: 22, timeMinute: 0 },
  { id: "learn-language", emoji: "🌍", nameUz: "Til o'rganish (Duolingo)", nameRu: "Учить язык (Duolingo)", nameEn: "Learn language (Duolingo)",
    whyUz: "Yangi til — yangi dunyo", whyRu: "Новый язык — новый мир", whyEn: "New language, new world",
    duration: 30, category: "mind", difficulty: "easy" },
  { id: "no-phone-morning", emoji: "📵", nameUz: "Ertalab 1 soat telefonsiz", nameRu: "Час без телефона утром", nameEn: "1hr no phone morning",
    whyUz: "Saboqli ertalab — muvaffaqiyatli kun", whyRu: "Продуктивное утро — успешный день", whyEn: "Productive mornings",
    duration: 21, category: "mind", difficulty: "medium" },

  // 💼 Kasb
  { id: "coding", emoji: "💻", nameUz: "Kod yozish (1 soat)", nameRu: "Писать код (1 час)", nameEn: "Coding (1 hour)",
    whyUz: "Dasturlash — kelajak kasbi", whyRu: "Программирование — профессия будущего", whyEn: "Coding is the future",
    duration: 60, category: "career", difficulty: "medium" },
  { id: "english", emoji: "🇬🇧", nameUz: "Ingliz tili (30 daqiqa)", nameRu: "Английский (30 минут)", nameEn: "English (30 minutes)",
    whyUz: "Ingliz tili — global imkoniyatlar", whyRu: "Английский — глобальные возможности", whyEn: "English opens doors",
    duration: 30, category: "career", difficulty: "easy" },
  { id: "deep-work", emoji: "🎯", nameUz: "2 soat chuqur ish", nameRu: "2 часа глубокой работы", nameEn: "2hr deep work",
    whyUz: "Chalg'imasdan ishlash — yuqori natija", whyRu: "Сфокусированная работа = результат", whyEn: "Focus = results",
    duration: 30, category: "career", difficulty: "hard", timeHour: 9, timeMinute: 0 },

  // 💰 Moliya
  { id: "save-money", emoji: "💰", nameUz: "Kunlik xarajat yozish", nameRu: "Записывать расходы", nameEn: "Track daily expenses",
    whyUz: "Pul boshqaruvi — erkinlik", whyRu: "Управление деньгами — свобода", whyEn: "Money management = freedom",
    duration: 30, category: "finance", difficulty: "easy" },
  { id: "no-impulse", emoji: "🛒", nameUz: "Impulsiv xarid qilmaslik", nameRu: "Не покупать импульсивно", nameEn: "No impulse buying",
    whyUz: "Aqlli xarid — ko'proq tejash", whyRu: "Умные покупки — больше сбережений", whyEn: "Smart spending",
    duration: 30, category: "finance", difficulty: "medium" },
]

export const TEMPLATE_CATEGORIES = {
  health:  { uz: "🏃 Sog'liq",  ru: "🏃 Здоровье",   en: "🏃 Health"  },
  mind:    { uz: "🧠 Aql",      ru: "🧠 Разум",       en: "🧠 Mind"    },
  career:  { uz: "💼 Kasb",     ru: "💼 Карьера",     en: "💼 Career"  },
  social:  { uz: "👥 Ijtimoiy", ru: "👥 Социальное",  en: "👥 Social"  },
  finance: { uz: "💰 Moliya",   ru: "💰 Финансы",     en: "💰 Finance" },
}

export function getDifficultyLabel(d: string, lang: Language) {
  const labels: Record<string, Record<string, string>> = {
    easy:   { uz: "Oson",   ru: "Лёгкий",   en: "Easy"   },
    medium: { uz: "O'rta",  ru: "Средний",  en: "Medium" },
    hard:   { uz: "Qiyin",  ru: "Сложный",  en: "Hard"   },
  }
  return labels[d]?.[lang] || d
}

export function getDifficultyColor(d: string) {
  return d === "easy" ? "text-green-400" : d === "medium" ? "text-yellow-400" : "text-red-400"
}

export function getTemplateName(t: HabitTemplate, lang: Language) {
  return lang === "uz" ? t.nameUz : lang === "ru" ? t.nameRu : t.nameEn
}

export function getTemplateWhy(t: HabitTemplate, lang: Language) {
  return lang === "uz" ? t.whyUz : lang === "ru" ? t.whyRu : t.whyEn
}
