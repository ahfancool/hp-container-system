# HP Container School System

Fondasi dan database inti untuk sistem manajemen container HP sekolah.

## Architecture

- Frontend: Cloudflare Pages with Next.js
- Backend: Cloudflare Workers
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- QR scanning: Browser Camera API

## Repository Layout

```text
docs/
frontend/
backend/
database/
scripts/
```

## Local Setup

1. Copy `.env.example` to `.env`.
2. Copy `frontend/.env.example` to `frontend/.env.local`.
3. Copy `backend/.dev.vars.example` to `backend/.dev.vars`.
4. Fill the required Supabase and JWT values.
5. Run `npm install`.
6. Run `npm run check:env`.
7. Start the frontend with `npm run dev:frontend`.
8. Start the backend with `npm run dev:backend`.

## Database Setup

1. Buka Supabase SQL Editor.
2. Jalankan isi `database/schema.sql`.
3. Jika perlu data contoh untuk pengembangan, jalankan isi `database/seed.sql`.

Schema Milestone 1 sudah mencakup:

- tabel inti `users`, `students`, `containers`, dan `phone_transactions`
- index untuk `student_id`, `container_id`, dan `timestamp`
- trigger validasi state transaksi `IN` dan `OUT`
- Row Level Security untuk `student`, `teacher`, `homeroom`, dan `admin`

## Authentication Setup

Milestone 2 menambahkan integrasi Supabase Auth dengan alur berikut:

1. Buat user login di Supabase Authentication menggunakan email dan password.
2. Isi metadata user minimal:
   - `name`
   - `role`
3. Gunakan salah satu role berikut:
   - `student`
   - `teacher`
   - `homeroom`
   - `admin`
4. Trigger database akan otomatis menyinkronkan `auth.users` ke tabel `public.users`.
5. Untuk akun siswa, hubungkan baris `students.user_id` ke `users.id` agar role student bisa dipakai penuh di aplikasi.

Backend Milestone 2 sudah menyediakan endpoint `GET /auth/me` untuk membaca hasil pemetaan auth dan role setelah login berhasil.

## Container Management Setup

Milestone 3 menambahkan registri container dengan alur berikut:

1. Login menggunakan akun `admin`.
2. Buka halaman `/admin/containers`.
3. Isi `name` dan `location`.
4. Backend akan membuat:
   - `id` container berbentuk UUID
   - `qr_code` otomatis dengan format `container://{container_id}`
5. Data container akan tersimpan di tabel `containers`.

Endpoint yang sudah aktif:

- `GET /containers`
- `POST /containers` khusus role `admin`

## QR Scan Setup

Milestone 4 menambahkan alur scan QR dengan langkah berikut:

1. Login menggunakan akun `student` yang sudah terhubung ke tabel `students`.
2. Buka halaman `/scan`.
3. Aktifkan kamera browser atau tempel payload QR secara manual.
4. QR yang valid harus memakai format `container://{container_id}`.
5. Frontend akan mengirim payload berikut ke backend:
   - `student_id`
   - `container_id`
   - `timestamp`
6. Endpoint `POST /scan` akan:
   - memverifikasi bahwa student login cocok dengan payload
   - memverifikasi container ada dan aktif
   - menyiapkan preview aksi berikutnya berdasarkan transaksi terakhir

Catatan:

- Pada Milestone 4, scan baru sampai tahap validasi payload.
- Penyimpanan transaksi `IN` dan `OUT` penuh akan dikerjakan pada Milestone 5.

## Transaction Engine Setup

Milestone 5 menambahkan pencatatan transaksi HP dengan alur berikut:

1. Student scan QR container dari halaman `/scan`.
2. Frontend dapat:
   - memvalidasi payload lewat `POST /scan`
   - mencatat transaksi lewat `POST /transaction`
3. Backend akan menentukan aksi otomatis:
   - jika transaksi terakhir `OUT`, maka aksi berikutnya `IN`
   - jika transaksi terakhir `IN`, maka aksi berikutnya `OUT`
