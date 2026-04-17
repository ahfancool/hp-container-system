# Live Operational Policy

Dokumen ini menjelaskan keputusan operasional saat ini: `staging` dan `production` memakai satu project Supabase yang sama.

## Status Keputusan

- mode database: `single Supabase`
- endpoint utama frontend: `https://hp-container-system-production.pages.dev`
- endpoint utama backend: `https://hp-container-system-api-production.ahfancool.workers.dev`
- endpoint preview frontend: `https://hp-container-system-staging.pages.dev`
- endpoint preview backend: `https://hp-container-system-api-staging.ahfancool.workers.dev`

## Arti Keputusan Ini

Karena `staging` dan `production` menunjuk ke database yang sama, maka:

- login user di staging dan production memakai akun Auth yang sama
- transaksi scan di staging akan memengaruhi dashboard production
- audit log dari staging dan production akan tercampur di tabel yang sama
- perubahan schema Supabase langsung berdampak ke sistem live

## Aturan Penggunaan URL

- Gunakan URL production untuk operasional harian sekolah.
- Gunakan URL staging hanya untuk preview terbatas, smoke test, atau validasi pasca deploy.
- Jangan bagikan URL staging ke pengguna umum sebagai URL utama.
- Saat custom domain sekolah siap, domain production baru menjadi endpoint resmi berikutnya.
- Jika deploy frontend dilakukan manual dari local workspace, build harus memakai `npm run build:frontend:staging` atau `npm run build:frontend:production`, bukan `next build` polos.

## Aktivitas Yang Diizinkan Di Staging

- cek apakah halaman bisa dibuka setelah deploy
- verifikasi login singkat oleh admin atau operator yang ditunjuk
- cek `/login` dan pastikan halaman tidak menampilkan error fetch; tekan `Tab` sekali untuk memastikan skip link fokus tanpa menggeser layout
- cek endpoint `/health`
- cek halaman tertentu tanpa membuat perubahan data bila memungkinkan
- uji transaksi hanya jika sudah disetujui dan semua pihak paham bahwa data live akan berubah

## Aktivitas Yang Harus Dihindari Di Staging

- uji coba bebas dengan akun siswa nyata tanpa koordinasi
- reset data atau seed ulang Supabase live
- menjalankan migration berisiko pada jam operasional
- load test atau spam request ke endpoint live
- menganggap staging sebagai tempat aman untuk eksperimen destruktif

## Aturan Perubahan Database

- Jalankan perubahan schema hanya setelah SQL direview.
- Lakukan backup atau export data penting sebelum perubahan besar.
- Kerjakan perubahan di luar jam sibuk jika ada risiko lock atau error.
- Setelah schema berubah, verifikasi endpoint production dan dashboard utama.

## Aturan Pengujian Operasional

- Catat siapa yang melakukan uji dan kapan dilakukan.
- Pakai akun uji yang sudah ditetapkan bila memungkinkan.
- Jika uji membuat transaksi nyata, catat konsekuensinya ke operator sekolah.
- Setelah uji selesai, cek audit log untuk memastikan jejak perubahan terbaca.
- Setelah deploy frontend, lakukan smoke test minimum ke `/`, `/login`, dan `/scan` sebelum URL dibagikan ke operator, termasuk cek fokus keyboard di `/login`.

## Kapan Harus Pindah Ke Dual Supabase

Pertimbangkan memisahkan Supabase production dari staging jika salah satu kondisi ini terjadi:

- sekolah butuh uji coba fitur tanpa menyentuh data live
- traffic dan jumlah kelas bertambah sehingga risiko human error naik
- perubahan schema menjadi lebih sering
- diperlukan kepatuhan audit yang memisahkan data uji dan data operasional
