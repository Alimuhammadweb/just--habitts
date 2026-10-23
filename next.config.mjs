import { fileURLToPath } from "url"
import path from "path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Prisma + pg driver adapter server tomonida ishlaydi; `pg` Node.js moduli sifatida
  // bundle'ga qo'shilmaydi (Vercel serverless'da barqaror ishlashi uchun).
  serverExternalPackages: ["pg"],
  // Loyiha papkasidan tashqarida (masalan C:\Users\user\) boshqa
  // package-lock.json bo'lsa, Next.js noto'g'ri "workspace root"ni
  // aniqlab, modul yo'llarini chalkashtirib yuborishi mumkin edi.
  // Shu yerda aniq ko'rsatib qo'yamiz.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
