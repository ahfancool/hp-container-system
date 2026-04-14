# Prosedur Restorasi Audit Log (Milestone 20)

Dokumen ini menjelaskan langkah-langkah teknis untuk melakukan restorasi sampel data dari archive Cloudflare R2 kembali ke database utama (Supabase) jika diperlukan untuk audit insidentil.

## 1. Lokasi Penyimpanan Archive
Audit logs diarsipkan ke Cloudflare R2 dengan pola penamaan:
`logs/YYYY-MM/YYYY-MM-DD-HHmm.jsonl`

## 2. Cara Restorasi Sampel
Sistem telah menyediakan fungsi internal `restoreSampleFromArchive` di dalam `backend/services/archive.ts`. Namun, untuk penggunaan operasional, ikuti panduan berikut:

### Opsi A: Menggunakan Script (Jika Terpasang)
Jika admin memiliki akses ke environment backend, jalankan perintah (asumsi ada CLI tool atau test script):
```bash
# Contoh pemanggilan internal via script
await restoreSampleFromArchive(env, "logs/2026-03/2026-03-01-0200.jsonl", 100);
```

### Opsi B: Restorasi Manual via SQL
1. Buka dashboard Cloudflare R2.
2. Cari file archive yang ingin direstorasi (misal: `logs/2026-03/xxxx.jsonl`).
3. Download file tersebut.
4. Karena format file adalah JSONL (satu JSON per baris), Anda bisa mengkonversinya ke CSV atau langsung mengimpor ke Supabase via **SQL Editor**:

```sql
-- Contoh SQL Insert dari data JSON
insert into public.audit_logs (
  id, event_type, severity, request_id, actor_user_id, 
  actor_role, student_id, container_id, transaction_id, 
  route_method, route_path, status_code, ip_address, 
  user_agent, details, created_at
)
select 
  (val->>'id')::uuid,
  val->>'event_type',
  val->>'severity',
  val->>'request_id',
  (val->>'actor_user_id')::uuid,
  val->>'actor_role',
  (val->>'student_id')::uuid,
  (val->>'container_id')::uuid,
  (val->>'transaction_id')::uuid,
  val->>'route_method',
  val->>'route_path',
  (val->>'status_code')::integer,
  val->>'ip_address',
  val->>'user_agent',
  (val->>'details')::jsonb,
  (val->>'created_at')::timestamptz
from (
  select jsonb_array_elements('[
    {"id": "...", "event_type": "..."}, 
    {"id": "...", "event_type": "..."}
  ]'::jsonb) as val
) as data;
```

## 3. Kebijakan Purge (Penghapusan)
*   Data di database hanya dihapus **setelah** verifikasi upload ke R2 berhasil (melalui pengecekan `head` object di bucket).
*   Default threshold pengarsipan adalah data yang berumur lebih dari **30 hari**.
*   Proses berjalan otomatis setiap hari pukul **02:00 pagi**.

## 4. Verifikasi Keberhasilan Archive
Anda dapat memantau log worker di dashboard Cloudflare untuk melihat output:
`Archive result: {"archivedCount": 150, "purgedCount": 150, "fileName": "logs/2026-04/..."}`
