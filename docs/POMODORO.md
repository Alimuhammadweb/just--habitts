# Pomodoro tizimi

Holat, sozlamalar va statistika **PostgreSQL**'da. Brauzer faqat ko'rsatadi — `setInterval` vaqtni sanamaydi.

## Qanday ishlaydi

| Qatlam | Fayl |
|---|---|
| Umumiy konstantalar, tekshiruv (zod), sof vaqt hisobi | `lib/pomodoro.ts` |
| Server xizmati (start/pause/resume/reset/complete, statistika) | `lib/server/pomodoro-service.ts` |
| API | `GET/POST /api/pomodoro`, `GET/PUT /api/pomodoro/settings` |
| Mijoz hooki / sahifa | `hooks/use-pomodoro.ts`, `components/pomodoro-page.tsx` |
| Jadvallar | `PomodoroSettings`, `PomodoroRun` (yangi); `PomodoroSession`, `User.pomodoroTotal` (mavjud, kunlik jamlama sifatida saqlanadi) |

**Vaqt:** server `startedAt / resumedAt / elapsedMs / plannedSeconds / status` saqlaydi.
`qolgan = plannedSeconds·1000 − elapsedMs − (running ? hozir − resumedAt : 0)`.
Mijoz serverdan kelgan qolgan vaqtni haqiqiy o'tgan vaqt bilan kamaytirib ko'rsatadi, sahifa yangilansa/boshqa qurilmadan ochilsa taymer serverdan tiklanadi.

**Statistikaga faqat yakunlangan FOKUS kiradi.** Pauza, bekor qilingan (reset) va tugamagan seanslar, shuningdek tanaffuslar — kirmaydi.

**Bir marta yozilishi (takrorlanmaslik):**
1. Yakunlash — qator holatiga bog'langan atomik `UPDATE … WHERE id AND status='running' AND resumedAt=<o'qilgan> AND elapsedMs=<o'qilgan>`; faqat 1 qatorga tegsa g'olib.
2. Statistika (`PomodoroSession`, `pomodoroTotal`, vazifalar, chelenjlar) **o'sha tranzaksiyada** yoziladi (`mutateUser(..., hook)`); hook `false` qaytarsa hammasi rollback.
3. `complete`, `GET`, `pause`, `reset` — hammasi shu bitta o'tishga tayanadi; 15 ta parallel so'rovdan keyin ham aynan 1 seans.
4. Server vaqtni o'z soati bilan tekshiradi: muddatidan oldin `complete` → `409 NOT_DUE`. Mijoz davomiylik yoki "count" yubora olmaydi (eski `{session:{count}}` endi 400).
5. `start` foydalanuvchi bo'yicha `pg_advisory_xact_lock` bilan seriyalanadi → bir vaqtda bitta faol taymer.

**Foydalanuvchi sahifada bo'lmaganda tugagan seans:** keyingi `GET` uni tabiiy tugash vaqti bilan bir marta yakunlaydi (kun chegarasi ham shu vaqt bo'yicha: kecha tugagan seans kechagi kunga yoziladi).

## Sozlamalar (server tekshiradi)

- Fokus: **15–180 daq** (presetlar 15/20/25/30/45/60 + o'z qiymati; 15 dan past → 400)
- Qisqa tanaffus 1–30, uzoq tanaffus 5–60, uzoq tanaffus oralig'i 2–10 (har N fokusdan keyin uzoq taklif qilinadi)
- Faol taymerning davomiyligi o'zgarmaydi; yangi sozlama keyingi ishga tushirishdan boshlab amal qiladi.

## Migratsiya

`prisma/migrations/20261107000000_pomodoro_runs` — **faqat qo'shadi** (2 ta yangi jadval); mavjud ma'lumotga tegmaydi.

```bash
npm run db:migrate     # prisma migrate deploy (Vercel'da vercel-build avtomatik bajaradi)
```

## Testlar

```bash
npm test                                   # birlik testlar (vaqt hisobi, tekshiruv, sahifa render)
BASE_URL=http://localhost:3000 npm run smoke:pomodoro   # haqiqiy server + PostgreSQL (BO'SH test bazasi)
```

`smoke:pomodoro` fokus ≥ 15 daqiqa bo'lgani uchun "vaqt o'tishi"ni bazadagi vaqt belgilarini surish bilan taqlid qiladi; qolgan hammasi haqiqiy.

## Ma'lum cheklovlar

- "Jami fokus vaqti" yangi tizim joriy etilgandan keyingi seanslar uchun hisoblanadi (eski seanslarda davomiylik saqlanmagan). Eski seanslar "jami seanslar" va "bugun" sonlariga kiradi.
- Foydalanuvchi taymerni ishga tushirib, sahifani yopib qo'ysa va pauza qilmasa, vaqt o'tgach seans hisoblanadi (taymer haqiqatan shuncha vaqt ishlagan). Qat'iy "tab ochiq bo'lishi shart" qoidasi qo'yilmagan.
- Env-admin (id 0) bazada yo'q — Pomodoro uchun 404 qaytadi (UI undan foydalanmaydi).
