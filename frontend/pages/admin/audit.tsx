import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

import { Layout } from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { fetchAuditLogs, type AuditLogRecord } from "../../lib/audit";
import { getDefaultRoute } from "../../lib/navigation";
import { Button } from "../../components/ui/Button";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

import { formatDateTime } from "../../lib/format";

function getSeverityClass(severity: AuditLogRecord["severity"]): string {
  if (severity === "ERROR") {
    return "status-badge status-danger";
  }

  if (severity === "WARN") {
    return "status-badge status-pending";
  }

  return "status-badge status-inside";
}

function getSeverityLabel(severity: AuditLogRecord["severity"]): string {
  if (severity === "ERROR") {
    return "Error";
  }

  if (severity === "WARN") {
    return "Peringatan";
  }

  return "Info";
}

function getEventLabel(eventType: string): string {
  switch (eventType) {
    case "auth.missing_bearer_token":
      return "Akses tanpa token";
    case "auth.invalid_token":
      return "Token tidak valid";
    case "auth.unauthorized_role":
      return "Role tidak diizinkan";
    case "security.rate_limit_blocked":
      return "Permintaan diblok rate limit";
    case "transaction.created":
      return "Transaksi siswa tercatat";
    case "transaction.replayed":
      return "Permintaan transaksi terulang";
    case "teacher_approval.created":
      return "Approval guru tercatat";
    case "teacher_approval.updated":
      return "Approval guru diperbarui";
    case "teacher_approval.replayed":
      return "Permintaan approval terulang";
    case "teacher_approval.used":
      return "Approval guru dipakai saat scan siswa";
    case "container.created":
      return "Container baru dibuat";
    case "audit.logs_viewed":
      return "Audit log dibuka";
    default:
      return eventType;
  }
}

