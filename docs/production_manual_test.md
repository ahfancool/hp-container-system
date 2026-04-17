# Production Manual Test Checklist

Dokumen ini dipakai untuk uji browser manual pada environment production default Cloudflare.

## Status Endpoint

URL production di dokumen ini adalah endpoint resmi yang dipakai untuk akses harian saat sistem live.

Sebelum memulai test browser manual, pastikan frontend production terakhir dibuild dengan `npm run build:frontend:production`. Jika tidak, halaman login bisa memuat bundle dummy dan menampilkan error fetch meski backend sehat.

## URL Production

- Frontend: `https://hp-container-system-production.pages.dev`
- Backend: `https://hp-container-system-api-production.ahfancool.workers.dev`

## Akun Uji Saat Ini

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

## Skenario 1 - Login

1. Buka `/login`.
2. Tekan `Tab` satu kali dari bagian atas halaman.
3. Pastikan skip link ke konten utama muncul saat fokus keyboard dan kartu login tetap berada di tengah.
4. Login sebagai `admin@school.local`.
5. Pastikan sesi aktif terbaca sebagai `admin`.
6. Logout.
7. Ulangi untuk `rina.guru@school.local` dan `ahmad.siswa@school.local`.

Expected:

- Role terbaca benar
- Student account menunjukkan student linked
- Skip link hanya terlihat saat fokus keyboard dan tidak menggeser layout login saat belum difokuskan
- Logo login terlihat proporsional pada viewport desktop maupun mobile

## Skenario 2 - Scan Student

1. Login sebagai `ahmad.siswa@school.local`.
2. Buka `/scan`.
3. Izinkan kamera browser.
4. Jika kamera tidak tersedia, tempel QR payload manual `container://3a36be78-7a1d-47d2-a214-5d8f7c487f11`.
5. Pastikan preview transaksi muncul lebih dulu.
6. Konfirmasi transaksi hanya jika aksi yang ditampilkan sudah sesuai.

Expected:

- Halaman scan bisa dibuka
- Preview scan berhasil sebelum data tersimpan
- Tombol konfirmasi diperlukan untuk mencatat transaksi
- Input manual tetap terlihat saat kamera bermasalah
- Tidak muncul error autentikasi

## Skenario 3 - Approval Guru

1. Login sebagai `rina.guru@school.local`.
2. Buka `/teacher/approve`.
3. Cari siswa yang status terakhirnya masih `IN` dan belum punya approval aktif.
4. Pilih `Container A`.
5. Pilih `PEMBELAJARAN`.
6. Submit approval.

Expected:

- Approval berhasil
- Halaman menampilkan status `Approval Aktif`
- Status HP belum berubah menjadi `OUT` sebelum siswa scan
- Approval muncul di panel `Menunggu Scan`

## Skenario 4 - Student Menyelesaikan Approval

1. Login sebagai siswa yang tadi di-approve.
2. Buka `/scan`.
3. Scan atau tempel QR `Container A`.
4. Pastikan preview menunjukkan aksi `OUT` dengan tipe approval yang aktif.
5. Konfirmasi transaksi.

Expected:

- Transaksi `OUT` baru tercatat setelah konfirmasi
- Halaman hasil transaksi menjelaskan approval sudah terpakai
- Tidak terjadi transaksi ganda jika tombol konfirmasi terpencet ulang cepat

## Skenario 5 - Dashboard dan Audit

1. Login sebagai `rina.guru@school.local`.
2. Buka `/dashboard`.
3. Login sebagai `admin@school.local`.
4. Buka `/admin/audit`.

Expected:

- Dashboard membedakan ringkasan sekolah dan hasil filter aktif
- Jika masih ada izin aktif, dashboard menampilkan `Approval Menunggu`
- Audit log menampilkan event terbaru seperti `teacher_approval.created`, `teacher_approval.used`, `transaction.created`, dan `audit.logs_viewed`

## Catatan Penting

- Environment production saat ini masih memakai domain default Cloudflare, belum custom domain sekolah.
- Production dan staging saat ini masih memakai project Supabase yang sama.
- Hindari pengujian liar di staging karena efek datanya juga akan terlihat di production.
- Jika sekolah nanti butuh isolasi penuh, pisahkan Supabase production dari staging pada fase berikutnya.
