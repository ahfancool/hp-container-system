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
      <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center">
            {/* Logo Placeholder */}
            <div className="w-20 h-20 bg-accent/10 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-ink text-center">HP Container</h1>
            <p className="mt-2 text-sm text-muted text-center">Sistem Manajemen Penyimpanan Sekolah</p>
          </div>

          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <span className="panel-tag">Email dan Password</span>
              <h2>Masuk ke Akun Anda</h2>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 text-center">
              <p className="text-xs font-bold text-accent uppercase mb-1">Siswa</p>
              <p className="text-[10px] text-muted line-clamp-2">Scan & Kelola HP</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs font-bold text-warning uppercase mb-1">Staf</p>
              <p className="text-[10px] text-muted line-clamp-2">Pantau & Beri Izin</p>
            </Card>
          </div>
        </div>
      </div>

      {snapshot ? (
        <Card className="content-panel mt-12">
          <CardHeader>
...
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