4. Aturan yang sekarang aktif:
   - tidak boleh `OUT` jika belum pernah `IN`
   - tidak boleh `IN` dua kali beruntun
   - `IN` reguler hanya boleh dilakukan pada window jam masuk yang ditentukan sekolah
   - `OUT` reguler ditolak sebelum jam yang diizinkan
   - tipe `PEMBELAJARAN` dan `DARURAT` hanya boleh dipakai oleh staff

Environment tambahan yang bisa diubah:

- `SCHOOL_TIMEZONE`
- `REGULAR_IN_ALLOWED_START`
- `REGULAR_IN_ALLOWED_END`
- `REGULAR_OUT_ALLOWED_TIME`
- `CONTAINER_CACHE_TTL_SECONDS`
- `DASHBOARD_CACHE_TTL_SECONDS`

## Teacher Control Panel Setup

Milestone 6 menambahkan panel approval guru dengan alur berikut:

1. Login menggunakan akun `teacher`, `homeroom`, atau `admin`.
2. Buka halaman `/teacher/approve`.
3. Pilih siswa yang status HP-nya masih berada di dalam container.
4. Pilih container tujuan dan tipe approval:
   - `PEMBELAJARAN`
   - `DARURAT`
5. Frontend akan mengirim approval ke endpoint `POST /teacher/approve`.
6. Backend akan:
   - memverifikasi role staff
   - memverifikasi state siswa masih valid untuk aksi `OUT`
   - mencatat `operator_id` staff ke transaksi override

Endpoint yang sekarang aktif untuk workflow teacher panel:

- `GET /students` untuk daftar siswa aktif beserta status transaksi terakhir
- `GET /containers`
- `POST /teacher/approve`

## Monitoring Dashboard Setup

Milestone 7 menambahkan dashboard monitoring untuk staff dengan alur berikut:

1. Login menggunakan akun `teacher`, `homeroom`, atau `admin`.
2. Buka halaman `/dashboard`.
3. Frontend akan membaca endpoint `GET /dashboard/status`.
4. Backend akan menurunkan status HP dari transaksi terakhir setiap siswa dan mengembalikan:
   - jumlah HP di container
   - jumlah HP di luar
   - siswa yang belum scan
   - pelepasan darurat yang masih aktif
   - ringkasan per kelas
   - aktivitas transaksi terbaru
5. Dashboard melakukan refresh berkala agar monitoring tetap mendekati real-time.

Endpoint yang aktif untuk milestone ini:

- `GET /dashboard/status`

## Concurrency Optimization Setup

Milestone 8 menambahkan lapisan optimasi dan concurrency dengan alur berikut:

1. Frontend mengirim `request_id` untuk transaksi penting seperti `POST /transaction` dan `POST /teacher/approve`.
2. Backend akan mengembalikan transaksi lama bila `request_id` yang sama dikirim ulang, sehingga retry tidak membuat transaksi ganda.
3. Validasi container sekarang memakai cache edge singkat agar lookup container tidak selalu ke database.
4. Dashboard memakai:
   - snapshot cache singkat di edge
   - query database yang hanya mengambil transaksi terakhir per siswa
5. Tujuan perubahan ini adalah menjaga respons tetap ringan saat jam scan ramai.

## Security Layer Setup

Milestone 9 menambahkan hardening keamanan dengan alur berikut:

1. Worker sekarang membuat `request_id` internal untuk setiap request dan mengembalikannya di header response.
2. Endpoint sensitif memakai rate limit per user atau per student untuk mencegah spam scan dan burst request.
3. Event keamanan dan mutasi penting dicatat ke tabel `audit_logs`, termasuk:
   - auth failure
   - unauthorized role access
   - rate limit blocked
   - pembuatan container
   - transaksi siswa
   - approval guru
4. Admin dapat membuka halaman `/admin/audit` untuk membaca audit trail terbaru lewat endpoint `GET /audit/logs`.
5. Security layer ini membutuhkan schema terbaru agar tabel audit dan rate limit atomik tersedia.

