# Optimization & Expansion Milestones (Post-Deployment)

Dokumen ini melanjutkan roadmap utama setelah milestone 0 sampai 12.
Fokus dokumen ini adalah optimasi lanjutan yang tetap kompatibel dengan prinsip biaya operasional serendah mungkin (free plan first).

## Konteks dan Penomoran

Penomoran di dokumen ini sudah diselaraskan dengan milestone awal pengembangan:

1. Milestone inti: 0 sampai 12
2. Milestone lanjutan: 13 sampai 23

Artinya, dokumen ini tidak memulai ulang nomor milestone, tetapi meneruskan urutan resmi roadmap proyek.

## Prinsip Prioritas Praktis

Urutan di bawah ini disusun berdasarkan dampak operasional paling cepat di lapangan:

1. Stabilkan alur kritikal scan dan dashboard dulu.
2. Kurangi bottleneck operasional guru/admin setelah alur stabil.
3. Tambahkan lapisan keamanan anti-penyalahgunaan yang paling feasible.
4. Tambahkan UX polish setelah performa dan keandalan sudah aman.

## Urutan Prioritas Milestone 13 sampai 24

1. Milestone 13 - Supabase Query and RPC Optimization (Scalability Core)
2. Milestone 14 - Bulk Teacher Approval UI (Operational Efficiency)
3. Milestone 15 - PWA Offline Buffer (Reliability in Weak Signal)
4. Milestone 17 - Client-side Virtualization for 2000+ Students
5. Milestone 18 - Edge-Cached Global Search (CMD+K)
6. Milestone 19 - Lightweight Web Push (Approval Status)
7. Milestone 20 - Audit Log Archiving to Cloudflare R2
8. Milestone 21 - Weekly HTML Reports via Resend
9. Milestone 22 - Professional UI Polish and Haptic Feedback
10. Milestone 23 - Device Fingerprinting Guardrail
11. Milestone 16 - QR Regenerator Security (Anti-Fraud)
12. Milestone 24 - Student Violation & Penalty System (Automated Discipline)
13. Milestone 25 - Full Indonesian Localization & Accessibility (A11y)
14. Milestone 26 - Mobile UX Optimization & Offline Awareness

---

## Milestone 25 - Full Indonesian Localization & Accessibility (A11y)

Masalah:
Bahasa campuran (Inggris-Indonesia) membingungkan pengguna, dan aplikasi sulit diakses alat bantu (screen reader/keyboard).

Optimasi:
Standarisasi seluruh UI ke Bahasa Indonesia yang ramah sekolah dan implementasi standar aksesibilitas WCAG AA.

Instruksi eksekusi:
1. Ganti seluruh hardcoded string Inggris ke Bahasa Indonesia (misal: Submit -> Simpan, Dashboard -> Monitoring).
2. Gunakan format tanggal dan waktu lokal (Senin, 14 April 2026; 07.30 WIB).
3. Tambahkan `focus-visible` styles, ARIA labels, dan roles pada elemen interaktif.
4. Implementasikan `aria-live` region untuk pengumuman hasil scan ke screen reader.

Definition of done:
1. Seluruh UI 100% berbahasa Indonesia yang konsisten.
2. Navigasi keyboard berfungsi penuh dan kontras warna memenuhi standar WCAG AA.

---

## Milestone 26 - Mobile UX Optimization & Offline Awareness

Masalah:
Tabel data sulit dibaca di HP, dan pengguna sering tidak sadar saat koneksi internet terputus.

Optimasi:
Transformasi tabel menjadi tampilan kartu pada mobile dan penambahan indikator status koneksi yang eksplisit.

Instruksi eksekusi:
1. Gunakan CSS Grid/Flexbox untuk mengubah `.activity-table` menjadi `.activity-card` pada layar kecil.
2. Tambahkan banner "Tidak ada koneksi internet" yang muncul secara real-time.
3. Implementasikan deferred install prompt untuk meningkatkan retensi pengguna PWA.
4. Nonaktifkan fitur scan secara eksplisit saat offline untuk menjaga integritas data waktu.

Definition of done:
1. Monitoring dapat dilakukan dengan nyaman di layar smartphone.
2. Pengguna mendapatkan feedback instan saat status jaringan berubah.

## Milestone 13 - Supabase Query and RPC Optimization (Scalability Core)

Masalah:
Request scan masih berpotensi melakukan beberapa round-trip ke Supabase per transaksi.

Optimasi:
Konsolidasi validasi ke PostgreSQL Function (RPC) agar jumlah call berkurang dan latensi lebih stabil saat peak.

Instruksi eksekusi:
1. Identifikasi jalur scan yang memanggil query berulang (student, container, approval, state terakhir).
2. Buat function SQL seperti `validate_and_get_preview` di `database/schema.sql`.
3. Panggil function via `client.rpc(...)` di `backend/services/scan.ts`.
4. Pastikan query path utama memakai index yang tepat dan targetkan latensi DB < 50ms.

