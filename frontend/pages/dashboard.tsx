import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { List, type RowComponentProps } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";

import { Layout } from "../components/Layout";
import { CardSkeleton, ListSkeleton } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import { getDefaultRoute } from "../lib/navigation";
import {
  fetchDashboardStatus,
  type DashboardStatusResponse
} from "../lib/dashboard";

type DashboardStudentStatus = DashboardStatusResponse["students"]["inside"][number];
type StudentStatusRowProps = {
  items: DashboardStudentStatus[];
};

const AUTO_REFRESH_MS = 30_000;
const ALL_CLASSES_VALUE = "__ALL_CLASSES__";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function matchesSearch(student: DashboardStudentStatus, query: string): boolean {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    student.name,
    student.nis,
    student.className,
    student.gradeLevel,
    student.major ?? ""
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function filterStudents(
  items: DashboardStudentStatus[],
  selectedClassName: string,
  search: string
): DashboardStudentStatus[] {
  return items.filter((student) => {
    const matchesClass =
      selectedClassName === ALL_CLASSES_VALUE ||
      student.className === selectedClassName;

    return matchesClass && matchesSearch(student, search);
  });
}

function getStatusLabel(status: DashboardStudentStatus["phoneStatus"]): string {
  if (status === "INSIDE") {
    return "Di container";
  }

  if (status === "OUTSIDE") {
    return "Sedang keluar";
  }

  return "Belum scan";
}

function getStatusClass(status: DashboardStudentStatus["phoneStatus"]): string {
  if (status === "INSIDE") {
    return "status-badge status-inside";
  }

  if (status === "OUTSIDE") {
    return "status-badge status-outside";
  }

  return "status-badge status-pending";
}

function getActivityTypeLabel(type: "REGULAR" | "PEMBELAJARAN" | "DARURAT"): string {
  if (type === "PEMBELAJARAN") {
    return "Pembelajaran";
  }

  if (type === "DARURAT") {
    return "Darurat";
  }

  return "Reguler";
}

function getPendingApprovalLabel(type: "PEMBELAJARAN" | "DARURAT"): string {
  return type === "DARURAT" ? "Darurat" : "Pembelajaran";
}

// Memoized row component for stable rendering
function StudentStatusRow({
  index,
  items,
  style
}: RowComponentProps<StudentStatusRowProps>) {
  const student = items[index];

  return (
    <div style={{ ...style, paddingBottom: "14px" }}>
      <article
        className="student-dashboard-card fade-in hover-lift"
        style={{ height: "calc(100% - 14px)", margin: 0 }}
      >
        <div className="student-card-row">
          <div>
            <span className="status-label">{student.className}</span>
            <h3>{student.name}</h3>
          </div>
          <span className={getStatusClass(student.phoneStatus)}>
            {getStatusLabel(student.phoneStatus)}
          </span>
        </div>
        <p className="container-meta">
          NIS {student.nis}
          {student.major ? ` | ${student.major}` : ""}
        </p>
        {student.latestTransaction ? (
          <>
            <p className="container-meta">
              Transaksi terakhir {student.latestTransaction.action}{" "}
              {student.latestTransaction.type} pada{" "}
              {formatDateTime(student.latestTransaction.timestamp)}
            </p>
            <p className="container-meta">
              Container: {student.latestTransaction.containerName ?? "-"}
              {student.latestTransaction.containerLocation
                ? ` | ${student.latestTransaction.containerLocation}`
                : ""}
            </p>
          </>
        ) : (
          <p className="container-meta">
            Belum ada transaksi, jadi status HP siswa belum terbaca.
          </p>
        )}
        {student.pendingApproval ? (
          <div className="approval-inline-card compact-approval-card">
            <span className="summary-label">Approval aktif</span>
            <strong>{getPendingApprovalLabel(student.pendingApproval.type)}</strong>
            <p className="session-meta">
              Menunggu scan di {student.pendingApproval.container.name} sejak{" "}
              {formatDateTime(student.pendingApproval.approvedAt)}.
            </p>
          </div>
        ) : null}
      </article>
    </div>
  );
}

function StudentStatusList({
  emptyMessage,
  items,
  title
}: {
  emptyMessage: string;
  items: DashboardStudentStatus[];
  title: string;
}) {
  return (
    <section className="content-panel">
      <div className="panel-header">
        <span className="panel-tag">Status Siswa</span>
        <h2>{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="lead compact-lead">{emptyMessage}</p>
      ) : (
        <div style={{ height: "600px", minHeight: "600px" }}>
          <AutoSizer
            renderProp={({ height, width }) => {
              if (!height || !width) {
                return null;
              }

              return (
                <List
                  defaultHeight={600}
                  rowComponent={StudentStatusRow}
                  rowCount={items.length}
                  rowHeight={250}
                  rowProps={{ items }}
                  style={{ height, width }}
                />
              );
            }}
          />
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { isReady, session, snapshot } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardStatusResponse | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [selectedClassName, setSelectedClassName] = useState(ALL_CLASSES_VALUE);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (router.query.search) {
      setSearch(router.query.search as string);
    }
  }, [router.query.search]);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canViewDashboard = Boolean(snapshot?.permissions.canViewDashboard);
  const canApprove = Boolean(snapshot?.permissions.canApprove);
  const activeRole = snapshot?.appUser.role ?? null;
  const isAdmin = activeRole === "admin";
  const accessToken = session?.access_token ?? null;

  const loadDashboard = async (mode: "initial" | "refresh" = "refresh") => {
    if (!accessToken || !canViewDashboard) {
      return;
    }

    if (mode === "initial") {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setError(null);

    try {
      const payload = await fetchDashboardStatus(accessToken);
      setDashboard(payload);
      if (mode === "refresh") {
        toast.success("Dashboard diperbarui", { duration: 2000 });
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat dashboard monitoring.";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!accessToken || !canViewDashboard) {
      return;
    }

    void loadDashboard("initial");

    const intervalId = window.setInterval(() => {
      void loadDashboard("refresh");
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accessToken, canViewDashboard]);

  const classOptions = dashboard?.classSummaries.map((item) => item.className) ?? [];
  const insideStudents = dashboard
    ? filterStudents(dashboard.students.inside, selectedClassName, search)
    : [];
  const outsideStudents = dashboard
    ? filterStudents(dashboard.students.outside, selectedClassName, search)
    : [];
  const notScannedStudents = dashboard
    ? filterStudents(dashboard.students.notScanned, selectedClassName, search)
    : [];
  const emergencyStudents = dashboard
    ? filterStudents(dashboard.emergencyReleases, selectedClassName, search)
    : [];
  const filteredClassSummaries =
    dashboard?.classSummaries.filter(
      (item) =>
        selectedClassName === ALL_CLASSES_VALUE || item.className === selectedClassName
    ) ?? [];
  const pendingApprovalStudents = [
    ...insideStudents,
    ...outsideStudents,
    ...notScannedStudents
  ].filter((student) => student.pendingApproval);
  const displayedPendingApprovalCount = pendingApprovalStudents.length;
  const displayedOverrideOutCount = outsideStudents.filter(
    (student) => student.latestTransaction?.type !== "REGULAR"
  ).length;

  const displayedTotalStudents =
    insideStudents.length + outsideStudents.length + notScannedStudents.length;
  const displayedInsideRate =
    displayedTotalStudents === 0
      ? 0
      : Number(((insideStudents.length / displayedTotalStudents) * 100).toFixed(1));

  const heroTitle = isAdmin
    ? "Pantau kondisi HP seluruh sekolah dari satu dashboard."
    : "Pantau status HP siswa dan ambil tindakan cepat saat perlu.";

  const heroLead = isAdmin
    ? "Dashboard ini membantu admin melihat ringkasan sekolah, aktivitas terbaru, dan area yang perlu ditindaklanjuti."
    : "Gunakan dashboard ini untuk melihat status HP siswa, mencari kelas tertentu, dan lanjut ke approval saat diperlukan.";

  return (
    <Layout
      title="Dashboard Monitoring"
      eyebrow="Milestone 7: Monitoring Dashboard"
    >
      {!isReady ? (
        <section className="content-panel">
          <p className="lead compact-lead">Memeriksa sesi login staff...</p>
        </section>
      ) : !session || !snapshot ? (
        <section className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Login Dibutuhkan</span>
            <h2>Dashboard ini hanya untuk teacher, homeroom, atau admin</h2>
          </div>
          <p className="lead compact-lead">
            Login dengan akun staff agar sistem bisa memuat status HP siswa dari
            database transaksi.
          </p>
          <div className="button-row compact-button-row">
            <Link className="primary-button" href="/login">
              Buka login
            </Link>
          </div>
        </section>
      ) : !canViewDashboard ? (
        <section className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Akses Ditolak</span>
            <h2>Role saat ini tidak memiliki akses dashboard</h2>
          </div>
          <p className="lead compact-lead">
            Dashboard monitoring dibatasi untuk `teacher`, `homeroom`, dan `admin`.
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
            <div className="hero-copy">
              <p className="kicker">{isAdmin ? "Dashboard Sekolah" : "Dashboard Guru"}</p>
              <h1>{heroTitle}</h1>
              <p className="lead">{heroLead}</p>
              <div className="button-row">
                <button
                  className="primary-button"
                  disabled={isRefreshing}
                  onClick={() => {
                    void loadDashboard("refresh");
                  }}
                  type="button"
                >
                  {isRefreshing ? "Menyegarkan..." : "Refresh dashboard"}
                </button>
                {isAdmin ? (
                  <Link className="secondary-button" href="/admin/audit">
                    Buka audit
                  </Link>
                ) : (
                  <Link className="secondary-button" href="/teacher/approve">
                    Buka approval
                  </Link>
                )}
              </div>
            </div>
            <div className="signal-panel">
              <span className="signal-label">Ringkasan Sekolah</span>
              <strong>
                {dashboard
                  ? `${dashboard.summary.insideCount} HP masih di container`
                  : "Memuat dashboard"}
              </strong>
              <p>
                {dashboard
                  ? `Terakhir diperbarui ${formatDateTime(dashboard.generatedAt)}. Auto-refresh berjalan tiap 30 detik.`
                  : "Menghubungkan dashboard ke backend monitoring."}
              </p>
              {dashboard ? (
                <>
                  <p className="session-meta">
                    Di luar <strong>{dashboard.summary.outsideCount}</strong> | Belum
                    scan <strong>{dashboard.summary.notScannedCount}</strong> |
                    Approval menunggu <strong>{dashboard.summary.pendingApprovalCount}</strong>
                  </p>
                  <p className="session-meta">
                    Kartu status di bawah mengikuti filter aktif, bukan total sekolah.
                  </p>
                </>
              ) : null}
            </div>
          </section>

          {error ? <p className="form-error">{error}</p> : null}

          {isLoading && !dashboard ? (
            <div className="card-grid" style={{ marginTop: "32px" }}>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <div style={{ gridColumn: "1 / -1" }}>
                <ListSkeleton items={3} />
              </div>
            </div>
          ) : dashboard ? (
            <>
              <section className="card-grid">
                <article className="status-card fade-in hover-lift">
                  <span className="panel-tag">HP Di Container</span>
                  <strong className="status-value">{insideStudents.length}</strong>
                  <p className="status-detail">
                    Siswa yang transaksi terakhirnya `IN`.
                  </p>
                </article>
                <article className="status-card fade-in hover-lift">
                  <span className="panel-tag">HP Di Luar</span>
                  <strong className="status-value">{outsideStudents.length}</strong>
                  <p className="status-detail">
                    Siswa yang transaksi terakhirnya `OUT`.
                  </p>
                </article>
                <article className="status-card fade-in hover-lift">
                  <span className="panel-tag">Approval Menunggu</span>
                  <strong className="status-value">{displayedPendingApprovalCount}</strong>
                  <p className="status-detail">
                    Izin guru aktif yang belum dipakai scan siswa pada tampilan ini.
                  </p>
                </article>
                <article className="status-card fade-in hover-lift">
                  <span className="panel-tag">Belum Scan</span>
                  <strong className="status-value">{notScannedStudents.length}</strong>
                  <p className="status-detail">
                    Siswa yang belum memiliki histori transaksi.
                  </p>
                </article>
                <article className="status-card fade-in hover-lift">
                  <span className="panel-tag">Darurat Aktif</span>
                  <strong className="status-value">{emergencyStudents.length}</strong>
                  <p className="status-detail">
                    HP yang masih berada di luar dengan tipe `DARURAT`.
                  </p>
                </article>
                <article className="status-card fade-in hover-lift">
                  <span className="panel-tag">Override Keluar</span>
                  <strong className="status-value">{displayedOverrideOutCount}</strong>
                  <p className="status-detail">
                    Total HP di luar yang keluar lewat jalur override.
                  </p>
                </article>
                <article className="status-card fade-in hover-lift">
                  <span className="panel-tag">Inside Rate</span>
                  <strong className="status-value">{displayedInsideRate}%</strong>
                  <p className="status-detail">
                    Persentase HP yang masih berada di container untuk tampilan
                    filter saat ini.
                  </p>
                </article>
              </section>

              <section className="content-panel">
                <div className="panel-header">
                  <span className="panel-tag">Filter Tampilan</span>
                  <h2>Fokus ke kelas tertentu atau cari siswa tertentu</h2>
                </div>
                <div className="dashboard-filter-grid">
                  <label className="field-group">
                    <span>Filter kelas</span>
                    <select
                      className="text-input select-input"
                      onChange={(event) => {
                        setSelectedClassName(event.target.value);
                      }}
                      value={selectedClassName}
                    >
                      <option value={ALL_CLASSES_VALUE}>Semua kelas</option>
                      {classOptions.map((className) => (
                        <option key={className} value={className}>
                          {className}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-group">
                    <span>Cari siswa</span>
                    <input
                      className="text-input"
                      onChange={(event) => {
                        setSearch(event.target.value);
                      }}
                      placeholder="Nama, NIS, jurusan, atau kelas"
                      type="text"
                      value={search}
                    />
                  </label>
                </div>
                <p className="session-meta">
                  Menampilkan <strong>{displayedTotalStudents}</strong> siswa dari
                  total <strong>{dashboard.summary.totalStudents}</strong> siswa aktif.
                  Approval aktif pada tampilan ini{" "}
                  <strong>{displayedPendingApprovalCount}</strong>.
                </p>
              </section>

              {pendingApprovalStudents.length > 0 ? (
                <section className="content-panel">
                  <div className="panel-header">
                    <span className="panel-tag">Menunggu Scan</span>
                    <h2>Approval aktif yang belum dipakai siswa</h2>
                  </div>
                  <div className="container-grid">
                    {pendingApprovalStudents.map((student) => (
                      <article
                        className="container-card"
                        key={student.pendingApproval?.id ?? student.id}
                      >
                        <div className="student-card-row">
                          <div>
                            <span className="status-label">{student.className}</span>
                            <h3>{student.name}</h3>
                          </div>
                          <span className="status-badge status-pending">
                            {student.pendingApproval
                              ? getPendingApprovalLabel(student.pendingApproval.type)
                              : "Menunggu"}
                          </span>
                        </div>
                        <p className="container-meta">NIS {student.nis}</p>
                        <p className="container-meta">
                          Container: {student.pendingApproval?.container.name} |{" "}
                          {student.pendingApproval?.container.location}
                        </p>
                        <p className="container-meta">
                          Aktif sejak{" "}
                          {student.pendingApproval
                            ? formatDateTime(student.pendingApproval.approvedAt)
                            : "-"}{" "}
                          oleh {student.pendingApproval?.approvedBy.name ?? "-"}
                        </p>
                      </article>
                    ))}
                  </div>
                  {canApprove ? (
                    <div className="button-row compact-button-row">
                      <Link className="secondary-button" href="/teacher/approve">
                        Kelola approval
                      </Link>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {emergencyStudents.length > 0 ? (
                <section className="content-panel dashboard-alert-panel">
                  <div className="panel-header">
                    <span className="panel-tag">Perlu Perhatian</span>
                    <h2>Ada HP yang masih berada di luar dalam mode darurat</h2>
                  </div>
                  <div className="container-grid">
                    {emergencyStudents.map((student) => (
                      <article className="container-card" key={student.id}>
                        <div className="student-card-row">
                          <div>
                            <span className="status-label">{student.className}</span>
                            <h3>{student.name}</h3>
                          </div>
                          <span className="status-badge status-danger">DARURAT</span>
                        </div>
                        <p className="container-meta">NIS {student.nis}</p>
                        <p className="container-meta">
                          Keluar sejak{" "}
                          {student.latestTransaction
                            ? formatDateTime(student.latestTransaction.timestamp)
                            : "-"}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="content-panel">
                <div className="panel-header">
                  <span className="panel-tag">Ringkasan Per Kelas</span>
                  <h2>Pola penyimpanan HP per rombel yang sedang tampil</h2>
                </div>
                <div className="dashboard-class-grid">
                  {filteredClassSummaries.map((item) => (
                    <article className="summary-block" key={item.className}>
                      <span className="summary-label">{item.className}</span>
                      <strong>{item.totalStudents} siswa</strong>
                      <p className="session-meta">
                        Inside {item.insideCount} | Outside {item.outsideCount} |
                        Belum scan {item.notScannedCount}
                      </p>
                      <p className="session-meta">
                        Darurat aktif {item.emergencyReleaseCount} | Approval
                        menunggu scan {item.pendingApprovalCount}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="content-panel">
                <div className="panel-header">
                  <span className="panel-tag">Kapasitas Container</span>
                  <h2>Perkiraan jumlah HP yang masih berada di tiap container</h2>
                </div>
                <div className="container-grid">
                  {dashboard.containerSummaries.map((container) => (
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
                      <div className="summary-block compact-summary">
                        <span className="summary-label">HP masih di dalam</span>
                        <strong>{container.insideCount}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="dashboard-columns">
                <StudentStatusList
                  emptyMessage="Tidak ada siswa dengan status HP di dalam container untuk filter ini."
                  items={insideStudents}
                  title="Siswa yang HP Masih di Container"
                />
                <StudentStatusList
                  emptyMessage="Tidak ada siswa dengan status HP di luar container untuk filter ini."
                  items={outsideStudents}
                  title="Siswa yang HP Sudah Diambil"
                />
              </section>

              <StudentStatusList
                emptyMessage="Semua siswa pada tampilan ini sudah pernah scan."
                items={notScannedStudents}
                title="Siswa yang Belum Scan"
              />

              <section className="content-panel">
                <div className="panel-header">
                  <div className="activity-header-row">
                    <div>
                      <span className="panel-tag">Aktivitas Terbaru</span>
                      <h2>Riwayat transaksi masuk & keluar</h2>
                    </div>
                    {dashboard.recentActivities && dashboard.recentActivities.length > 5 && (
                      <button
                        className="secondary-button compact-button"
                        onClick={() => {
                          setShowAllActivities(!showAllActivities);
                        }}
                        type="button"
                      >
                        {showAllActivities ? "Ringkas" : `Lihat Semua (${dashboard.recentActivities.length})`}
                      </button>
                    )}
                  </div>
                </div>
                {!dashboard.recentActivities || dashboard.recentActivities.length === 0 ? (
                  <p className="lead compact-lead">
                    Belum ada transaksi terbaru yang bisa ditampilkan.
                  </p>
                ) : (
                  <div className="activity-table">
                    {(showAllActivities
                      ? dashboard.recentActivities
                      : dashboard.recentActivities.slice(0, 5)
                    ).map((activity) => (
                      <article className="activity-row" key={activity.id}>
                        <div className="activity-main-info">
                          <span className={`activity-icon-badge ${activity.action === "IN" ? "is-in" : "is-out"}`}>
                            {activity.action === "IN" ? "↓" : "↑"}
                          </span>
                          <div className="activity-student-info">
                            <strong>{activity.student.name}</strong>
                            <span className="session-meta">
                              {activity.student.className} | NIS {activity.student.nis}
                            </span>
                          </div>
                        </div>
                        <div className="activity-type-info">
                          <span className={`status-badge ${activity.type === "REGULAR" ? "status-inside" : "status-pending"}`}>
                            {activity.action === "IN" ? "Masuk" : "Keluar"} {getActivityTypeLabel(activity.type)}
                          </span>
                          <span className="session-meta">{formatDateTime(activity.timestamp)}</span>
                        </div>
                        <div className="activity-meta-info desktop-only">
                          <span className="session-meta">Container: {activity.container.name}</span>
                          <span className="session-meta">
                            Oleh: {activity.operator ? activity.operator.name : "Mandiri"}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </>
      )}
    </Layout>
  );
}
