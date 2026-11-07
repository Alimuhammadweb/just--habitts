# Just Habits — MongoDB → PostgreSQL (Prisma) ko'chirish qo'llanmasi

Ilova endi to'liq **PostgreSQL + Prisma 7** da ishlaydi. `mongodb` paketi faqat bir martalik import skripti uchun
(`devDependencies`) qoldi — ilova kodi uni ishlatmaydi.

## 1. Environment o'zgaruvchilari

| Nomi | Majburiy | Izoh |
|---|---|---|
| `DATABASE_URL` | ha | Ilova ishlatadigan PostgreSQL manzili. Neon/Supabase bo'lsa **pooled** manzil |
| `DIRECT_URL` | tavsiya | Migratsiyalar uchun to'g'ridan-to'g'ri (pooler'siz) manzil. Bo'sh bo'lsa `DATABASE_URL` ishlatiladi |
| `JWT_SECRET` | ha | Avvalgidek |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | ha (production) | Avvalgidek |
| `RESEND_API_KEY`, `RESEND_FROM`, `APP_URL` | yo'q | Parolni tiklash emaili |
| `CRON_SECRET` | tavsiya | Haftalik email cron kaliti |
| `MONGODB_URI` | faqat import | Eski baza — **faqat lokal kompyuteringizda**, Vercel'ga qo'shish shart emas |

Namuna: `.env.example`.

## 2. Lokal ishga tushirish

```bash
cp .env.example .env        # DATABASE_URL, DIRECT_URL, JWT_SECRET, ADMIN_* ni to'ldiring
npm install                 # postinstall avtomatik `prisma generate` qiladi
npm run db:migrate          # jadvallarni yaratadi (prisma migrate deploy — hech narsani o'chirmaydi)
npm run dev
```

## 3. Ma'lumotlarni MongoDB'dan ko'chirish

`.env` ga `MONGODB_URI` ni qo'shing, so'ng:

```bash
npm run db:import:dry   # 1) faqat o'qiydi, Postgres'ga yozmaydi — nechta yozuv ko'chirilishini ko'rsatadi
npm run db:import       # 2) import + manba ↔ Postgres sonlarini avtomatik solishtirish
npm run db:validate     # (ixtiyoriy) keyinroq qayta solishtirish
```

- MongoDB'ga **faqat o'qish** so'rovlari yuboriladi. U yerda hech narsa o'zgarmaydi va o'chirilmaydi.
- Parol xeshlari va `salt` aynan ko'chiriladi — foydalanuvchilar eski parollari bilan kirishda davom etadi.
- Hisobot `migration-report.json` ga yoziladi (parol/email yo'q): o'tkazib yuborilgan yozuvlar va sabablari.
- Emaillar kichik harfga o'tkaziladi (login ham kichik harf bilan qidiradi). Takroriy email yoki yaroqsiz `id` bo'lsa, yozuv o'tkazib yuboriladi va hisobotda ko'rsatiladi.
- To'qnashgan odat/izoh ID'lari deterministik tarzda qayta beriladi (XP tarixi yangi ID'ga yo'naltiriladi).
- Ko'chirilmaydi: `rate_limits` (vaqtinchalik hisoblagich), muddati o'tgan/bekor qilingan tokenlar.

**Muhim — qayta ishga tushirish:** import foydalanuvchilarni `id` bo'yicha **qayta yozadi** (upsert).
Shuning uchun uni *trafikni Postgres'ga o'tkazishdan oldin* (oxirgi marta) ishga tushiring. Postgres'da
yangi ma'lumot to'plana boshlagach, importni qayta ishlatmang.

## 4. Vercel'da sozlash

1. PostgreSQL bazasini yarating (Vercel → Storage → Neon, yoki Supabase).
2. Vercel → Project → **Settings → Environment Variables** (Production, kerak bo'lsa Preview ham):
   - `DATABASE_URL` = pooled manzil
   - `DIRECT_URL` = direct manzil
   - mavjud `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` va boshqalar o'z joyida qoladi
3. Deploy qiling. `vercel-build` skripti ketma-ket bajaradi: `prisma generate` → `prisma migrate deploy` → `next build`.
   Migratsiya faqat yangi jadvallarni yaratadi/yangilaydi — ma'lumotni o'chirmaydi.
4. Tekshiring: `https://<domen>/api/health` → `{"status":"ok"}`, so'ng login qilib ko'ring.
5. Avvalgi (Mongo'dagi) deploy va MongoDB ma'lumotlari hamma narsa tasdiqlanmaguncha tegilmay turadi — muammo bo'lsa, Vercel'da oldingi deploy'ga qaytish (Instant Rollback) kifoya.

## 5. Sxema xaritasi

| MongoDB | PostgreSQL |
|---|---|
| `users` (ichma-ich hujjat) | `User` + `Habit`/`HabitDay`, `XpHistory`, `PomodoroSession`, `ActiveChallenge`, `Friendship`, `FriendRequest` |
| `users.xpData/stats/pomodoroData` | `User` ustunlari (`totalXP`, `weeklyXP`, `weekKey`, ...) — reyting indeks orqali |
| `users._rev` | `User.rev` (parallel yozuvlarni nazorat qilish) |
| `weekly_tasks` | `WeeklyTask` (ID: avvalgi ObjectId hex satri saqlanadi) |
| `community_posts` (+izoh/reaksiya massivlari) | `CommunityPost`, `Comment`, `Reaction` (bir user — bir post — bitta reaksiya: unique) |
| `refresh_tokens`, `password_resets`, `rate_limits` | `RefreshToken`, `PasswordReset`, `RateLimit` (TTL o'rniga `expiresAt` + vaqti-vaqti bilan tozalash) |

Foydalanuvchi o'chirilsa, unga tegishli barcha yozuvlar `ON DELETE CASCADE` bilan o'chadi.

## 6. Xavfsizlik bo'yicha o'zgarishlar (migratsiya paytida mustahkamlangan)

- Do'stlikni qabul qilish endi faqat **haqiqiy kelgan so'rov** bo'lsa ishlaydi (avval istalgan ID bilan majburlab do'st bo'lish mumkin edi).
- Do'st qidiruvi foydalanuvchi matnini regex sifatida emas, parametrlangan `LIKE` sifatida ishlatadi.
- Jamoa postlarida muallif ismi/avatari, admin belgisi va `userId` mijozdan emas, sessiya va bazadan olinadi; admin PATCH faqat ruxsat etilgan maydonlarni qabul qiladi; reaksiya turi tekshiriladi.
- Avatar yuklashda manzil formati va hajmi tekshiriladi.
- `/api/health` ulanish manzilini hech qachon chiqarmaydi.

## 7. Eslatmalar

- Boshlang'ich migratsiya SQL (`prisma/migrations/20261022000000_init`) qo'lda yozilgan va lokal PostgreSQL 16'da sinalgan.
  Shunga qaramay, birinchi deploy'dan so'ng `npx prisma migrate status` ni ishga tushirib, hammasi "up to date" ekanini tasdiqlang.
- Loyihada oldindan mavjud TypeScript xatolari bor (komponentlar, `lib/xp-system.ts`, `types/user.ts`); `next.config.mjs` dagi
  `ignoreBuildErrors` ularni yashirib kelgan. Ular bu migratsiyaga aloqador emas va o'zgartirilmadi. Tekshirish: `npm run typecheck`.
- `npm run lint` uchun ESLint konfiguratsiya fayli (`eslint.config.*`) loyihada yo'q edi.

## 8. Tekshiruv skriptlari

```bash
npm test                                    # dvigatel testlari (bazasiz)
npx tsx scripts/selftest-import.ts          # import mantig'i (BO'SH test bazasi kerak)
BASE_URL=http://localhost:3000 npx tsx scripts/smoke-test.ts   # ishlab turgan ilovani HTTP orqali tekshiradi (BO'SH test bazasi)
```
