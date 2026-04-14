# Sistem Manajemen Container HP Sekolah

### Resume Teknis Kanonis

**Versi:** 1.3  
**Tanggal sinkronisasi:** 14 April 2026  
**Status dokumen:** Sumber kebenaran teknis utama untuk isi repo ini.  
**Dokumen roadmap pendamping:** `docs/optimation-milestone.md` tetap dipakai sebagai referensi milestone, tetapi implementasi aktual dan status siap-uji harus mengikuti dokumen ini.

---

## 1. Ringkasan Sistem

Sistem ini mengelola penyimpanan HP siswa berbasis:

- akun siswa, guru, wali kelas, dan admin
- container fisik dengan QR dinamis
- preview scan sebelum transaksi disimpan
- approval guru individual maupun massal
- dashboard monitoring sekolah
- audit trail, arsip log, dan laporan mingguan
- guardrail fingerprint perangkat
- buffer offline ringan untuk area sinyal lemah
- sistem pelanggaran dan penalti penyitaan

Stack utama saat ini:

- Frontend: Next.js 14 static export + Serwist PWA + IndexedDB + Fuse.js
- Backend: Cloudflare Workers (`wrangler`)
- Database: Supabase PostgreSQL
- Storage arsip: Cloudflare R2
- Email laporan: Resend

---

## 2. Arsitektur Aktual Repo

### Frontend

- Lokasi: `frontend/`
- Shell scan utama: `frontend/pages/scan.tsx` -> `frontend/scanner/MobileScannerShell.tsx`
- PWA/service worker: `frontend/sw.ts`, `frontend/next.config.js`
- Offline queue: `frontend/lib/offline-buffer.ts`
- Indicator sinkronisasi: `frontend/components/OfflineIndicator.tsx`
- Search cepat: `frontend/components/GlobalSearch.tsx`
- Virtualisasi: `frontend/pages/dashboard.tsx`, `frontend/pages/teacher/approve.tsx`

### Backend

- Lokasi: `backend/`
- Entry worker: `backend/workers/index.ts`
- Validasi scan: `backend/services/scan.ts`
- Simpan transaksi: `backend/services/transactions.ts`
- Approval guru: `backend/services/teacherApprovals.ts`
- Pelanggaran: `backend/services/violations.ts`
- Audit archive: `backend/services/archive.ts`
- Weekly report: `backend/services/reports.ts`

### Database

- Lokasi schema: `database/schema.sql`
- Function utama:
  - `validate_and_get_preview`
  - `bulk_upsert_teacher_approvals`
  - `latest_student_transactions`
  - `register_rate_limit_hit`

---

## 3. Status Implementasi Milestone 13-24

### Sudah hidup di repo

1. **Milestone 13 - RPC Scan Optimization**  
   Sudah aktif lewat `validate_and_get_preview` dan `latest_student_transactions`.

2. **Milestone 14 - Bulk Teacher Approval**  
   Sudah aktif lewat `bulk_upsert_teacher_approvals` dan UI batch di `/teacher/approve`.

3. **Milestone 15 - PWA Offline Buffer**  
   Sudah aktif lewat IndexedDB queue, auto-sync saat online, dan flag `is_late_sync` dengan TTL 30 menit. Service worker hanya aktif pada build non-development.

4. **Milestone 16 - QR Regenerator Security**  
   Sudah aktif di schema (`qr_secret_token`), rotasi token backend, dan frontend sekarang meneruskan `qr_token` saat preview/transaksi termasuk jalur offline buffer.

5. **Milestone 17 - Virtualization**  
   Sudah aktif di dashboard dan halaman approval massal memakai `react-window` v2.

6. **Milestone 20 - Audit Log Archiving ke R2**  
   Sudah aktif lewat cron worker dan prosedur restore di `docs/audit_restoration_procedure.md`.

7. **Milestone 21 - Weekly HTML Reports via Resend**  
   Sudah aktif lewat cron worker `sendWeeklyReport`.

8. **Milestone 22 - UI Polish dan Haptic Feedback**  
   Sudah aktif lewat skeleton, toast `sonner`, dan `navigator.vibrate()` pada shell scan mobile.

9. **Milestone 23 - Device Fingerprinting Guardrail**  
   Sudah aktif lewat enrollment fingerprint saat login siswa dan validasi pada `/scan` serta `/transaction`.

