import React, { useEffect, useState } from "react";
import { Layout } from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { fetchViolations, resolveViolationRequest, type StudentViolation } from "../../lib/violations";
import { toast } from "sonner";
import { CardSkeleton, ListSkeleton } from "../../components/Skeleton";

import { formatDateTime } from "../../lib/format";
import { translateError } from "../../lib/errors";

export default function RedListPage() {
  const { session, snapshot } = useAuth();
  const [violations, setViolations] = useState<StudentViolation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");

  const isStaff = snapshot?.appUser.role === "admin" || snapshot?.appUser.role === "teacher" || snapshot?.appUser.role === "homeroom";

  const loadViolations = async () => {
    if (!session?.access_token || !isStaff) return;
    setIsLoading(true);
    try {
      const data = await fetchViolations(session.access_token, {
        resolved: filter === "all" ? undefined : filter === "resolved"
      });
      setViolations(data);
    } catch (e) {
      toast.error(translateError(e instanceof Error ? e.message : "Gagal memuat daftar pelanggaran"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadViolations();
  }, [session, filter]);

  const handleResolve = async (id: string) => {
    if (!session?.access_token) return;
    try {
      await resolveViolationRequest(session.access_token, id);
      toast.success("Pelanggaran ditandai sebagai selesai");
      loadViolations();
    } catch (e) {
      toast.error(translateError(e instanceof Error ? e.message : "Gagal menyelesaikan pelanggaran"));
    }
  };

  const getPenaltyType = (v: StudentViolation) => {
    return v.resolvedAt ? "Selesai" : "Aktif";
  };

  if (!isStaff) {
    return (
      <Layout title="Akses Ditolak" eyebrow="Pelanggaran & Penalti">
        <section className="content-panel">
          <p className="lead compact-lead">Anda tidak memiliki izin untuk melihat halaman ini.</p>
        </section>
      </Layout>
    );
  }

  return (
    <Layout title="Red List - Kedisiplinan Siswa" eyebrow="Pelanggaran & Penalti">
      <section className="hero-grid">
        <div className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Monitoring Pelanggaran</span>
            <h2>Daftar Hitam & Penyitaan HP</h2>
          </div>
          <p className="lead compact-lead">
            Daftar siswa yang melanggar aturan penggunaan HP (termasuk tidak scan masuk). 
            Penalti otomatis: 1x pelanggaran (24 jam), 2+ pelanggaran (ambil orang tua).
          </p>
          
          <div className="button-row compact-button-row" style={{ marginTop: "20px" }}>
            <button 
              className={filter === "all" ? "primary-button" : "secondary-button"} 
              onClick={() => setFilter("all")}
            >
              Semua
            </button>
            <button 
              className={filter === "pending" ? "primary-button" : "secondary-button"} 
              onClick={() => setFilter("pending")}
            >
              Aktif
            </button>
            <button 
              className={filter === "resolved" ? "primary-button" : "secondary-button"} 
              onClick={() => setFilter("resolved")}
            >
              Selesai
            </button>
          </div>
        </div>

        <div className="signal-panel">
          <span className="signal-label">Pelanggaran Aktif</span>
          <strong>{violations.filter(v => !v.resolvedAt).length}</strong>
          <p>Total penyitaan HP yang saat ini sedang berlangsung.</p>
        </div>
      </section>

      <section className="content-panel fade-in">
        {isLoading ? (
          <ListSkeleton items={5} />
        ) : violations.length === 0 ? (
          <p className="lead compact-lead">Tidak ada catatan pelanggaran untuk filter ini.</p>
        ) : (
          <div className="dashboard-student-list">
            {violations.map((v) => (
              <article key={v.id} className={`student-dashboard-card hover-lift ${!v.resolvedAt ? "border-danger" : ""}`}>
                <div className="student-card-row">
                  <div>
                    <span className="status-label">{v.student?.className}</span>
                    <h3>{v.student?.name}</h3>
                  </div>
                  <span className={`status-badge ${v.resolvedAt ? "status-inside" : "status-danger"}`}>
                    {v.resolvedAt ? "SELESAI" : "PENALTI AKTIF"}
                  </span>
                </div>
                <p className="container-meta">
                  NIS {v.student?.nis} | Jenis: <strong>{v.violationType}</strong>
                </p>
                <p className="container-meta">
                  Waktu: {formatDateTime(v.timestamp)}
                </p>
                
                {!v.resolvedAt && (
                  <div className="button-row" style={{ marginTop: "15px" }}>
                    <button 
                      className="secondary-button compact-button"
                      onClick={() => handleResolve(v.id)}
                    >
                      Tandai Diambil / Selesai
                    </button>
                  </div>
                )}
                
                {v.resolvedAt && (
                  <p className="session-meta" style={{ marginTop: "10px" }}>
                    Diselesaikan pada {formatDateTime(v.resolvedAt)}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      
      <style jsx>{`
        .border-danger {
          border-left: 4px solid var(--complement-deep) !important;
        }
      `}</style>
    </Layout>
  );
}
