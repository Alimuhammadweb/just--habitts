# Statistika, chelenj va reyting qoidalari

Manba: `lib/stats/habit-stats.ts`, `lib/server/habit-engine.ts`, `lib/server/challenge-engine.ts`, `app/api/leaderboard/route.ts`.
Testlar: `npm test` (37 ta).

## Odat statistikasi
- Kun = foydalanuvchi vaqt zonasidagi kalendar kuni (`user.timezone`, standart Asia/Tashkent). 24 soatlik bo'laklar ishlatilmaydi.
- Odat oynasi: boshlanish kunidan `duration` kun. Hozir odatlar har kuni bajariladi (haftalik jadval mavjud emas).
- Maxraj (due) = completed + partial + missed. Frozen, kutilayotgan bugun, kelajak va oynadan tashqari kunlar kirmaydi.
- Yozuvsiz o'tgan kun = "missed" (statistikada `inferred`); yozuvlar jimgina qayta yozilmaydi.
- Foiz = completed / due; due = 0 bo'lsa `null` (0% emas).
- Odat streaki: ketma-ket completed (frozen uzmaydi); partial va missed uzadi. Foydalanuvchi streaki: kamida bitta odat bajarilgan ketma-ket kunlar.

## XP
- Faqat server hisoblaydi (`POST /api/habits/status`). Har (odat, kun) uchun `dayLock.xpAwarded` = kun uchun jami XP; o'zgarish delta bilan qo'llanadi -> takroriy so'rov XPni o'zgartirmaydi.
- Haftalik/oylik XP kalendar davri bo'yicha dayLock'lardan hisoblanadi; umr bo'yi XP hech qachon nolga tushirilmaydi.
- `auditXP(user)` saqlangan XP va dayLock yig'indisi farqini ko'rsatadi (o'zgartirmaydi).

## Chelenjlar
Turlar: `self_report`, `pomodoro_total` (#7, #12), `habit_days` (#13, #16, #18), `habit_and_pomodoro_days` (#17).
`self_report` chelenjlarni (suv ichish, erta turish va h.k.) server tekshira olmaydi - faqat kuniga bir marta, oyna ichida qabul qilinadi.
Odat asosidagi kunlar faqat kun tugagandan keyin hisoblanadi; mukofot bir marta (CAS bilan himoyalangan).

## Reyting
Faqat server tomonida, TOP 10. Tartib: ball kamayish, `createdAt` o'sish, `id` o'sish. Haftalik = `xpData.weeklyXP` (`weekKey` = joriy dushanba).

## Migratsiya
Sxema o'zgarishlari qo'shimcha maydonlar: `user.timezone`, `user._rev`, `xpData.weekKey`, `activeChallenges[].startDateKey/endDateKey/attempt`, yangi `weekly_tasks`, `rate_limits`, `password_resets` kolleksiyalari. Mavjud yozuvlar o'chirilmaydi; eski chelenjlar kirishda `normalizeActive` bilan to'g'rilanadi; eski parollar kirishda scrypt'ga o'tkaziladi.
