# Deployment Runbook Milestone 10

Dokumen ini menyiapkan jalur deploy production tanpa menaruh secret di repository.

## Mode Operasional Saat Ini

Saat ini deployment live berjalan dengan model berikut:

- frontend production: `https://hp-container-system-production.pages.dev`
- backend production: `https://hp-container-system-api-production.ahfancool.workers.dev`
- frontend staging: `https://hp-container-system-staging.pages.dev`
- backend staging: `https://hp-container-system-api-staging.ahfancool.workers.dev`
- database Supabase: satu project yang sama untuk `staging` dan `production`

Catatan penting:

- `production` adalah endpoint resmi yang dipakai harian
- `staging` tetap aktif hanya untuk preview terbatas dan verifikasi deploy
- perubahan data dari staging juga masuk ke data live karena databasenya sama

## Target Arsitektur Production

- Frontend: Cloudflare Pages
- Backend: Cloudflare Workers
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Domain rekomendasi:
  - frontend production: `https://hp.sekolah.sch.id`
  - backend production: `https://api.hp.sekolah.sch.id`
  - frontend staging: `https://staging-hp.sekolah.sch.id`
  - backend staging: `https://staging-api.hp.sekolah.sch.id`

## File Yang Disiapkan Di Milestone 10

- `frontend/next.config.js`
- `frontend/.env.preview.example`
- `frontend/.env.production.example`
- `frontend/.nvmrc`
- `backend/wrangler.toml`
- `backend/.dev.vars.staging.example`
- `backend/.dev.vars.production.example`
- `.nvmrc`
- `scripts/check-production.ps1`

## Langkah 1 - Siapkan Supabase Live

Pilihan yang dipakai saat ini adalah `single Supabase`, jadi satu project Supabase dipakai bersama oleh `staging` dan `production`.

Langkah minimum:

1. Pastikan project Supabase live sudah benar.
2. Jalankan `database/schema.sql` ke project tersebut.
3. Jangan jalankan `database/seed.sql` setelah sistem live kecuali memang disetujui untuk data contoh.
4. Pastikan metadata Supabase Auth untuk user memakai `name` dan `role`.
5. Pastikan role siswa yang akan uji coba sudah terhubung ke tabel `students.user_id`.

Jika suatu hari butuh isolasi penuh, baru buat project Supabase production dan staging yang terpisah.

## Langkah 2 - Siapkan Backend Staging dan Production

`backend/wrangler.toml` sekarang sudah memisahkan `local`, `staging`, dan `production`.

Yang perlu diset sebagai secret untuk setiap environment Worker:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE`
- `JWT_SECRET`

Contoh perintah untuk staging:

```powershell
npx wrangler secret put SUPABASE_URL --env staging
npx wrangler secret put SUPABASE_ANON_KEY --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE --env staging
npx wrangler secret put JWT_SECRET --env staging
```

Contoh perintah untuk production:

```powershell
npx wrangler secret put SUPABASE_URL --env production
npx wrangler secret put SUPABASE_ANON_KEY --env production
npx wrangler secret put SUPABASE_SERVICE_ROLE --env production
npx wrangler secret put JWT_SECRET --env production
```

Catatan:

- `ALLOWED_ORIGIN` adalah non-secret config dan sudah dicontohkan di `wrangler.toml`.
- Kalau domain sekolah berbeda, ganti nilai `ALLOWED_ORIGIN` sebelum deploy.
- Karena mode saat ini `single Supabase`, secret Supabase untuk staging dan production bisa saja bernilai sama.
- Meski begitu, simpan file env staging dan production secara terpisah agar pergantian arsitektur nanti tidak membingungkan.

Deploy Worker:

```powershell
npm run deploy:backend:staging
npm run deploy:backend:production
```

## Langkah 3 - Siapkan Frontend Cloudflare Pages

Frontend sekarang memakai static export.

Konfigurasi Pages yang direkomendasikan:

- Project root directory: `frontend`
- Framework preset: `Next.js (Static HTML Export)`
- Build command: `npx next build`
- Build output directory: `out`
- Node version: `22`

Variable Preview environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_ENV=preview`