Definition of done:
1. Jumlah query per scan turun signifikan.
2. Tidak ada perubahan perilaku bisnis dari flow preview -> confirm.

---

## Milestone 14 - Bulk Teacher Approval UI (Operational Efficiency)

Masalah:
Guru harus approve siswa satu per satu untuk kebutuhan kelas, memakan waktu.

Optimasi:
Bulk approval berbasis kelas agar proses izin massal lebih cepat dan konsisten.

Instruksi eksekusi:
1. Update endpoint approval agar menerima `student_ids[]`.
2. Konsolidasikan insert approval dengan query berbasis set (`INSERT ... SELECT` atau mekanisme batch aman yang ekuivalen).
3. Tambahkan UI pilihan massal di `frontend/pages/teacher/approve.tsx`.
4. Pastikan audit log tetap mencatat jejak approval dengan jelas.

Definition of done:
1. Guru dapat approve banyak siswa dalam satu aksi.
2. Approval tetap tersimpan sebagai pending dan tetap dikonsumsi saat scan siswa.

---

## Milestone 15 - PWA Offline Buffer (Reliability in Weak Signal)

Masalah:
Area loker dengan sinyal lemah membuat scan terganggu saat jaringan putus.

Optimasi:
Tambahkan mode offline ringan untuk menyimpan antrian lokal lalu sinkron saat kembali online.

Instruksi eksekusi:
1. Integrasikan PWA di frontend (`serwist` atau `next-pwa`) pada setup static export yang kompatibel.
2. Simpan payload scan sementara di `IndexedDB` (lebih aman dari localStorage untuk antrian).
3. Sinkronkan antrian ketika event `online` terdeteksi.
4. **Sync Validity Window:** Berikan batas maksimal sinkronisasi (TTL) 30 menit. Jika data disinkronkan lebih dari 30 menit dari waktu scan asli, sistem harus menandainya sebagai `FLAGGED_LATE_SYNC`.
5. Beri indikator status offline dan status sinkron di UI scan.

Definition of done:
1. User tetap bisa mengantri aksi scan saat internet putus.
2. Antrian terkirim otomatis saat koneksi pulih.
3. Transaksi yang terlambat sinkron (> 30 menit) memiliki flag khusus di database.

---

## Milestone 17 - Client-side Virtualization for 2000+ Students

Masalah:
Render list besar di dashboard dapat membuat browser lambat.

Optimasi:
Gunakan virtualization/windowing agar hanya item yang terlihat yang dirender.

Instruksi eksekusi:
1. Pasang `react-window` di frontend.
2. Ganti list `.map()` berat dengan `FixedSizeList` atau `VariableSizeList`.
3. Pastikan row component stabil dan hanya rerender saat data row berubah.

Definition of done:
1. Dashboard tetap responsif pada data 2000+ siswa.
2. Scroll dan filter tetap lancar.

---

## Milestone 18 - Edge-Cached Global Search (CMD+K)

Masalah:
Pencarian siswa terasa lambat jika selalu hit backend saat mengetik.

Optimasi:
Gunakan index lokal client + cache edge untuk data minimal pencarian.

Instruksi eksekusi:
1. Ambil dataset minimal (id, nama, nis, class) saat admin login.
2. Jalankan fuzzy search lokal dengan `Fuse.js`.
3. Simpan cache hasil fetch dengan TTL (misalnya 1 jam) untuk mengurangi request berulang.
4. Tambahkan shortcut CMD+K/CTRL+K untuk akses cepat.

Definition of done:
1. Hasil pencarian muncul instan.
2. Beban query pencarian ke backend turun signifikan.

---

## Milestone 19 - Lightweight Web Push (Approval Status)

Masalah:
Siswa terus refresh halaman untuk melihat status approval.

Optimasi:
Notifikasi web push ringan saat status approval berubah.

Instruksi eksekusi:
1. Generate dan simpan VAPID keys.
2. Simpan `PushSubscription` per user di tabel baru.
3. Kirim push saat approval menjadi `APPROVED` atau `USED`.
4. Sediakan fallback in-app indicator jika push permission ditolak.

Definition of done:
1. User menerima notifikasi status tanpa refresh manual berulang.
2. Tidak ada ketergantungan layanan push berbayar.

---

## Milestone 20 - Audit Log Archiving to Cloudflare R2

Masalah:
Pertumbuhan audit log dapat menekan kuota storage database.

Optimasi:
Archive log lama ke R2 dalam format CSV/JSONL lalu purge terkontrol.

