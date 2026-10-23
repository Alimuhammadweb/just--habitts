import "dotenv/config"
import { defineConfig } from "prisma/config"

// Migratsiyalar uchun to'g'ridan-to'g'ri (pooler'siz) ulanish ishlatiladi: DIRECT_URL.
// Agar DIRECT_URL berilmagan bo'lsa, DATABASE_URL ishlatiladi.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
})