Variable Production environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_ENV=production`

Template yang bisa dipakai:

- `frontend/.env.preview.example`
- `frontend/.env.production.example`

Jika deploy dilakukan manual dari local workspace dengan `wrangler pages deploy frontend/out`, jangan jalankan `next build` polos tanpa env. Gunakan script berikut agar bundle tidak membawa fallback dummy:

```powershell
npm run build:frontend:staging
npm run build:frontend:production
```

Catatan:

- script build akan membaca `frontend/.env.production` jika tersedia
- jika file itu belum ada, script otomatis fallback ke `frontend/.env.preview`
- karena mode operasional saat ini masih `single Supabase`, fallback tersebut aman untuk nilai Supabase public
- `frontend/lib/config.ts` sekarang sengaja dibuat gagal build jika public env production tidak tersedia, supaya bundle dummy tidak bisa terdeploy lagi

## Langkah 4 - Domain dan CORS

Rekomendasi domain:

- Frontend: `hp.sekolah.sch.id`
- Backend API: `api.hp.sekolah.sch.id`

Checklist domain:

1. Hubungkan domain frontend ke Cloudflare Pages.
2. Hubungkan domain backend ke Worker production.
3. Pastikan `ALLOWED_ORIGIN` Worker production sama dengan origin frontend production.
4. Jika memakai staging, buat pasangan domain staging yang terpisah.

Jika masih memakai domain default Cloudflare seperti saat ini:

- production frontend: `https://hp-container-system-production.pages.dev`
- production backend: `https://hp-container-system-api-production.ahfancool.workers.dev`
- staging frontend: `https://hp-container-system-staging.pages.dev`
- staging backend: `https://hp-container-system-api-staging.ahfancool.workers.dev`

## Langkah 5 - Smoke Test Setelah Deploy

Setelah backend dan frontend aktif, jalankan:

```powershell
npm run check:production -- -BackendUrl https://api.hp.sekolah.sch.id -FrontendUrl https://hp.sekolah.sch.id -ExpectedAppEnvironment production
```

Script akan memverifikasi:

- endpoint `GET /health`
- `x-request-id` di response backend
- milestone backend yang aktif
- kelengkapan environment backend
- halaman frontend `/`, `/login/`, dan `/scan/`

Manual smoke check yang tetap wajib:

- halaman scan menampilkan preview sebelum transaksi dikonfirmasi
- input manual tetap terlihat saat kamera tidak tersedia
- approval guru membuat status `Menunggu Scan`, bukan langsung `OUT`
- scan siswa berikutnya mengonsumsi approval aktif dan baru mencatat transaksi setelah konfirmasi
- dashboard membedakan ringkasan sekolah dan hasil filter aktif

## Checklist Go-Live

1. Deploy staging dan lakukan uji satu kelas kecil.
2. Verifikasi login siswa, scan, preview-konfirmasi transaksi, approval guru, dashboard, dan audit log.
3. Pastikan admin sekolah bisa membuka `/admin/audit`.
4. Pastikan jam `REGULAR_IN_ALLOWED_START`, `REGULAR_IN_ALLOWED_END`, dan `REGULAR_OUT_ALLOWED_TIME` sudah sesuai kebijakan sekolah.
5. Deploy production backend.
6. Build production frontend dengan `npm run build:frontend:production`.
7. Deploy production frontend.
8. Tetapkan URL production sebagai endpoint resmi yang dibagikan ke pengguna.
9. Batasi URL staging hanya untuk smoke test dan preview yang disetujui.
10. Hubungkan domain production jika custom domain sekolah sudah siap.
11. Jalankan smoke test.
12. Jalankan pilot test sebelum full rollout.

## Rujukan Resmi

- [Cloudflare Pages Next.js Static Site Guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)
- [Cloudflare Pages Build Image](https://developers.cloudflare.com/pages/configuration/build-image/)
- [Cloudflare Pages Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Workers Environments](https://developers.cloudflare.com/workers/wrangler/environments/)
- [Next.js Static Export](https://nextjs.org/docs/app/guides/static-exports)
