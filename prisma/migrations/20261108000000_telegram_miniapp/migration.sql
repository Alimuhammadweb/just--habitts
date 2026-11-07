-- Telegram Mini App autentifikatsiyasi. Faqat QO'SHISH: mavjud foydalanuvchilar va ularning ma'lumotlariga tegmaydi.
-- Barcha ustunlar NULL bo'lishi mumkin (mavjud qatorlar o'zgarishsiz qoladi); User.telegramId va uning UNIQUE indeksi
-- avvalgi migratsiyada (20261026000000_telegram_login) allaqachon bor.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramUsername"     TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramFirstName"    TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLastName"     TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramPhotoUrl"     TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLanguageCode" TEXT;
