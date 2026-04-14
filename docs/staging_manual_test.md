# Staging Manual Test Checklist

Dokumen ini dipakai untuk uji browser manual pada staging setelah API end-to-end lolos.

## Peringatan Operasional

Environment staging saat ini memakai project Supabase yang sama dengan production.

Artinya:

- setiap transaksi di staging akan mengubah data live
- audit log staging dan production akan tercampur
- checklist ini hanya boleh dipakai untuk verifikasi terbatas yang sudah disetujui

Untuk operasional normal sekolah, tetap gunakan URL production.

Sebelum memulai test browser manual di staging, pastikan frontend terakhir dibuild dengan `npm run build:frontend:staging`. Jangan deploy hasil `next build` polos karena bundle bisa membawa fallback dummy dan memunculkan error fetch di halaman login.

## URL Staging

- Frontend: `https://hp-container-system-staging.pages.dev`
- Backend: `https://hp-container-system-api-staging.ahfancool.workers.dev`

## Akun Uji

Password semua akun: `StageTest!2026`

- Admin: `admin@school.local`
- Teacher: `rina.guru@school.local`
- Student 1: `ahmad.siswa@school.local`
- Student 2: `bunga.siswa@school.local`

## Data Referensi

Container aktif:

- `Container A` di `Ruang Tata Tertib`
- `Container B` di `Koridor Lantai 2`

QR payload:

- `container://3a36be78-7a1d-47d2-a214-5d8f7c487f11`
- `container://65050506-01fd-48fb-90bf-978339e89d22`

## Skenario 1 - Login Role

1. Buka `/login`.
2. Login sebagai `admin@school.local`.
3. Pastikan halaman sesi aktif menampilkan role `admin`.
4. Logout.
5. Ulangi untuk:
   - `rina.guru@school.local`
   - `ahmad.siswa@school.local`
   - `bunga.siswa@school.local`

Expected:

- Admin terlihat sebagai `admin`
- Guru terlihat sebagai `teacher`
- Siswa terlihat sebagai `student`
- Ahmad dan Bunga harus menunjukkan status student linked

## Skenario 2 - Halaman Scan Student

1. Login sebagai `ahmad.siswa@school.local`.
2. Buka `/scan`.
3. Izinkan akses kamera jika browser meminta.
4. Jika kamera tidak tersedia, tempel payload QR manual:
   - `container://3a36be78-7a1d-47d2-a214-5d8f7c487f11`
5. Jalankan preview scan.
6. Pastikan transaksi belum tersimpan sebelum tombol konfirmasi ditekan.

Expected:

- Halaman scan bisa dibuka
- Preview scan berhasil
- Tombol konfirmasi muncul sebelum transaksi dicatat
- Jalur input manual selalu terlihat
- Sistem tidak meminta role guru

## Skenario 3 - Approval Guru

1. Login sebagai `rina.guru@school.local`.
2. Buka `/teacher/approve`.
3. Cari siswa yang status terakhirnya `IN` dan belum punya approval aktif.
4. Pilih `Container A`.
5. Pilih tipe approval `PEMBELAJARAN`.
6. Submit approval.

Expected:

- Approval berhasil
- Tidak muncul error role
- Riwayat siswa belum berubah ke status keluar
- Halaman menampilkan `Approval Aktif` dan instruksi agar siswa scan
- Siswa muncul di daftar `Menunggu Scan`

## Skenario 4 - Transaction Student Setelah Approval

1. Login lagi sebagai siswa yang tadi di-approve.
2. Buka `/scan`.
3. Scan atau tempel lagi QR `Container A`.
4. Pastikan preview menunjukkan aksi `OUT` dengan tipe approval yang aktif.
5. Lanjutkan simpan transaksi.

Expected:

- Sistem mencatat transaksi `OUT` dengan tipe approval terkait
- Approval aktif ditandai sudah dipakai
- Tidak terjadi transaksi ganda jika tombol diklik ulang cepat

## Skenario 5 - Dashboard Guru

1. Login sebagai `rina.guru@school.local`.
2. Buka `/dashboard`.

Expected:

- Dashboard tampil
- Ringkasan sekolah tampil terpisah dari hasil filter aktif
- Kartu `Approval Menunggu` muncul jika masih ada izin yang belum dipakai
- Aktivitas terbaru terlihat
- Tidak ada error akses

## Skenario 6 - Audit Log Admin

1. Login sebagai `admin@school.local`.
2. Buka `/admin/audit`.

Expected:

- Audit log tampil
- Event seperti `teacher_approval.created`, `teacher_approval.used`, `transaction.created`, dan `auth.unauthorized_role` bisa terlihat

## Catatan State Saat Ini

State staging sudah berubah karena pengujian API dan browser sebelumnya.

Jika siswa contoh tidak siap untuk skenario tertentu:

- pilih siswa lain yang status terakhirnya `IN` dan belum punya approval aktif
- selesaikan dulu approval yang masih pending dengan scan siswa yang benar
- gunakan request atau timestamp baru sesuai kebutuhan

Peringatan:

- jangan melakukan reset data jika project Supabase live masih dipakai bersama oleh production
- bila perlu kondisi bersih, lebih aman siapkan database terpisah terlebih dahulu