## Deployment dan Go-Live Setup

Milestone 10 menyiapkan jalur deploy production dengan perubahan berikut:

1. Frontend sekarang dikonfigurasi sebagai static export melalui `frontend/next.config.js`, sehingga hasil build production keluar ke folder `frontend/out`.
2. Versi Node untuk build dipin ke `22` lewat `.nvmrc` di root dan frontend agar selaras dengan environment Cloudflare Pages.
3. Backend Worker sekarang punya pemisahan config `staging` dan `production` di `backend/wrangler.toml`.
4. Template environment untuk Preview, Production, Staging, dan Production local simulation disediakan lewat:
   - `frontend/.env.preview.example`
   - `frontend/.env.production.example`
   - `backend/.dev.vars.staging.example`
   - `backend/.dev.vars.production.example`
5. Smoke test deployment tersedia lewat script `scripts/check-production.ps1`.
6. Runbook lengkap ada di `docs/deployment_runbook.md`.

## Live Endpoint Saat Ini

Endpoint resmi yang dipakai untuk akses harian saat ini adalah:

- frontend utama: `https://hp-container-system-production.pages.dev`
- backend utama: `https://hp-container-system-api-production.ahfancool.workers.dev`

Endpoint preview yang masih tersedia:

- frontend preview: `https://hp-container-system-staging.pages.dev`
- backend preview: `https://hp-container-system-api-staging.ahfancool.workers.dev`

Catatan:

- URL production di atas adalah endpoint publik utama sampai custom domain sekolah dipasang.
- URL staging tetap aktif, tetapi bukan endpoint operasional utama.

## Mode Operasional Saat Ini: Single Supabase

Keputusan operasional saat ini adalah memakai satu project Supabase yang sama untuk deployment `staging` dan `production`.

Implikasinya:

- data auth, transaksi, container, dashboard, dan audit log dibaca dari project Supabase yang sama
- perubahan data dari staging juga akan terlihat di production
- staging tidak boleh dianggap sebagai sandbox yang aman untuk eksperimen bebas
- reset data, seed ulang, atau perubahan schema di project Supabase live harus diperlakukan sebagai perubahan production

Dokumen aturan operasional detail ada di `docs/live_operational_policy.md`.

Perintah baru yang tersedia:

- `npm run dev:backend:staging`
- `npm run deploy:backend:staging`
- `npm run deploy:backend:production`
- `npm run check:production -- -BackendUrl https://api.hp.sekolah.sch.id -FrontendUrl https://hp.sekolah.sch.id -ExpectedAppEnvironment production`

## Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE`
- `JWT_SECRET`
- `APP_ENV` optional
- `NEXT_PUBLIC_APP_ENV` optional
- `CONTAINER_CACHE_TTL_SECONDS` optional
- `DASHBOARD_CACHE_TTL_SECONDS` optional

## Aturan Operasional Ringkas

- Gunakan URL production sebagai endpoint resmi untuk operasional sekolah.
- Gunakan URL staging hanya untuk smoke test, verifikasi cepat, atau pengecekan UI yang sudah disetujui.
- Jangan jalankan `database/seed.sql` ke project Supabase live setelah sistem dipakai operasional.
- Jangan melakukan reset data staging karena efeknya juga akan masuk ke production.
- Jika butuh pengujian bebas atau migration berisiko tinggi, siapkan project Supabase terpisah terlebih dahulu.

## Milestone 0 Deliverables

- Monorepo workspace scaffolded
- Frontend and backend split by responsibility
- Cloudflare Worker entrypoint prepared
- Database folder version controlled
- Environment templates documented
- Setup validation script added

## Milestone 1 Deliverables

- Production PostgreSQL schema prepared for Supabase
- Indexes for transaction lookup and dashboard queries
- Database trigger to block invalid transaction state transitions
- RLS policies for application roles

## Next Milestone

Milestone 11 akan fokus ke pilot test satu kelas sebelum aktivasi skala penuh sekolah.
