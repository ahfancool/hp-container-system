import { useEffect } from "react";
import { useRouter } from "next/router";

import { Layout } from "../components/Layout";
import { LoginForm } from "../components/LoginForm";
import { RoleBadge } from "../components/RoleBadge";
import { useAuth } from "../context/AuthContext";
import { getDefaultRoute } from "../lib/navigation";
import { Card, CardHeader, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

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

    const redirectPath = (router.query.redirect as string) || getDefaultRoute(snapshot);
    void router.replace(redirectPath);
  }, [isReady, router, snapshot]);

  return (
    <Layout title="Masuk Sistem" eyebrow="Akses Pengguna">
      <section className="login-shell">
        <div className="login-panel">
          <div className="login-hero">
            <div className="login-mark" aria-hidden="true">
              <svg className="login-mark-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="kicker">Akses Aman</p>
              <h1>HP Container</h1>
            </div>
            <p className="lead compact-lead">
              Masuk dengan akun sekolah untuk membuka scan siswa, monitoring guru,
              dan kontrol admin dari satu sistem yang rapi di desktop maupun mobile.
            </p>
            <div className="role-checklist login-role-grid">
              {roleChecklist.map((item) => (
                <Card className="role-checklist-item" key={item.role}>
                  <RoleBadge role={item.role} />
                  <p>{item.description}</p>
                </Card>
              ))}
            </div>
          </div>

          <Card className="content-panel login-form-panel shadow-xl">
            <CardHeader className="text-center">
              <span className="panel-tag">Email dan Password</span>
              <h2>Masuk ke Akun Anda</h2>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </section>

      {snapshot ? (
        <Card className="content-panel login-session-panel">
          <CardHeader>
            <span className="panel-tag">Sesi Aktif</span>
            <h2>Profil yang berhasil dibaca dari backend</h2>
          </CardHeader>
          <CardContent>
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void refreshSnapshot();
                }}
              >
                Muat ulang profil
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </Layout>
  );
}
