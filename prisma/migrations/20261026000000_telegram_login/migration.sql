-- Faqat QO'SHISH: mavjud ma'lumotlarga tegmaydi.
ALTER TABLE "User" ADD COLUMN "telegramId" BIGINT;
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
