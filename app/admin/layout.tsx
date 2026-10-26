import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/auth"
import { verifyAdminActor } from "@/lib/server/admin"

export const dynamic = "force-dynamic" // har so'rovda sessiya tekshiriladi, keshlanmaydi
export const metadata: Metadata = { title: "Admin — Just Habits", robots: { index: false, follow: false } }

// SERVER tomonidagi himoya: /admin ichidagi hech bir sahifa admin tasdiqlanmaguncha chizilmaydi.
//  - sessiya yo'q / access token eskirgan → bosh sahifaga (u tokenni yangilab, adminni qaytaradi)
//  - sessiya bor, lekin admin emas → oddiy ilovaga (admin sahifasi mavjudligi ham sezdirilmaydi)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  const session = token ? await verifyAccessToken(token) : null
  if (!session) redirect("/?admin=1")
  const actor = await verifyAdminActor(session) // bazadan: adminligi olib tashlangan/bloklangan bo'lsa kirolmaydi
  if (!actor) redirect("/")
  return <>{children}</>
}
