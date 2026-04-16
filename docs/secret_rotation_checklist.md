# Secret Rotation Checklist

Checklist ini dibuat sesederhana mungkin supaya langkahnya bisa Anda lakukan pelan-pelan.

## Sebelum mulai

1. Pastikan repo publik sudah tidak lagi memuat secret di commit terbaru.
2. Jangan deploy apa pun dulu sebelum langkah 1 sampai 4 di bawah selesai.
3. Siapkan tempat aman untuk menyimpan nilai baru, misalnya password manager.

## Langkah 1 - Ambil key baru dari Supabase

1. Login ke Supabase Dashboard.
2. Buka project Anda.
3. Buka `Project Settings -> API Keys`.
4. Salin:
   - `Project URL`
   - `Publishable key` baru (`sb_publishable_...`)
   - `Secret key` baru (`sb_secret_...`)
5. Jangan matikan legacy key dulu.

## Langkah 2 - Isi file placeholder lokal

Isi file berikut:

- `backend/.dev.vars`
- `backend/.dev.vars.staging`
- `backend/.dev.vars.production`
- `frontend/.env.local`
- `frontend/.env.preview`
- `frontend/.env.production`

Aturan isi:

- `SUPABASE_ANON_KEY` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` isi dengan `sb_publishable_...`
- `SUPABASE_SERVICE_ROLE` isi dengan `sb_secret_...`
- `JWT_SECRET`:
  - repo saat ini hanya mengecek bahwa nilainya ada, belum memakainya untuk verifikasi JWT lain
  - jika Anda punya legacy JWT secret aktif, boleh isi dengan nilai itu
  - jika tidak, isi sementara dengan string non-kosong yang jelas palsu seperti `TEMP_JWT_SECRET_UNUSED`

## Langkah 3 - Update Cloudflare staging dulu

### Backend Worker staging

Masukkan secret/environment yang sama seperti file `backend/.dev.vars.staging`.

Minimal:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE`
- `JWT_SECRET`
- `RESEND_API_KEY`
- `ADMIN_EMAILS`

Catatan:

- Placeholder `JWT_SECRET` aman untuk revisi repo saat ini selama nilainya non-kosong, karena kode backend hanya memvalidasi keberadaan env tersebut.

### Frontend Pages preview/staging

Masukkan:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_ENV`

## Langkah 4 - Deploy staging

1. Deploy backend staging.
2. Build frontend staging.
3. Deploy frontend staging.
4. Uji:
   - login
   - scan
   - teacher approve
   - dashboard
   - audit

## Langkah 5 - Update production

Kalau staging sehat:

1. Update secret backend production.
2. Update env frontend production.
3. Deploy backend production.
4. Build frontend production.
5. Deploy frontend production.

## Langkah 6 - Matikan legacy key lama

Baru setelah staging dan production sudah sehat:

1. Kembali ke Supabase `Project Settings -> API Keys`
2. Nonaktifkan legacy `anon`
3. Nonaktifkan legacy `service_role`

## Langkah 7 - JWT rotation

Ini langkah terakhir, jangan dilakukan di awal.

1. Buka `Project Settings -> JWT Keys`
2. Ikuti jalur migrate / rotate key
3. Jangan revoke key lama sebelum semua environment sehat
4. Setelah itu baru revoke key lama

## Jika panik atau bingung

Berhenti di titik ini dan kirimkan ke saya:

1. Anda sedang ada di dashboard mana: `Supabase` atau `Cloudflare`
2. Halaman apa yang sedang terbuka
3. Tombol apa yang Anda lihat

Lalu saya pandu langkah berikutnya satu per satu.
