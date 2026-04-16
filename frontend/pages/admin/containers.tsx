import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState, type FormEvent, useRef } from "react";

import { Layout } from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import {
  createContainerRequest,
  fetchContainers,
  rotateContainerQrTokenRequest,
  type ContainerRecord
} from "../../lib/containers";
import { showToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Skeleton, TableSkeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { getDefaultRoute } from "../../lib/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { downloadQrAsPng, downloadQrAsSvg } from "../../lib/qr-utils";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function buildQrFilename(name: string, ext: "png" | "svg"): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "container"}-qr.${ext}`;
}

function MiniQrPreview({ qrCode }: { qrCode: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(qrCode, { margin: 1, width: 40 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [qrCode]);

  return dataUrl ? (
    <img alt="QR Preview" src={dataUrl} className="w-10 h-10 rounded border border-line" />
  ) : (
    <div className="w-10 h-10 bg-surface-strong rounded border border-line" />
  );
}

interface EditableCellProps {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
}

function EditableCell({ value, onSave, className = "" }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSave(editValue);
      setIsEditing(false);
    } else if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className="text-input compact-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          onSave(editValue);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <div 
      className={`cursor-pointer hover:bg-surface-strong px-2 py-1 rounded transition-colors ${className}`}
      onDoubleClick={() => setIsEditing(true)}
      title="Double click to edit"
    >
      {value}
    </div>
  );
}

