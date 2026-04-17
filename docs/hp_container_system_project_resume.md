# Sistem Manajemen Container HP Sekolah

### Resume Teknis Kanonis

**Versi:** 1.4.1  
**Tanggal sinkronisasi:** 17 April 2026  
**Status dokumen:** Sumber kebenaran teknis utama untuk isi repo ini.  
**Dokumen roadmap pendamping:** `docs/optimation-milestone.md` tetap dipakai sebagai referensi milestone, tetapi implementasi aktual dan status siap-uji harus mengikuti dokumen ini.

---

## 1. Ringkasan Sistem

Sistem ini mengelola penyimpanan HP siswa berbasis:

- akun siswa, guru, wali kelas, dan admin
- kontainer fisik dengan QR dinamis
- pratinjau scan sebelum transaksi disimpan
- approval guru individual maupun massal
- dasbor monitoring sekolah real-time
- audit trail, arsip log, dan laporan mingguan
- guardrail fingerprint perangkat
- buffer offline ringan untuk area sinyal lemah
- sistem pelanggaran dan penalti penyitaan
- lokalisasi penuh Bahasa Indonesia dan standar aksesibilitas

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
- Indicator sinkronisasi & offline banner: `frontend/components/OfflineIndicator.tsx`
- Search cepat: `frontend/components/GlobalSearch.tsx`
- Virtualisasi: `frontend/pages/dashboard.tsx`, `frontend/pages/teacher/approve.tsx`
- Form UX & Validation: `frontend/hooks/useForm.ts`, `frontend/hooks/useUnsavedChanges.ts`

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

## 3. Status Implementasi Milestone 13-26

### Sudah hidup di repo

1. **Milestone 13 - RPC Scan Optimization**  
   Sudah aktif lewat `validate_and_get_preview` dan `latest_student_transactions`.

2. **Milestone 14 - Bulk Teacher Approval**  
   Sudah aktif lewat `bulk_upsert_teacher_approvals` dan UI batch di `/teacher/approve`. Ditambah fitur **Quick Approve** untuk efisiensi per siswa.

3. **Milestone 15 - PWA Offline Buffer**  
   Sudah aktif lewat IndexedDB queue, auto-sync saat online, dan flag `is_late_sync` dengan TTL 30 menit.

4. **Milestone 16 - QR Regenerator Security**  
   Sudah aktif di schema (`qr_secret_token`), rotasi token backend, dan frontend meneruskan `qr_token`.

5. **Milestone 17 - Virtualization**  
   Sudah aktif di dasbor dan halaman approval massal memakai `react-window` v2.

6. **Milestone 20 - Audit Log Archiving ke R2**  
   Sudah aktif lewat cron worker production.

7. **Milestone 21 - Weekly HTML Reports via Resend**  
   Sudah aktif lewat cron worker production `sendWeeklyReport`.

8. **Milestone 22 - UI Polish dan Haptic Feedback**  
   Sudah aktif lewat skeleton, toast `sonner`, dan `navigator.vibrate()`.

9. **Milestone 23 - Device Fingerprinting Guardrail**  
   Sudah aktif lewat enrollment fingerprint saat login.

10. **Milestone 24 - Student Violation & Penalty System**  
    Sudah aktif dalam bentuk tabel `student_violations`, halaman `/admin/violations`, dan aturan penalti pada RPC scan.

11. **Milestone 25 - Full Indonesian Localization & Accessibility (A11y)**  
    Sudah aktif. Seluruh UI menggunakan Bahasa Indonesia standar sekolah. Dukungan keyboard (focus rings), ARIA labels, `aria-live` untuk pengumuman scan, dan skip link publik yang tidak menggeser layout sebelum fokus keyboard sudah diimplementasikan.

12. **Milestone 26 - Mobile UX Optimization & Offline Awareness**  
    Sudah aktif. Tabel monitoring bertransformasi menjadi tampilan kartu pada mobile. Banner status koneksi dan deferred install prompt PWA sudah tersedia. Fitur scan otomatis nonaktif saat offline dengan pesan edukatif.

---

## 4. Model Data Aktual

(Sama seperti versi 1.3, tidak ada perubahan schema pada update terakhir ini)

---

## 5. Logika Scan dan Penalti yang Berlaku

### Alur scan reguler (Terlokalisasi)

1. Frontend mengirim data validasi.
2. Backend memproses via RPC `validate_and_get_preview`.
3. Jika diizinkan, UI menampilkan tombol "Titipkan HP" atau "Ambil HP".
4. Jika diblokir (Penalti), UI menampilkan pesan kesalahan dalam Bahasa Indonesia (misal: "Anda sedang dalam masa penyitaan 1x24 jam").

---

## 6. Prasyarat Pengujian Lokal (Update 16 April 2026)

### Verifikasi yang baru ditambahkan:

- **Typecheck & Build**: Pastikan `npm run typecheck` dan `npm run build` lulus di folder `frontend`.
- **Accessibility**: Gunakan keyboard (Tab) untuk memastikan seluruh elemen interaktif dapat dijangkau, termasuk skip link pada `/login` yang harus muncul tanpa menggeser posisi kartu login.
- **Localization**: Pastikan tidak ada string Inggris yang tersisa (kecuali istilah teknis dalam detail audit).
- **Responsive**: Uji tampilan pada resolusi < 768px untuk melihat transformasi tabel ke kartu.

---

## 12. Ringkasan Verifikasi Terakhir

Per 17 April 2026:

- Dasbor didesain ulang dengan polling real-time (30 detik) dan indikator "Aktif".
- Alur perizinan guru dipercepat dengan modal **Quick Approve**.
- Manajemen kontainer admin mendukung **Edit Inline** dan **Unduh QR (PNG/SVG)**.
- Halaman **Riwayat Siswa** baru di `/history` sudah aktif.
- Validasi form diperkuat dengan feedback real-time dan proteksi perubahan yang belum disimpan.
- Halaman login kini memakai logo yang lebih proporsional, dan skip link tidak lagi mengubah centering layout sebelum menerima fokus keyboard.
- Seluruh sistem lulus uji TypeScript dan Build lokal.
