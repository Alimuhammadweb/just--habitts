import { json } from "@/lib/server/api"

// Mijoz qaysi imkoniyatlar sozlanganini biladi (parolni tiklash havolasi faqat to'liq sozlangan bo'lsa ko'rsatiladi).
export async function GET() {
  return json({ passwordReset: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM && process.env.APP_URL) })
}
