import { useEffect } from "react";
import { useRouter } from "next/router";

import { Layout } from "../components/Layout";
import { LoginForm } from "../components/LoginForm";
import { RoleBadge } from "../components/RoleBadge";
import { useAuth } from "../context/AuthContext";
import { getDefaultRoute } from "../lib/navigation";

const roleChecklist = [
  {
    description: "Bisa login, membuka halaman scan, dan membaca data miliknya.",
    role: "student" as const
  },
  {
    description: "Bisa melihat dashboard dan nanti memberi izin pembelajaran atau darurat.",
    role: "teacher" as const
  },
  {
    description: "Memiliki akses pengawasan kelas seperti role guru dengan cakupan wali kelas.",
    role: "homeroom" as const
  },
  {
    description: "Memiliki akses administrasi penuh ke data aplikasi.",
    role: "admin" as const
  }
];

export default function LoginPage() {
  const { isReady, refreshSnapshot, snapshot } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady || !snapshot) {
      return;
    }

    void router.replace(getDefaultRoute(snapshot));
  }, [isReady, router, snapshot]);

  return (
    <Layout title="Masuk Sistem" eyebrow="Akses Pengguna">
      <section className="hero-grid">
        <div className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Email dan Password</span>
            <h2>Masuk dengan akun sekolah</h2>
          </div>
          <p className="lead compact-lead">
            Setelah login berhasil, sistem akan langsung mengarahkan kamu ke
            halaman utama sesuai role.
          </p>
          <LoginForm />
        </div>

        <div className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Role Aplikasi</span>
            <h2>Mapping role yang didukung</h2>
          </div>
          <div className="role-checklist">
            {roleChecklist.map((item) => (
              <div className="role-checklist-item" key={item.role}>
                <RoleBadge role={item.role} />
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {snapshot ? (
        <section className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Sesi Aktif</span>
            <h2>Profil yang berhasil dibaca dari backend</h2>
          </div>
          <div className="auth-summary-grid">
            <div className="summary-block">
              <span className="summary-label">Nama</span>
              <strong>{snapshot.appUser.name}</strong>
            </div>
            <div className="summary-block">
              <span className="summary-label">Role</span>
              <strong>{snapshot.appUser.role}</strong>
            </div>
            <div className="summary-block">
              <span className="summary-label">Email</span>
              <strong>{snapshot.appUser.email}</strong>
            </div>
            <div className="summary-block">
              <span className="summary-label">Status student linked</span>
              <strong>{snapshot.student ? "Sudah" : "Belum"}</strong>
            </div>
          </div>
          <p className="session-meta">
            Sesi aktif sedang diarahkan ke halaman utama yang sesuai.
          </p>
          <div className="button-row">
            <button
              className="secondary-button compact-button"
              onClick={() => {
                void refreshSnapshot();
              }}
              type="button"
            >
              Muat ulang profil
            </button>
          </div>
        </section>
      ) : null}
    </Layout>
  );
}
