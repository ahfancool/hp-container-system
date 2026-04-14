import Link from "next/link";

import { Layout } from "../components/Layout";
import { RoleBadge } from "../components/RoleBadge";
import { useAuth } from "../context/AuthContext";
import { getDefaultRoute } from "../lib/navigation";

type QuickAction = {
  description: string;
  href: string;
  label: string;
};

function getQuickActions(): QuickAction[] {
  return [
    {
      description: "Masuk dengan akun sekolah untuk membuka fitur sesuai peran.",
      href: "/login",
      label: "Masuk"
    }
  ];
}

function getRoleQuickActions(role: "student" | "teacher" | "homeroom" | "admin"): QuickAction[] {
  if (role === "student") {
    return [
      {
        description: "Buka kamera lalu scan QR container untuk menyimpan atau mengambil HP.",
        href: "/scan",
        label: "Buka scan"
      }
    ];
  }

  if (role === "teacher" || role === "homeroom") {
    return [
      {
        description: "Pantau status HP siswa dari dashboard kelas.",
        href: "/dashboard",
        label: "Buka dashboard"
      },
      {
        description: "Berikan izin pengambilan HP untuk pembelajaran atau keadaan darurat.",
        href: "/teacher/approve",
        label: "Buka approval"
      }
    ];
  }

  return [
    {
      description: "Lihat ringkasan status HP dan aktivitas terbaru sekolah.",
      href: "/dashboard",
      label: "Buka dashboard"
    },
    {
      description: "Kelola daftar container dan QR yang dipakai di sekolah.",
      href: "/admin/containers",
      label: "Kelola container"
    },
    {
      description: "Pantau jejak audit untuk keamanan dan perubahan penting.",
      href: "/admin/audit",
      label: "Buka audit"
    }
  ];
}

export default function HomePage() {
  const { error, isLoading, snapshot } = useAuth();

  const primaryRoute = getDefaultRoute(snapshot);
  const quickActions = snapshot
    ? getRoleQuickActions(snapshot.appUser.role)
    : getQuickActions();

  const heading = snapshot
    ? snapshot.appUser.role === "student"
      ? "Siap scan HP dengan satu langkah yang lebih cepat."
      : snapshot.appUser.role === "admin"
        ? "Panel utama admin untuk memantau dan mengelola sistem."
        : "Pantau status HP siswa dan kelola approval dari satu tempat."
    : "Sistem penyimpanan HP sekolah yang lebih jelas untuk tiap peran.";

  const lead = snapshot
    ? snapshot.appUser.role === "student"
      ? "Halaman scan sekarang jadi titik utama untuk siswa. Buka kamera, arahkan ke QR container, lalu status HP akan diperbarui otomatis."
      : snapshot.appUser.role === "admin"
        ? "Gunakan dashboard untuk memantau kondisi harian, container untuk pengelolaan perangkat fisik, dan audit untuk jejak keamanan."
        : "Gunakan dashboard untuk memantau kelas dan halaman approval untuk kebutuhan pembelajaran atau kondisi darurat."
    : "Login dengan akun sekolah, lalu sistem akan menampilkan menu dan halaman yang relevan sesuai peran pengguna.";

  return (
    <Layout title="Sistem HP Sekolah" eyebrow="Beranda">
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="kicker">Operasional Harian</p>
          <h1>{heading}</h1>
          <p className="lead">{lead}</p>
          <div className="button-row">
            <Link className="primary-button" href={primaryRoute}>
              {snapshot ? "Buka halaman utama" : "Masuk sekarang"}
            </Link>
            {snapshot && quickActions[1] ? (
              <Link className="secondary-button" href={quickActions[1].href}>
                {quickActions[1].label}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="signal-panel">
          <span className="signal-label">Status akun</span>
          <strong>{snapshot ? "Aktif" : "Belum login"}</strong>
          <p>
            {snapshot
              ? `Akun ${snapshot.appUser.name} sedang masuk dan melihat fitur untuk role ${snapshot.appUser.role}.`
              : "Silakan masuk terlebih dahulu agar menu dan halaman menyesuaikan peran pengguna."}
          </p>
          {snapshot ? <RoleBadge role={snapshot.appUser.role} /> : null}
          {snapshot?.student ? (
            <p className="session-meta">
              Siswa terhubung: <strong>{snapshot.student.name}</strong> | NIS{" "}
              <strong>{snapshot.student.nis}</strong>
            </p>
          ) : null}
        </div>
      </section>

      <section className="content-panel">
        <div className="panel-header">
          <span className="panel-tag">Aksi Cepat</span>
          <h2>Yang bisa dilakukan sekarang</h2>
        </div>
        <div className="container-grid">
          {quickActions.map((item) => (
            <article className="container-card" key={item.href}>
              <h3>{item.label}</h3>
              <p className="container-meta">{item.description}</p>
              <Link className="secondary-button compact-button" href={item.href}>
                Buka
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="content-panel">
        <div className="panel-header">
          <span className="panel-tag">Panduan Singkat</span>
          <h2>Alur yang disederhanakan untuk pengguna sekolah</h2>
        </div>
        {!snapshot ? (
          <p className="lead compact-lead">
            Setelah login, siswa akan diarahkan ke halaman scan. Guru dan wali kelas
            diarahkan ke dashboard. Admin diarahkan ke dashboard admin.
          </p>
        ) : snapshot.appUser.role === "student" ? (
          <p className="lead compact-lead">
            Arahkan kamera ke QR container. Saat QR terbaca, sistem langsung
            menyimpan transaksi yang sesuai tanpa langkah validasi tambahan.
          </p>
        ) : snapshot.appUser.role === "admin" ? (
          <p className="lead compact-lead">
            Gunakan dashboard sebagai titik pantau utama. Jika perlu, lanjut ke
            halaman container atau audit dari menu atas.
          </p>
        ) : (
          <p className="lead compact-lead">
            Gunakan dashboard untuk memantau status HP, lalu buka halaman approval
            saat ada kebutuhan pembelajaran atau kondisi darurat.
          </p>
        )}
        {error ? <p className="form-error">{error}</p> : null}
        {isLoading ? (
          <p className="session-meta">Sinkronisasi sesi sedang berjalan...</p>
        ) : null}
      </section>
    </Layout>
  );
}