export default function AdminContainersPage() {
  const { isReady, session, snapshot } = useAuth();
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [deleteTarget, setDeleteTarget] = useState<ContainerRecord | null>(null);
  const [qrTarget, setQrTarget] = useState<ContainerRecord | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);

  const isAdmin = snapshot?.appUser.role === "admin";
  const supabase = getSupabaseBrowserClient();

  const {
    values,
    errors,
    touched,
    isSubmitting: isSubmittingForm,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
  } = useForm(
    { name: "", location: "" },
    {
      name: { required: true, min: 3 },
      location: { required: true, min: 3 },
    },
    async (formValues) => {
      if (!session?.access_token) return;
      setError(null);
      try {
        const created = await createContainerRequest(session.access_token, { 
          location: formValues.location, 
          name: formValues.name 
        });
        setContainers((current) => [created, ...current]);
        resetForm();
        showToast.success(`Container ${created.name} berhasil dibuat`);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Gagal membuat container.");
        throw submitError;
      }
    }
  );

  useUnsavedChanges(isDirty);

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
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat daftar container.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadContainers();
  }, [isAdmin, session?.access_token]);

  useEffect(() => {
    if (qrTarget) {
      QRCode.toDataURL(qrTarget.qrCode, { margin: 1, width: 300 })
        .then(setQrPreviewUrl)
        .catch(() => setQrPreviewUrl(null));
    } else {
      setQrPreviewUrl(null);
    }
  }, [qrTarget]);

  const handleUpdate = async (id: string, updates: Partial<ContainerRecord>) => {
    try {
      const { error: updateError } = await supabase
        .from("containers")
        .update({
          name: updates.name,
          location: updates.location,
          is_active: updates.isActive
        })
        .eq("id", id);

      if (updateError) throw updateError;

      setContainers(current => current.map(c => c.id === id ? { ...c, ...updates } : c));
      showToast.success("Container berhasil diperbarui");
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "Gagal memperbarui container");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const { error: deleteError } = await supabase
        .from("containers")
        .delete()
        .eq("id", deleteTarget.id);

      if (deleteError) throw deleteError;

      setContainers(current => current.filter(c => c.id !== deleteTarget.id));
      showToast.success(`Container ${deleteTarget.name} berhasil dihapus`);
      setDeleteTarget(null);
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "Gagal menghapus container");
    }
  };

  const handleRotateToken = async (container: ContainerRecord) => {
    if (!session?.access_token) return;

    try {
      const updated = await rotateContainerQrTokenRequest(session.access_token, container.id);
      setContainers((current) => current.map((c) => (c.id === updated.id ? updated : c)));
      showToast.success(`Token QR untuk ${container.name} berhasil di-reset`);
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "Gagal me-reset token QR");
    }
  };

  return (
    <Layout title="Manajemen Container" eyebrow="Admin Panel">
      {!isReady ? (
        <section className="content-panel"><p className="lead">Memeriksa sesi...</p></section>
      ) : !session || !snapshot || !isAdmin ? (
        <section className="content-panel"><h2>Akses Ditolak</h2></section>
      ) : (
        <div className="flex flex-col gap-8">
          <section className="hero-grid">
            <div className="content-panel">
              <div className="panel-header">
                <span className="panel-tag">Tambah Container</span>
                <h2>Buat registry container baru</h2>
              </div>
              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nama container"
                    value={values.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    onBlur={() => handleBlur("name")}
                    error={touched.name ? errors.name : undefined}
                    placeholder="Contoh: Container A"
                    required
                  />
                  <Input
                    label="Lokasi"
                    value={values.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    onBlur={() => handleBlur("location")}
                    error={touched.location ? errors.location : undefined}
                    placeholder="Contoh: Gedung 1"
                    required
                  />
                </div>
                <Button 
                  className="form-button" 
                  isLoading={isSubmittingForm} 
                  type="submit"
                  disabled={!isValid || isSubmittingForm}
                  title={!isValid ? "Harap lengkapi form dengan benar" : ""}
                >
                  Tambah Container
                </Button>
                {error && <p className="form-error">{error}</p>}
              </form>
            </div>

            <div className="signal-panel">
              <span className="signal-label">Registry</span>
              <strong>{containers.length}</strong>
              <p>Container aktif yang terdaftar.</p>
              <Button variant="secondary" size="sm" onClick={loadContainers}>Muat ulang</Button>
            </div>
          </section>

          <section className="content-panel overflow-hidden">
            <div className="panel-header">
              <span className="panel-tag">Daftar Registry</span>
              <h2>Manajemen Container</h2>
            </div>

            {isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : containers.length === 0 ? (
              <EmptyState title="Kosong" description="Belum ada container." />
            ) : (
              <div className="activity-table">
                <div className="activity-row font-bold bg-surface-strong">
                  <div>Nama & Lokasi</div>
                  <div className="text-center">QR & Status</div>
                  <div className="text-right">Aksi</div>
                </div>
                {containers.map((container) => (
                  <div className="activity-row" key={container.id}>
                    <div className="flex flex-col gap-1">
                      <EditableCell 
                        value={container.name} 
                        onSave={(val) => handleUpdate(container.id, { name: val })} 
                        className="font-bold"
                      />
                      <EditableCell 
                        value={container.location} 
                        onSave={(val) => handleUpdate(container.id, { location: val })} 
                        className="text-muted text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <button onClick={() => setQrTarget(container)} className="hover:opacity-80 transition-opacity">
                        <MiniQrPreview qrCode={container.qrCode} />
                      </button>
                      <button 
                        onClick={() => handleUpdate(container.id, { isActive: !container.isActive })}
                        className={`badge ${container.isActive ? "badge-primary" : "badge-outline"}`}
                      >
                        {container.isActive ? "Aktif" : "Nonaktif"}
                      </button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setQrTarget(container)}>QR</Button>
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeleteTarget(container)}>Hapus</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Delete Modal */}
          <Modal
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            title="Konfirmasi Hapus"
            footer={
              <div className="flex gap-3">
                <Button className="flex-1" variant="ghost" onClick={() => setDeleteTarget(null)}>Batal</Button>
                <Button className="flex-1" variant="destructive" onClick={handleDelete}>Hapus</Button>
              </div>
            }
          >
            <p>Anda yakin ingin menghapus container <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.</p>
          </Modal>

          {/* QR Modal */}
          <Modal
            isOpen={!!qrTarget}
            onClose={() => setQrTarget(null)}
            title={`QR Code: ${qrTarget?.name}`}
            footer={
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={() => rotateContainerQrTokenRequest(session!.access_token, qrTarget!.id).then(loadContainers)}>Reset Token</Button>
                <Button variant="secondary" onClick={() => navigator.clipboard.writeText(qrTarget!.qrCode).then(() => showToast.success("Payload disalin"))}>Salin Payload</Button>
                <Button onClick={() => downloadQrAsPng(qrTarget!.qrCode, buildQrFilename(qrTarget!.name, "png"))}>Download PNG</Button>
                <Button onClick={() => downloadQrAsSvg(qrTarget!.qrCode, buildQrFilename(qrTarget!.name, "svg"))}>Download SVG</Button>
              </div>
            }
          >
            <div className="flex flex-col items-center gap-4">
              {qrPreviewUrl && <img src={qrPreviewUrl} alt="QR Big" className="w-64 h-64 border-4 border-surface-strong rounded-2xl" />}
              <div className="text-center">
                <p className="font-bold">{qrTarget?.location}</p>
                <code className="text-xs break-all text-muted">{qrTarget?.qrCode}</code>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </Layout>
  );
}