10. **Milestone 24 - Student Violation & Penalty System**  
    Sudah aktif dalam bentuk tabel `student_violations`, cron `detectMissingScanIn`, halaman `/admin/violations`, dan aturan penalti pada RPC scan.

### Sudah sebagian, tetapi implementasinya berbeda dari roadmap awal

1. **Milestone 18 - Global Search**  
   Sudah memakai `Fuse.js` + shortcut `CMD+K/CTRL+K` + cache browser TTL 1 jam, tetapi dataset minimal siswa saat ini belum disimpan di edge cache backend. Edge cache backend baru dipakai untuk lookup container.

### Belum ada implementasi penuh di repo saat ini

1. **Milestone 19 - Lightweight Web Push**  
   Belum ada tabel `push_subscriptions`, alur subscribe browser, VAPID, atau pengiriman Web Push. Resume lama yang menyebut Web Push dan tabel `PushSubscription` tidak lagi dianggap akurat.

---

## 4. Model Data Aktual

### `students`

Field penting:

- `id`
- `user_id`
- `nis`
- `name`
- `class_name`
- `major`
- `grade_level`
- `is_active`
- `device_fingerprint`
- `fingerprint_updated_at`

### `containers`

Field penting:

- `id`
- `name`
- `location`
- `qr_code`
- `qr_secret_token`
- `is_active`

### `phone_transactions`

Field penting:

- `student_id`
- `container_id`
- `action` = `IN | OUT`
- `type` = `REGULAR | PEMBELAJARAN | DARURAT`
- `timestamp`
- `request_id`
- `operator_id`
- `is_late_sync`

Catatan:

- `is_late_sync = true` jika selisih waktu sinkronisasi dengan `timestamp` scan melebihi 30 menit.
- Resume lama yang menyebut `sync_flag = FLAGGED_LATE_SYNC` tidak sesuai schema aktual.

### `teacher_approvals`

Field penting:

- `student_id`
- `container_id`
- `type`
- `status` = `PENDING | USED | CANCELLED`
- `approved_by`
- `approved_at`
- `used_at`
- `request_id`
- `consumed_transaction_id`

### `student_violations`

Field penting:

- `student_id`
- `violation_type`
- `timestamp`
- `resolved_at`
- `operator_id`

Catatan penting:

- Penalti aktif saat ini ditentukan dari jumlah pelanggaran yang **belum resolved**, bukan dari field `status_sita`.
- Resume lama yang menyebut `status_sita` dan `taken_by_parent` tidak sesuai schema aktual repo ini.

---

## 5. Logika Scan dan Penalti yang Berlaku

### Alur scan reguler

1. Frontend mengirim `student_id`, `container_id`, `timestamp`, `fingerprint`, dan `qr_token`.
2. Backend memvalidasi:
   - student aktif
   - container aktif
   - `qr_token` cocok dengan `qr_secret_token`
   - fingerprint siswa valid
3. Backend memanggil RPC `validate_and_get_preview`.
4. RPC mengembalikan:
   - `action_preview`
   - transaksi terakhir
   - approval guru aktif jika ada
   - status penalti jika siswa sedang diblokir
5. Frontend menampilkan preview dan baru menyimpan transaksi setelah konfirmasi.

### Aturan penalti penyitaan aktual

Logika ada di `database/schema.sql` pada function `validate_and_get_preview`.

1. Jika jumlah pelanggaran unresolved `>= 2`  
   Hasil preview diblokir dengan:
   - `penalty_status.type = PARENT_PICKUP`
   - pesan bahwa HP hanya dapat diambil melalui orang tua/kesiswaan

2. Jika jumlah pelanggaran unresolved `= 1` dan pelanggaran itu masih berada dalam jendela 24 jam  
   Hasil preview diblokir dengan:
   - `penalty_status.type = SEIZURE_24H`
   - pesan bahwa HP sedang disita 1x24 jam

3. Jika hanya ada satu pelanggaran unresolved tetapi sudah lebih dari 24 jam  
   RPC tidak lagi memblokir scan; sistem kembali ke aturan reguler/approval guru.

4. Jika pelanggaran sudah `resolved_at`  
   Pelanggaran tidak lagi dihitung untuk penalti aktif.

### Deteksi pelanggaran otomatis harian

Cron worker `detectMissingScanIn`:

- mengambil seluruh siswa aktif
- membandingkan dengan transaksi `IN` hari itu
- membuat violation `MISSING_SCAN_IN` jika belum ada scan masuk dan belum ada violation aktif serupa di hari yang sama

---

## 6. Endpoint dan Cron yang Aktif

### Endpoint

- `GET /health`
- `GET /auth/me`
- `GET /containers`
- `POST /containers`
- `POST /containers/rotate-token`
- `GET /students`
- `GET /students/minimal`
- `POST /students/fingerprint`
- `POST /scan`
- `POST /transaction`
- `POST /teacher/approve`
- `GET /dashboard/status`
- `GET /audit/logs`
- `GET /violations`
- `POST /violations`
- `POST /violations/resolve`

### Cron worker

- `0 2 * * *` -> archive audit log ke R2
- `0 8 * * 1` -> kirim weekly HTML report
- `0 8 * * *` -> deteksi `MISSING_SCAN_IN`

---

## 7. Prasyarat Pengujian Lokal

### Runtime yang diwajibkan

- Node.js `22` sesuai `.nvmrc`
- npm workspace root sudah terpasang (`node_modules` tersedia)
- file backend local env: `backend/.dev.vars`
- file frontend local env: `frontend/.env.local` atau env yang setara

### Catatan verifikasi pada mesin kerja 14 April 2026

Yang berhasil diverifikasi:

- `npm run typecheck` -> lulus
- `frontend/npm run dev` -> berhasil start di `http://localhost:3000`
- `npm run build:frontend` -> berhasil build dan membundle `sw.js`

Yang gagal diverifikasi penuh di mesin ini:

- `backend/npm run dev` (`wrangler dev`) -> gagal pada Node `v24.14.0` dengan `spawn EFTYPE`

Makna praktis:

- repo ini **harus** dijalankan di Node 22 untuk backend local dev
- tanpa switch ke Node 22, alur full local backend tidak dapat dianggap valid

---

## 8. Urutan Run Lokal yang Direkomendasikan

### 1. Pastikan Node 22 aktif

Verifikasi:

```powershell
node -v
```

Target:

```text
v22.x.x
```

### 2. Siapkan env lokal

Backend:

```powershell
Copy-Item backend/.dev.vars.example backend/.dev.vars
```

Frontend:

```powershell
Copy-Item frontend/.env.example frontend/.env.local
```

Isi secret nyata untuk:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE`
- `JWT_SECRET`
- `RESEND_API_KEY`
- `ADMIN_EMAILS`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_ENV`

### 3. Jalankan backend

```powershell
Set-Location backend
npm run dev
```

Expected:

- worker listen di `http://127.0.0.1:8787`
- `GET /health` mengembalikan `success=true`

### 4. Jalankan frontend

```powershell
Set-Location frontend
npm run dev
```

Expected:

- Next.js listen di `http://localhost:3000`
- `Serwist is disabled` pada mode dev adalah normal

### 5. Untuk uji PWA offline, build frontend production-like

```powershell
Set-Location C:\hp-container-system
npm run build:frontend
```

Catatan:

- `next dev` menonaktifkan Serwist/service worker
- uji offline PWA yang melibatkan cache asset dan instalasi service worker harus memakai hasil build, bukan mengandalkan `next dev`

---

## 9. Instruksi Uji Fitur PWA Offline (TTL 30 Menit)

### Tujuan

Memastikan queue offline tersimpan di IndexedDB, sinkron saat online, dan menandai transaksi sebagai late sync bila melebihi 30 menit.

### Langkah uji

1. Jalankan frontend dengan bundle hasil `npm run build:frontend` dan buka `/scan`.
2. Login sebagai siswa yang valid.
3. Pastikan halaman sudah termuat saat masih online.
4. Buka DevTools:
   - tab `Application`
   - cek IndexedDB `hp-container-offline-v1`
   - cek service worker `sw.js` aktif
5. Putuskan jaringan browser menjadi `Offline`.
6. Lakukan scan atau input manual QR container lalu konfirmasi transaksi.
7. Pastikan:
   - UI menampilkan status scan disimpan lokal
   - record baru muncul di store `scan-buffer`
   - payload queue menyimpan `request_id`, `timestamp`, `fingerprint`, dan `qr_token`
8. Kembalikan jaringan ke `Online`.
9. Pastikan:
   - `OfflineIndicator` melakukan sinkronisasi
   - entry IndexedDB terhapus setelah sukses
   - transaksi tercatat di backend

