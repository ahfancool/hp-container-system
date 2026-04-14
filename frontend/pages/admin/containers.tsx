import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState, type FormEvent } from "react";

import { Layout } from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import {
  createContainerRequest,
  fetchContainers,
  rotateContainerQrTokenRequest,
  type ContainerRecord
} from "../../lib/containers";
import { toast } from "sonner";
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

function buildQrFilename(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "container"}-qr.png`;
}

function ContainerQrPreview({
  container,
  onCopy,
  onRotateToken
}: {
  container: ContainerRecord;
  onCopy: (container: ContainerRecord) => void;
  onRotateToken: (container: ContainerRecord) => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void QRCode.toDataURL(container.qrCode, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 8,
      width: 240
    })
      .then((nextDataUrl: string) => {
        if (!isActive) {
          return;
        }

        setDataUrl(nextDataUrl);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setDataUrl(null);
      });

    return () => {
      isActive = false;
    };
  }, [container.qrCode]);

  return (
    <div className="container-qr-shell">
      {dataUrl ? (
        <img
          alt={`QR ${container.name}`}
          className="container-qr-image"
          src={dataUrl}
        />
      ) : (
        <div className="container-qr-placeholder">
          <span className="summary-label">QR sedang disiapkan</span>
          <strong>{container.name}</strong>
        </div>
      )}
      <div className="container-qr-actions">
        <button
          className="secondary-button compact-button"
          onClick={() => {
            if (confirm(`Reset token QR untuk ${container.name}? QR lama tidak akan bisa dipakai lagi.`)) {
              onRotateToken(container);
            }
          }}
          type="button"
        >
          Reset Token QR
        </button>
        <button
          className="secondary-button compact-button"
          onClick={() => {
            onCopy(container);
          }}
          type="button"
        >
          Salin payload
        </button>
        {dataUrl ? (
          <a
            className="secondary-button compact-button"
            download={buildQrFilename(container.name)}
            href={dataUrl}
          >
            Unduh QR
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminContainersPage() {
  const { isReady, session, snapshot } = useAuth();
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = snapshot?.appUser.role === "admin";

  const loadContainers = async () => {
    if (!session?.access_token || !isAdmin) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const items = await fetchContainers(session.access_token, true);
      setContainers(items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat daftar container."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadContainers();
  }, [isAdmin, session?.access_token]);

  const handleCopyPayload = async (container: ContainerRecord) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setError("Browser tidak mendukung fitur salin otomatis.");
      return;
    }

    try {
      await navigator.clipboard.writeText(container.qrCode);
      setError(null);
      setMessage(`Payload ${container.name} berhasil disalin.`);
    } catch {
      setError("Gagal menyalin payload container. Silakan salin manual.");
    }
  };

  const handleRotateToken = async (container: ContainerRecord) => {
    if (!session?.access_token) return;

    try {
      const updated = await rotateContainerQrTokenRequest(
        session.access_token,
        container.id
      );
      setContainers((current) =>
        current.map((c) => (c.id === updated.id ? updated : c))
      );
      toast.success(`Token QR untuk ${container.name} berhasil di-reset`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal me-reset token QR");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.access_token) {
      setError("Sesi login tidak tersedia.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const created = await createContainerRequest(session.access_token, {
        location,
        name
      });

      setContainers((current) => [created, ...current]);
      setName("");
      setLocation("");
      setMessage(
        `Container ${created.name} berhasil dibuat. QR siap ditampilkan, diunduh, atau dibagikan ke operator.`
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal membuat container."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout
      title="Manajemen Container"
      eyebrow="Milestone 3: Container Management"
    >
      {!isReady ? (
        <section className="content-panel">
          <p className="lead compact-lead">Memeriksa sesi login admin...</p>
        </section>
      ) : !session || !snapshot ? (
        <section className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Login Dibutuhkan</span>
            <h2>Halaman ini hanya untuk admin</h2>
          </div>
          <p className="lead compact-lead">
            Login terlebih dahulu dengan akun admin agar bisa membuat dan
            memonitor container.
          </p>
          <div className="button-row compact-button-row">
            <Link className="primary-button" href="/login">
              Buka login
            </Link>
          </div>
        </section>
      ) : !isAdmin ? (
        <section className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Akses Ditolak</span>
            <h2>Role saat ini tidak memiliki hak membuat container</h2>
          </div>
          <p className="lead compact-lead">
            Role `{snapshot.appUser.role}` boleh melihat bagian tertentu dari
            sistem, tetapi pembuatan container dibatasi khusus untuk admin.
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
                <span className="panel-tag">Tambah Container</span>
                <h2>Buat container baru untuk lokasi penyimpanan HP</h2>
              </div>
              <p className="lead compact-lead">
                Admin cukup mengisi nama dan lokasi. Sistem akan otomatis
                menyiapkan kode QR container yang siap dipakai saat scan siswa,
                termasuk preview visual untuk diunduh atau dibagikan ke operator.
              </p>

              <form className="auth-form" onSubmit={handleSubmit}>
                <label className="field-group">
                  <span>Nama container</span>
                  <input
                    className="text-input"
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
                    placeholder="Contoh: Container Laboratorium"
                    required
                    type="text"
                    value={name}
                  />
                </label>

                <label className="field-group">
                  <span>Lokasi</span>
                  <input
                    className="text-input"
                    onChange={(event) => {
                      setLocation(event.target.value);
                    }}
                    placeholder="Contoh: Ruang Tata Tertib"
                    required
                    type="text"
                    value={location}
                  />
                </label>

                <button
                  className="primary-button form-button"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Menyimpan..." : "Buat container"}
                </button>

                {message ? <p className="form-success">{message}</p> : null}
                {error ? <p className="form-error">{error}</p> : null}
              </form>
            </div>

            <div className="signal-panel">
              <span className="signal-label">Ringkasan Container</span>
              <strong>{containers.length}</strong>
              <p>
                Total container aktif dan nonaktif yang saat ini tercatat di sistem.
              </p>
              <p className="session-meta">
                QR aktif siap ditampilkan ulang tanpa perlu generator eksternal.
              </p>
              <button
                className="secondary-button compact-button"
                disabled={isLoading}
                onClick={() => {
                  void loadContainers();
                }}
                type="button"
              >
                {isLoading ? "Memuat..." : "Muat ulang daftar"}
              </button>
            </div>
          </section>

          <section className="content-panel">
            <div className="panel-header">
              <span className="panel-tag">Daftar Container</span>
              <h2>Registry container yang tersimpan di database</h2>
            </div>

            {containers.length === 0 ? (
              <p className="lead compact-lead">
                Belum ada container yang tampil. Buat container pertama dari
                form di atas.
              </p>
            ) : (
              <div className="container-grid">
                {containers.map((container) => (
                  <article className="container-card" key={container.id}>
                    <div className="container-card-header">
                      <div>
                        <span className="status-label">Container</span>
                        <h3>{container.name}</h3>
                      </div>
                      <span className="role-badge">
                        {container.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <p className="container-meta">{container.location}</p>
                    <ContainerQrPreview
                      container={container}
                      onCopy={handleCopyPayload}
                      onRotateToken={handleRotateToken}
                    />
                    <div className="qr-payload-block">
                      <span className="summary-label">Payload QR container</span>
                      <code>{container.qrCode}</code>
                    </div>
                    <details className="detail-panel">
                      <summary>Lihat detail teknis</summary>
                      <div className="container-meta-grid">
                        <div>
                          <span className="summary-label">Container ID</span>
                          <strong>{container.id}</strong>
                        </div>
                        <div>
                          <span className="summary-label">Dibuat</span>
                          <strong>{formatDateTime(container.createdAt)}</strong>
                        </div>
                      </div>
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