Instruksi eksekusi:
1. Buat job arsip periodik (worker cron).
2. Simpan file arsip ke R2 dengan pola `logs/YYYY-MM.*`.
3. Hapus log lama dari DB setelah checksum/verifikasi arsip berhasil.
4. Tambahkan prosedur restore sample untuk audit kebutuhan insidentil.

Definition of done:
1. Ukuran tabel audit terkendali.
2. Arsip dapat dilacak dan diverifikasi.

---

## Milestone 21 - Weekly HTML Reports via Resend

Masalah:
Admin perlu ringkasan rutin tanpa harus selalu membuka dashboard.

Optimasi:
Kirim laporan mingguan HTML via cron worker dan Resend.

Instruksi eksekusi:
1. Buat agregasi mingguan metrik utama.
2. Render template HTML ringan langsung dari worker.
3. Kirim email terjadwal ke daftar admin.
4. Catat status pengiriman ke audit log.

Definition of done:
1. Laporan mingguan terkirim otomatis sesuai jadwal.
2. Isi laporan konsisten dengan data dashboard.

---

## Milestone 22 - Professional UI Polish and Haptic Feedback

Masalah:
UI terasa terlalu utilitarian, feedback loading dan aksi belum cukup jelas.

Optimasi:
Tambah skeleton loader, micro-animation seperlunya, toast informatif, dan haptic feedback di mobile.

Instruksi eksekusi:
1. Tambahkan skeleton untuk layar status dan daftar.
2. Gunakan animasi transisi ringan tanpa mengganggu performa.
3. Tambahkan toast (`sonner` atau setara) untuk status transaksi.
4. Tambahkan `navigator.vibrate()` pada scan sukses/gagal dengan fallback aman.

Definition of done:
1. UX terasa lebih jelas tanpa menambah kebisingan visual.
2. Performa mobile tetap terjaga.

---

## Milestone 23 - Device Fingerprinting Guardrail

Masalah:
Akun siswa berpotensi dipakai lintas perangkat tanpa kontrol.

Optimasi:
Tambah guardrail fingerprint sebagai sinyal risiko, bukan pemblokiran buta.

Instruksi eksekusi:
1. Simpan fingerprint hash perangkat saat login sukses.
2. Deteksi perubahan fingerprint pada akses sensitif seperti `/scan`.
3. Terapkan mode bertahap: warn -> verify ulang -> blokir terbatas jika terindikasi penyalahgunaan.
4. Dokumentasikan kebijakan privasi dan false-positive handling sebelum enforcement penuh.

Definition of done:
1. Penyalahgunaan akun lintas perangkat lebih cepat terdeteksi.
2. Tidak mengorbankan usability akibat false positive berlebihan.

---

## Milestone 16 - QR Regenerator Security (Anti-Fraud)

Masalah:
QR statis rawan disalahgunakan dari foto lama atau dari luar area sekolah.

Optimasi:
Gunakan fitur 'QR Regenerator' yang dikontrol oleh guru untuk mengubah token QR secara berkala atau saat terindikasi kebocoran.

Instruksi eksekusi:
1. Tambahkan kolom `qr_secret_token` pada tabel `containers`.
2. Implementasikan fungsi di dashboard guru untuk me-reset `qr_secret_token`.
3. Update algoritma generator QR untuk menggunakan token tersebut sebagai salt.
4. Pastikan scan lama dengan token lama akan ditolak oleh backend.

Definition of done:
1. Guru dapat membatalkan validitas QR fisik/lama dengan satu klik.
2. QR baru segera aktif setelah proses regenerasi.

---

## Milestone 24 - Student Violation & Penalty System (Automated Discipline)

Masalah:
Pencatatan pelanggaran (misal: HP tidak dikumpulkan, HP diambil tanpa izin) masih manual dan sulit dilacak historinya.

Optimasi:
Implementasi otomatis tracking pelanggaran, tabel riwayat sita, dan dasbor monitoring untuk kesiswaan.

Instruksi eksekusi:
1. Buat tabel `student_violations` untuk mencatat jenis pelanggaran, waktu, dan petugas.
2. Buat logic otomatis untuk mendeteksi pelanggaran berdasarkan aturan (misal: tidak IN hingga jam tertentu).
3. Implementasikan dashboard 'Red List' khusus untuk tim Kesiswaan.
4. Tambahkan fitur pencatatan riwayat sita (confiscation logs) hingga status 'diambil orang tua'.

Definition of done:
1. Sistem otomatis mencatat pelanggaran harian.
2. Tim Kesiswaan memiliki data historis lengkap untuk penindakan lebih lanjut.

---

## Catatan Implementasi

1. Jalankan milestone secara bertahap dan ukur dampak setiap rilis.
2. Jangan gabungkan terlalu banyak milestone dalam satu deployment production.
3. Untuk setiap milestone, update dokumen test checklist dan runbook jika ada perubahan alur user.