### Validasi TTL

#### Kasus A - sinkron < 30 menit

- buat queue offline
- sinkronkan kembali sebelum 30 menit
- expected: `phone_transactions.is_late_sync = false`

#### Kasus B - sinkron > 30 menit

- buat queue offline
- tunggu lebih dari 30 menit, atau edit timestamp antrian di IndexedDB agar lebih tua dari 30 menit
- sinkronkan kembali
- expected: `phone_transactions.is_late_sync = true`

### Titik validasi teknis

- frontend buffer: `frontend/lib/offline-buffer.ts`
- sinkron queue: `frontend/components/OfflineIndicator.tsx`
- penentuan TTL: `backend/services/transactions.ts`

---

## 10. Instruksi Validasi RPC Penalti Penyitaan

### Tujuan

Memastikan RPC `validate_and_get_preview` mengembalikan status penalti yang benar untuk siswa dengan violation aktif.

### Cara validasi paling langsung

Gunakan SQL editor Supabase atau koneksi database yang aman, lalu uji terhadap `student_id` dan `container_id` nyata.

### Skenario 1 - satu violation aktif dalam 24 jam

```sql
insert into public.student_violations (student_id, violation_type, timestamp)
values ('<student_id>', 'UNAUTHORIZED_OUT', timezone('utc', now()));

select public.validate_and_get_preview('<student_id>', '<container_id>');
```

Expected:

- `is_allowed = false`
- `error_code = 'STUDENT_PENALIZED'`
- `penalty_status.type = 'SEIZURE_24H'`

### Skenario 2 - dua violation aktif

```sql
insert into public.student_violations (student_id, violation_type, timestamp)
values
  ('<student_id>', 'UNAUTHORIZED_OUT', timezone('utc', now())),
  ('<student_id>', 'MISSING_SCAN_IN', timezone('utc', now()));

select public.validate_and_get_preview('<student_id>', '<container_id>');
```

Expected:

- `is_allowed = false`
- `error_code = 'STUDENT_PENALIZED'`
- `penalty_status.type = 'PARENT_PICKUP'`

### Skenario 3 - violation sudah selesai atau sudah lewat 24 jam

```sql
update public.student_violations
set resolved_at = timezone('utc', now())
where student_id = '<student_id>'
  and resolved_at is null;

select public.validate_and_get_preview('<student_id>', '<container_id>');
```

Expected:

- penalti tidak lagi memblokir preview
- hasil kembali mengikuti state transaksi terakhir dan jadwal reguler/approval guru

### Titik validasi teknis

- RPC: `database/schema.sql`
- adaptasi response backend: `backend/services/scan.ts`
- tampilan UI penalti: `frontend/scanner/MobileScannerShell.tsx`

---

## 11. Urutan Pembaruan Repositori

Gunakan urutan berikut setelah seluruh verifikasi lokal selesai dan branch aktif sudah benar:

```powershell
git add backend frontend database docs scripts package.json package-lock.json tsconfig.base.json .env.example .gitignore .nvmrc README.md
git commit -m "feat: finalize milestone 13-24 optimization rollout"
git push origin <nama-branch>
```

Jika ingin commit message yang lebih eksplisit terhadap sinkronisasi dokumen dan hardening flow lokal, alternatif yang tetap sesuai Conventional Commits:

```powershell
git commit -m "feat: harden milestone 13-24 local validation and docs sync"
```

### Makna commit yang dianjurkan

- `feat` dipakai karena repo ini memuat penyelesaian dan hardening fitur milestone 13-24, bukan sekadar kosmetik dokumentasi
- satu commit ringkas lebih cocok bila perubahan dikirim sebagai satu paket optimasi terpadu

---

## 12. Ringkasan Verifikasi Terakhir

Per 14 April 2026:

- resume teknis ini sudah diselaraskan dengan kode aktual
- kontrak data scan kini meneruskan `qr_token` dan `penaltyStatus`
- UI scan sudah menampilkan penalti penyitaan secara eksplisit
- typecheck frontend dan backend lulus
- `frontend npm run dev` berhasil start
- `npm run build:frontend` berhasil dan membundle service worker
- `backend npm run dev` masih membutuhkan Node 22 agar `wrangler dev` stabil

Selama kondisi di atas belum berubah, dokumen ini harus dipakai sebagai referensi utama untuk onboarding, local test, dan penutupan perubahan repositori.
