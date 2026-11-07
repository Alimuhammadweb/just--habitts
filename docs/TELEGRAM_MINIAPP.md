# Telegram Mini App orqali kirish

Foydalanuvchi botni ochadi → Mini App ishga tushadi → Just Habits `initData` ni serverga yuboradi → server imzoni tekshiradi →
hisob avtomatik topiladi yoki ochiladi → dashboard. Kod, SMS, email yoki ro'yxatdan o'tish formasi YO'Q.

## 1. Server sozlamalari (Vercel → Settings → Environment Variables)
| O'zgaruvchi | Majburiy | Izoh |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ha | BotFather tokeni. Faqat serverda, `NEXT_PUBLIC_` BILAN BOSHLANMAYDI |
| `TELEGRAM_BOT_USERNAME` | ha | `@` siz, masalan `JustHabitsBot` |
| `TELEGRAM_MINIAPP_SHORT_NAME` | yo'q | Bot "Asosiy Mini App" bo'lsa kerak emas. `/newapp` bilan alohida Mini App yaratilgan bo'lsa — uning short name'i (ulash havolasi `t.me/<bot>/<short>?startapp=…` bo'ladi) |
| `TELEGRAM_INITDATA_MAX_AGE_SECONDS` | yo'q | initData yaroqlilik muddati, standart 86400 (24 soat) |
| `EXTRA_ALLOWED_ORIGIN` | yo'q | O'z domeningiz `just-habitts-steel.vercel.app` bo'lmasa, `https://domeningiz` |

Migratsiya (faqat qo'shadi, hech narsani o'chirmaydi): `npx prisma migrate deploy` — yangi: `20261108000000_telegram_miniapp`
(`User` jadvaliga 5 ta NULL bo'lishi mumkin `telegram*` ustuni). `telegramId` (UNIQUE) avvalgi migratsiyada bor.

## 2. BotFather: Launch tugmasi
Kod bot ichida emas (botni o'zgartirmaymiz) — Mini App havolasi BotFather'da sozlanadi:
1. `/mybots` → botingiz → **Bot Settings → Configure Mini App** (yoki **Menu Button**) → **Enable/Edit**.
2. URL: `https://just-habitts-steel.vercel.app` (HTTPS majburiy, `/` bilan tugasa ham bo'ladi).
3. Shundan so'ng bot profilida "Open app" / chat tagida menyu tugmasi chiqadi.
Eski `/setdomain` (Login Widget uchun) endi kerak emas.

## 3. Mavjud foydalanuvchilar
Mavjud hisoblar HECH QACHON ism/username bo'yicha avtomatik birlashtirilmaydi. Telegram kirishi yangi, alohida hisob ochadi.
Eski hisobni Telegram'ga ulash uchun: **brauzerda eski hisobga kiring → Profil → "Telegram'ni ulash"** → Telegram ochiladi →
Mini App hisob nomini ko'rsatadi → **"Ha, ulash"**. Havola imzolangan, 10 daqiqalik va bir martalik; tasdiqlashsiz hech narsa ulanmaydi.
Agar foydalanuvchi ulashdan oldin Mini App'ni ochib, hali BO'SH (XP/odat/vazifa yo'q) avto-hisob ochib qo'ygan bo'lsa, u hisob
Telegram ID'dan ajratiladi (o'chirilmaydi). Ma'lumotli ikkinchi hisob bo'lsa — ulash 409 bilan rad etiladi, hech narsa o'zgarmaydi.

## 4. Xavfsizlik xulosasi
- Faqat xom `initData` qabul qilinadi; `HMAC_SHA256("WebAppData", bot_token)` kaliti bilan tekshiriladi, `timingSafeEqual`. `initDataUnsafe` ishlatilmaydi.
- `auth_date` tekshiriladi (eskirgan/kelajakdagi rad etiladi), `is_bot` rad etiladi, takroriy kalitlar rad etiladi.
- Sessiya: mavjud JWT access (15 daq) + refresh (30 kun, DB'da, logoutda bekor qilinadi) HttpOnly cookie'lar; `Secure` productionda, `SameSite=Lax`.
- Mini App ichida har ochilishda sessiya Telegram imzosi bilan qayta aniqlanadi — qurilmadagi eski cookie boshqa Telegram akkauntga o'tib ketmaydi.
- Mini App ichida logout qilsangiz, sahifa yangilanganda avtomatik qayta kirmaydi ("Telegram bilan kirish" tugmasi chiqadi).
- IP bo'yicha rate limit; ulash tokeni bir martalik.

## 5. Sinash
```
npm run test                                   # birlik testlari (initData tekshiruvi)
BASE_URL=http://localhost:3000 LEGACY_USER_ID=<ixtiyoriy> npx tsx scripts/smoke-telegram.ts   # haqiqiy server + baza, TEST bazasida!
```
Server `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `EXTRA_ALLOWED_ORIGIN=$BASE_URL` bilan ishlashi kerak. Haqiqiy Telegram'da
sinash: deploydan keyin botni oching (Mini App faqat HTTPS'da, `localhost`da emas — lokal uchun ngrok/cloudflared kerak).