function readDetail(record: AuditLogRecord, key: string): string | null {
  const value = record.details[key];

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

export default function AdminAuditPage() {
  const { isReady, session, snapshot } = useAuth();
  const [items, setItems] = useState<AuditLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  // Filters
  const [severity, setSeverity] = useState<"" | "INFO" | "WARN" | "ERROR">("");
  const [eventType, setEventType] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);

  const canAuditLogs = Boolean(snapshot?.permissions.canAuditLogs);
  const supabase = getSupabaseBrowserClient();

  const loadUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, role")
      .order("name");
    if (data) setUsers(data);
  };

  const loadLogs = async (isLoadMore = false) => {
    if (!session?.access_token || !canAuditLogs) return;

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setOffset(0);
    }
    
    setError(null);

    try {
      const currentOffset = isLoadMore ? offset + limit : 0;
      const result = await fetchAuditLogs(session.access_token, {
        eventType,
        limit,
        severity,
        actorRole,
        actorUserId,
        dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        dateTo: dateTo ? new Date(dateTo).toISOString() : undefined,
        offset: currentOffset
      });

      if (isLoadMore) {
        setItems(prev => [...prev, ...result.items]);
        setOffset(currentOffset);
      } else {
        setItems(result.items);
        setOffset(0);
      }
      
      setTotal(result.meta.total);
      setHasMore(result.meta.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat audit log.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (isReady && session) {
      void loadLogs();
      void loadUsers();
    }
  }, [canAuditLogs, session?.access_token, isReady]);

  const clearFilters = () => {
    setSeverity("");
    setEventType("");
    setActorRole("");
    setActorUserId("");
    setDateFrom("");
    setDateTo("");
    setTimeout(() => void loadLogs(), 0);
  };

  return (
    <Layout title="Log Audit Keamanan" eyebrow="Panel Admin">
      {!isReady ? (
        <section className="content-panel"><p className="lead">Memeriksa sesi...</p></section>
      ) : !session || !snapshot || !canAuditLogs ? (
        <section className="content-panel"><h2>Akses Ditolak</h2></section>
      ) : (
        <div className="flex flex-col gap-8">
          <section className="hero-grid">
            <div className="content-panel">
              <div className="panel-header">
                <span className="panel-tag">Filter Audit</span>
                <h2>Pencarian Riwayat Aktivitas</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <div className="field-group">
                  <label htmlFor="filter-severity">Tingkat Bahaya (Severity)</label>
                  <select id="filter-severity" className="text-input select-input" value={severity} onChange={e => setSeverity(e.target.value as any)} aria-label="Filter berdasarkan severity">
                    <option value="">Semua</option>
                    <option value="INFO">INFO (Informasi)</option>
                    <option value="WARN">WARN (Peringatan)</option>
                    <option value="ERROR">ERROR (Bahaya)</option>
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="filter-role">Peran Aktor</label>
                  <select id="filter-role" className="text-input select-input" value={actorRole} onChange={e => setActorRole(e.target.value)} aria-label="Filter berdasarkan role aktor">
                    <option value="">Semua Peran</option>
                    <option value="admin">Administrator</option>
                    <option value="teacher">Guru</option>
                    <option value="homeroom">Wali Kelas</option>
                    <option value="student">Siswa</option>
                    <option value="system">Sistem</option>
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="filter-user">Pengguna Spesifik</label>
                  <select id="filter-user" className="text-input select-input" value={actorUserId} onChange={e => setActorUserId(e.target.value)} aria-label="Filter berdasarkan aktor spesifik">
                    <option value="">Semua Pengguna</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="filter-date-from">Mulai Tanggal</label>
                  <input id="filter-date-from" type="date" className="text-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} aria-label="Filter mulai tanggal" />
                </div>
                <div className="field-group">
                  <label htmlFor="filter-date-to">Sampai Tanggal</label>
                  <input id="filter-date-to" type="date" className="text-input" value={dateTo} onChange={e => setDateTo(e.target.value)} aria-label="Filter sampai tanggal" />
                </div>
                <div className="field-group">
                  <label htmlFor="filter-event">Tipe Aktivitas</label>
                  <input id="filter-event" className="text-input" value={eventType} onChange={e => setEventType(e.target.value)} placeholder="Contoh: auth.login" aria-label="Cari berdasarkan tipe event" />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button isLoading={isLoading} onClick={() => loadLogs(false)}>Terapkan Filter</Button>
                <Button variant="ghost" onClick={clearFilters}>Hapus Filter</Button>
              </div>
              {error && <p className="form-error mt-2">{translateError(error)}</p>}
            </div>

            <div className="signal-panel">
              <span className="signal-label">Ringkasan</span>
              <strong>{total} log</strong>
              <p>Ditemukan berdasarkan filter yang Anda pilih.</p>
            </div>
          </section>

          <section className="content-panel">
            <div className="panel-header">
              <span className="panel-tag">Audit Trail</span>
              <h2>Log Aktivitas Terbaru</h2>
            </div>
            
            {isLoading ? (
              <TableSkeleton cols={4} rows={10} />
            ) : items.length === 0 ? (
              <EmptyState title="Tidak ada log" description="Coba sesuaikan filter pencarian Anda." />
            ) : (
              <div className="activity-list flex flex-col gap-4">
                {items.map((record) => (
                  <article className="activity-card" key={record.id}>
                    <div className="activity-card-header">
                      <div>
                        <span className="status-label">{record.eventType}</span>
                        <h3>{getEventLabel(record.eventType)}</h3>
                      </div>
                      <span className={getSeverityClass(record.severity)}>
                        {getSeverityLabel(record.severity)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mt-2">
                      <p className="container-meta">
                        <strong>Waktu:</strong> {formatDateTime(record.createdAt)}
                      </p>
                      <p className="container-meta">
                        <strong>Aktor:</strong> {readDetail(record, "actorName") ?? record.actorRole} ({record.actorRole})
                      </p>
                      <p className="container-meta">
                        <strong>Route:</strong> {record.routeMethod} {record.routePath}
                      </p>
                      <p className="container-meta">
                        <strong>Status:</strong> {record.statusCode ?? "-"}
                      </p>
                    </div>
                    
                    <details className="detail-panel mt-4">
                      <summary className="text-sm font-bold opacity-70">Detail Teknis</summary>
                      <div className="p-4 bg-surface-strong rounded-xl mt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-muted">Request ID</p>
                            <code className="break-all">{record.requestId || "-"}</code>
                          </div>
                          <div>
                            <p className="text-muted">IP Address</p>
                            <code>{record.ipAddress || "-"}</code>
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-muted text-xs">Data Mentah (Details)</p>
                          <pre className="payload-preview mt-1 text-[10px]">
                            {JSON.stringify(record.details, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  </article>
                ))}
                
                {hasMore && (
                  <div className="flex justify-center py-8">
                    <Button 
                      variant="secondary" 
                      isLoading={isLoadingMore} 
                      onClick={() => loadLogs(true)}
                    >
                      Muat Lebih Banyak
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </Layout>
  );
}
