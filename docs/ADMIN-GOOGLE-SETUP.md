# Google sign-in, Admin panel, permissions — setup & deployment

## 1. Database migration (non-destructive, additive only)
New migration: `prisma/migrations/20261023000000_google_admin_feedback/migration.sql`
- `User`: + `googleSub` (unique, nullable), + `lastLoginAt` (nullable)
- `CommunityPost`: + `isPublished` (default `true` → existing posts stay visible)
- New tables: `Feedback`, `FeedbackMessage`, `AuditLog`
No column is dropped/renamed, no data is rewritten.

```bash
# BACK UP FIRST (Neon/Supabase: create a branch/snapshot; or pg_dump)
npx prisma migrate deploy      # applies only the new migration
```
On Vercel the existing build step already runs your migrate/generate flow; just redeploy.

## 2. Environment variables
| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` | for Google | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | for Google | server-only, never `NEXT_PUBLIC_*` |
| `APP_URL` | for Google | e.g. `https://just-habitts-steel.vercel.app` (no trailing slash) |
| `GOOGLE_REDIRECT_URI` | optional | only if it differs from `APP_URL + /api/auth/google/callback` |
Existing: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, …
Without the two Google variables the "Google bilan davom etish" button is simply hidden.

## 3. Google Cloud Console
1. APIs & Services → OAuth consent screen: User type *External*, app name, support email, add scopes `openid`, `email`, `profile`, then Publish (otherwise only test users can sign in).
2. Credentials → Create credentials → OAuth client ID → *Web application*.
3. **Authorized redirect URIs** (exact match):
   - `https://<your-domain>/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback` (local dev)
4. Copy Client ID / Secret into the environment variables, redeploy.

## 4. Audit wrongly-promoted admins (run once, manually)
```bash
npm run audit:admins                              # list only — changes nothing
npm run audit:admins -- --demote=ID1,ID2          # dry run
npm run audit:admins -- --demote=ID1,ID2 --apply  # demote + revoke their sessions + audit-log entry
```
Nothing is demoted automatically — you decide which accounts are legitimate. Your `.env` admin (`ADMIN_EMAIL`) never lives in the database.
Admins can also be demoted from **/admin → Foydalanuvchilar**.

## 5. Behaviour notes
- `/admin` is guarded on the server (layout re-checks the signed cookie **and** `User.isAdmin/isActive` in the DB). Every `/api/admin/*` call and every community create/update/delete re-checks admin status in the DB, so a demoted admin loses access immediately, not after the 15-minute token expiry.
- Refresh now re-reads role/active status from the DB; blocked users cannot renew sessions. Their already-issued access token still works for up to 15 min on ordinary (non-admin) endpoints.
- Google + existing email/password account: **not auto-linked** (the app has no email verification, so linking on email alone would allow account pre-hijacking). The owner signs in with the password and clicks "Google'ni ulash" on the Profile page.
- Google-created accounts get a random unusable password hash; "Parolni unutdim" lets them set one.
- "Faol foydalanuvchilar" in the dashboard = distinct users with a login/session refresh in the last 24h/7d (the app does not record page views).

## 6. Lokal host: Google login muammolari (redirect_uri_mismatch / TOKEN_EXPIRED)
1. `npm run dev` ni ishga tushiring. Terminalda `Local: http://localhost:XXXX` portini ko'ring (3000 band bo'lsa 3001 bo'lishi mumkin).
2. Brauzerda `http://localhost:XXXX/api/auth/google/start?debug=1` ni oching (faqat `npm run dev` da ishlaydi). U Google Console'ga kiritiladigan ikki manzilni ko'rsatadi.
3. Google Cloud Console → Credentials → OAuth client:
   - **Authorized JavaScript origins:** `http://localhost:XXXX`
   - **Authorized redirect URIs:** `http://localhost:XXXX/api/auth/google/callback`
   (`127.0.0.1` ≠ `localhost`, port, `http/https` va oxiridagi `/` ham farq qiladi.) Saqlagach 1–5 daqiqa kuting.
4. `.env.local`/`.env` da `GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_SECRET` bo'lsin; `.env` o'zgargach serverni to'xtatib qayta ishga tushiring.
5. `npm run dev` da `APP_URL` e'tiborsiz qoladi (brauzer manzili ishlatiladi). `npm run build && npm start` bilan lokal ishlatsangiz: `APP_URL=http://localhost:XXXX` va `EXTRA_ALLOWED_ORIGIN=http://localhost:XXXX` qo'ying.
6. Google xato bersa, server terminalida `[Google] redirect_uri = ...` qatori chiqadi — Console'dagi manzil bilan harfma-harf solishtiring.

## 7. Telegram bilan kirish (Telegram Login Widget)
1. **Migratsiya:** `npx prisma migrate deploy` (yangi: `20261026000000_telegram_login` — faqat `User.telegramId` ustuni qo'shadi).
2. **BotFather** → `/setdomain` → botingizni tanlang → `just-habitts-steel.vercel.app` (`https://` siz).
3. **Vercel → Settings → Environment Variables:** `TELEGRAM_BOT_TOKEN` (BotFather tokeni) va `TELEGRAM_BOT_USERNAME` (`@` siz). Redeploy.
4. Tugma `localhost` da ishlamaydi (Telegram faqat /setdomain qilingan https domenni qabul qiladi). Sinash — deploy qilingan saytda.
5. Telegram hisobida haqiqiy email yo'q (ichki `tg_<id>@telegram.invalid` ishlatiladi); mavjud hisobga Profil sahifasidagi "Telegram" qatoridan ulanadi.
- Imzo serverda (bot tokeni bilan HMAC-SHA256) tekshiriladi, 10 daqiqadan eski va qayta ishlatilgan ma'lumot rad etiladi.
