// Uzbek sana nomlari (yagona manba)
export const WEEKDAYS_SHORT = ["Du", "Se", "Chor", "Pay", "Ju", "Sha", "Ya"]
export const WEEKDAYS_LONG = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]
export const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]

/** "2026-10-22" -> "22-oktabr" */
export const dayMonth = (key: string) => { const [, m, d] = key.split("-").map(Number); return `${d}-${MONTHS[m - 1]}` }
export const dayMonthYear = (key: string) => `${dayMonth(key)}, ${key.slice(0, 4)}`
export const dayOfMonth = (key: string) => Number(key.slice(8, 10))
export const plural = (n: number, word: string) => `${n} ta ${word}`
