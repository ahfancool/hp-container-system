import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/router";

import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { getDefaultRoute } from "../lib/navigation";
import { MobileScannerShell } from "../scanner/MobileScannerShell";
import { Card, CardHeader, CardContent } from "../components/ui/Card";

export default function ScanPage() {
  const { isReady, session, snapshot } = useAuth();
  const router = useRouter();
  const canScan = Boolean(snapshot?.permissions.canScan && snapshot.student);

  useEffect(() => {
    if (!isReady || !snapshot || snapshot.appUser.role === "student") {
      return;
    }

    void router.replace(getDefaultRoute(snapshot));
  }, [isReady, router, snapshot]);

  return (
    <Layout title="Scan HP" eyebrow="Area Siswa">
      {canScan && snapshot?.student && session?.access_token ? (
        <MobileScannerShell
          accessToken={session.access_token}
          studentClassName={snapshot.student.className}
          studentId={snapshot.student.id}
          studentName={snapshot.student.name}
          studentNis={snapshot.student.nis}
        />
      ) : (
        <Card className="content-panel">
          <CardHeader>
            <span className="panel-tag">Akses Scan</span>
            <h2>Halaman ini khusus untuk siswa yang sudah terhubung</h2>
          </CardHeader>
          <CardContent>
            <p className="lead compact-lead">
              Login sebagai siswa, lalu pastikan akun tersebut sudah dihubungkan
              ke data siswa oleh admin sekolah.
            </p>
            <div className="button-row compact-button-row">
              <Link className="primary-button" href="/login">
                Buka login
              </Link>
            </div>
            {session && snapshot && !snapshot.student ? (
              <p className="session-meta">
                Sesi Anda sudah aktif, tetapi akun ini belum terhubung ke data siswa.
                Minta admin sekolah untuk menghubungkannya lebih dulu.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
