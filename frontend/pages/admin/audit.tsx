import Link from "next/link";
import { useEffect, useState } from "react";

import { Layout } from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { fetchAuditLogs, type AuditLogRecord } from "../../lib/audit";
import { getDefaultRoute } from "../../lib/navigation";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

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
  const [severity, setSeverity] = useState<"" | "INFO" | "WARN" | "ERROR">("");
  const [eventType, setEventType] = useState("");
  const [limit, setLimit] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAuditLogs = Boolean(snapshot?.permissions.canAuditLogs);

  const loadLogs = async () => {
    if (!session?.access_token || !canAuditLogs) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAuditLogs(session.access_token, {
        eventType,
        limit,
        severity
      });

      setItems(result.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat audit log."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [canAuditLogs, session?.access_token]);

  return (
    <Layout title="Audit Log" eyebrow="Milestone 9: Security Layer">
      {!isReady ? (
        <section className="content-panel">
          <p className="lead compact-lead">Memeriksa sesi login admin...</p>
        </section>
      ) : !session || !snapshot ? (
        <section className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Login Dibutuhkan</span>
            <h2>Halaman audit hanya untuk admin</h2>
          </div>
          <p className="lead compact-lead">
            Login menggunakan akun admin untuk membaca log keamanan dan aktivitas sistem.
          </p>
          <div className="button-row compact-button-row">
            <Link className="primary-button" href="/login">
              Buka login
            </Link>
          </div>
        </section>
      ) : !canAuditLogs ? (
        <section className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Akses Ditolak</span>
            <h2>Role saat ini tidak boleh membuka audit log</h2>
          </div>
          <p className="lead compact-lead">
            Audit log dibatasi untuk admin agar data keamanan tidak terekspos ke role lain.
          </p>
          <div className="button-row compact-button-row">
            <Link className="secondary-button" href={getDefaultRoute(snapshot)}>
              Buka halaman utama
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="hero-grid">
            <div className="content-panel">
              <div className="panel-header">
                <span className="panel-tag">Filter Audit</span>
                <h2>Telusuri kejadian keamanan dan aktivitas penting sistem</h2>
              </div>
              <div className="dashboard-filter-grid">
                <label className="field-group">
                  <span>Severity</span>
                  <select
                    className="text-input select-input"
                    onChange={(event) => {
                      const value = event.target.value as "" | "INFO" | "WARN" | "ERROR";
                      setSeverity(value);
                    }}
                    value={severity}
                  >
                    <option value="">Semua severity</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR">ERROR</option>
                  </select>
                </label>
                <label className="field-group">
                  <span>Limit</span>
                  <select
                    className="text-input select-input"
                    onChange={(event) => {
                      setLimit(Number.parseInt(event.target.value, 10));
                    }}
                    value={limit}
                  >
                    <option value="25">25 log</option>
                    <option value="50">50 log</option>
                    <option value="100">100 log</option>
                  </select>
                </label>
              </div>
              <label className="field-group">
                <span>Event type</span>
                <input
                  className="text-input"
                  onChange={(event) => {
                    setEventType(event.target.value);
                  }}
                  placeholder="Contoh: security.rate_limit_blocked"
                  type="text"
                  value={eventType}
                />
              </label>
              <div className="scanner-controls">
                <button
                  className="primary-button"
                  disabled={isLoading}
                  onClick={() => {
                    void loadLogs();
                  }}
                  type="button"
                >
                  {isLoading ? "Memuat..." : "Muat audit log"}
                </button>
              </div>
              {error ? <p className="form-error">{error}</p> : null}
            </div>

            <div className="signal-panel">
              <span className="signal-label">Ringkasan Audit</span>
              <strong>{items.length} log terbaca</strong>
              <p>
                Gunakan halaman ini untuk mengecek kejadian penting seperti
                transaksi, approval, akses yang ditolak, dan peringatan keamanan.
              </p>
            </div>
          </section>

          <section className="content-panel">
            <div className="panel-header">
              <span className="panel-tag">Log Terbaru</span>
              <h2>Urutan terbaru dari audit trail sistem</h2>
            </div>
            {items.length === 0 ? (
              <p className="lead compact-lead">
                Belum ada log yang cocok dengan filter saat ini.
              </p>
            ) : (
              <div className="activity-list">
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
                    <p className="container-meta">
                      {formatDateTime(record.createdAt)} | Aktor{" "}
                      {readDetail(record, "actorName") ?? record.actorRole}
                    </p>
                    <p className="container-meta">
                      {record.routeMethod} {record.routePath} | status{" "}
                      {record.statusCode ?? "-"}
                    </p>
                    {record.requestId || record.ipAddress ? (
                      <p className="container-meta">
                        {record.requestId ? `Request ID ${record.requestId}` : "-"}
                        {record.ipAddress ? ` | IP ${record.ipAddress}` : ""}
                      </p>
                    ) : null}
                    {(record.studentId || record.containerId) ? (
                      <p className="container-meta">
                        {record.studentId ? `Siswa ${record.studentId}` : ""}
                        {record.studentId && record.containerId ? " | " : ""}
                        {record.containerId ? `Container ${record.containerId}` : ""}
                      </p>
                    ) : null}
                    <details className="detail-panel">
                      <summary>Lihat detail mentah</summary>
                      <pre className="payload-preview audit-details-preview">
                        {JSON.stringify(record.details, null, 2)}
                      </pre>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
