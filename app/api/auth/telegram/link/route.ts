import { fail } from "@/lib/server/api"

// ESKIRGAN: Telegram Login Widget orqali ulash olib tashlandi.
// Yangi usul: POST /api/auth/telegram/link-token (Profil → "Telegram'ni ulash"), ulash Mini App ichida bajariladi.
// Bu fayl eski loyiha ustiga zip ochilganda eski (endi mavjud bo'lmagan importlarga tayanadigan) route build'ni buzmasligi uchun qoldirilgan; uni o'chirsangiz ham bo'ladi.
export async function POST() {
  return fail(410, "Bu usul olib tashlangan. Profil sahifasidan Telegram'ni qayta ulang.", "GONE")
}
