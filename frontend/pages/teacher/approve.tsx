import Link from "next/link";
import React, { useDeferredValue, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { List, type RowComponentProps } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";

import { Layout } from "../../components/Layout";
import { CardSkeleton, ListSkeleton } from "../../components/Skeleton";
import { useAuth } from "../../context/AuthContext";
import {
  fetchContainers,
  type ContainerRecord
} from "../../lib/containers";
import {
  fetchStudentsForApproval,
  type StudentApprovalRecord
} from "../../lib/students";
import {
  submitTeacherApproval,
  type TeacherApprovalResponse
} from "../../lib/teacherApproval";
import { getDefaultRoute } from "../../lib/navigation";

type ApprovalType = "PEMBELAJARAN" | "DARURAT";
type VirtualizedGridRowProps = {
  columnCount: number;
  items: StudentApprovalRecord[];
  onToggle: (id: string) => void;
  selectedStudentSet: Set<string>;
};

const ALL_CLASSES = "__ALL_CLASSES__";

const approvalOptions: Array<{
  description: string;
  label: string;
  value: ApprovalType;
}> = [
  {
    description: "Untuk kebutuhan pembelajaran terarah dan penggunaan HP yang diawasi guru.",
    label: "Pembelajaran",
    value: "PEMBELAJARAN"
  },
  {
    description: "Untuk kondisi mendesak yang memerlukan pelepasan HP sebelum waktu reguler.",
    label: "Darurat",
    value: "DARURAT"
  }
];

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function getPhoneStatusLabel(status: StudentApprovalRecord["phoneStatus"]): string {
  if (status === "INSIDE") {
    return "HP di container";
  }

  if (status === "OUTSIDE") {
    return "HP sedang keluar";
  }

  return "Belum ada scan";
}

function getPhoneStatusClass(status: StudentApprovalRecord["phoneStatus"]): string {
  if (status === "INSIDE") {
    return "status-badge status-inside";
  }

  if (status === "OUTSIDE") {
    return "status-badge status-outside";
  }

  return "status-badge status-pending";
}

function getBulkResultClass(
  result: TeacherApprovalResponse["items"][number]["result"]
): string {
  if (result === "created") {
    return "status-badge status-inside";
  }

  if (result === "updated" || result === "replayed") {
    return "status-badge status-outside";
  }

  return "status-badge status-danger";
}

function getBulkResultLabel(
  result: TeacherApprovalResponse["items"][number]["result"]
): string {
  if (result === "created") {
    return "Baru";
  }

  if (result === "updated") {
    return "Diperbarui";
  }

  if (result === "replayed") {
    return "Replay";
  }

  if (result === "skipped_request_conflict") {
    return "Konflik";
  }

  return "Dilewati";
}

function buildStudentSummary(student: StudentApprovalRecord): string {
  if (student.pendingApproval) {
    return `Approval ${student.pendingApproval.type} aktif pada ${formatDateTime(student.pendingApproval.approvedAt)} untuk ${student.pendingApproval.container.name}. Menunggu siswa scan untuk menyelesaikan transaksi keluar.`;
  }

  if (!student.latestTransaction) {
    return "Belum ada transaksi sebelumnya. Override belum bisa dipakai sebelum HP pernah masuk ke container.";
  }

  if (student.latestTransaction.action === "IN") {
    return `Transaksi terakhir ${student.latestTransaction.type} pada ${formatDateTime(student.latestTransaction.timestamp)}. Siswa siap untuk approval keluar.`;
  }

  return `Transaksi terakhir ${student.latestTransaction.type} pada ${formatDateTime(student.latestTransaction.timestamp)}. HP sedang berada di luar, jadi aksi berikutnya seharusnya IN.`;
}

// Memoized individual student card for performance
const StudentOptionCard = React.memo(({ 
  student, 
  isSelected, 
  onToggle 
}: { 
  student: StudentApprovalRecord; 
  isSelected: boolean; 
  onToggle: (id: string) => void;
}) => {
  const isSelectable = student.readyForTeacherOverride;

  return (
    <button
      className={[
        "student-option-card",
        "fade-in",
        "hover-lift",
        isSelected ? "is-selected" : "",
        !isSelectable ? "is-disabled" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={!isSelectable}
      onClick={() => onToggle(student.id)}
      type="button"
      style={{ height: "100%", width: "100%" }}
    >
      <div className="student-card-row">
        <div>
          <span className="status-label">{student.className}</span>
          <h3>{student.name}</h3>
        </div>
        <div className="student-card-statuses">
          {isSelected ? (
            <span className="status-badge status-outside">Dipilih</span>
          ) : null}
          <span className={getPhoneStatusClass(student.phoneStatus)}>
            {getPhoneStatusLabel(student.phoneStatus)}
          </span>
        </div>
      </div>
      <p className="container-meta">
        NIS {student.nis}
        {student.major ? ` | ${student.major}` : ""}
      </p>
      <p className="container-meta">{buildStudentSummary(student)}</p>
      <div className="container-meta-grid">
        <div>
          <span className="summary-label">Aksi berikutnya</span>
          <strong>{student.nextExpectedAction}</strong>
        </div>
        <div>
          <span className="summary-label">Status approval</span>
          <strong>
            {student.pendingApproval
              ? "Menunggu scan"
              : student.readyForTeacherOverride
                ? "Siap dipilih"
                : "Belum siap"}
          </strong>
        </div>
      </div>
    </button>
  );
});

// Row component that renders multiple columns
function VirtualizedGridRow({
  columnCount,
  index,
  items,
  onToggle,
  selectedStudentSet,
  style
}: RowComponentProps<VirtualizedGridRowProps>) {
  const startIndex = index * columnCount;
  const rowItems = items.slice(startIndex, startIndex + columnCount);

  return (
    <div style={{ ...style, display: "flex", gap: "16px", paddingBottom: "16px", boxSizing: "border-box" }}>
      {rowItems.map((student: StudentApprovalRecord) => (
        <div key={student.id} style={{ flex: `1 0 calc(${100 / columnCount}% - 16px)`, maxWidth: `calc(${100 / columnCount}% - 12px)` }}>
          <StudentOptionCard 
            student={student}
            isSelected={selectedStudentSet.has(student.id)}
            onToggle={onToggle}
          />
        </div>
      ))}
      {/* Fill empty spaces in the last row to maintain grid alignment */}
      {rowItems.length < columnCount && Array.from({ length: columnCount - rowItems.length }).map((_, i) => (
        <div key={`empty-${i}`} style={{ flex: `1 0 calc(${100 / columnCount}% - 16px)` }} />
      ))}
    </div>
  );
}

export default function TeacherApprovePage() {
  const { isReady, session, snapshot } = useAuth();
  const [students, setStudents] = useState<StudentApprovalRecord[]>([]);
  const [containers, setContainers] = useState<ContainerRecord[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState("");
  const [selectedClassName, setSelectedClassName] = useState(ALL_CLASSES);
  const [approvalType, setApprovalType] = useState<ApprovalType>("PEMBELAJARAN");
  const [search, setSearch] = useState("");
  const [onlyReady, setOnlyReady] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalResult, setApprovalResult] =
    useState<TeacherApprovalResponse | null>(null);

  const canApprove = Boolean(snapshot?.permissions.canApprove);
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const selectedStudentSet = useMemo(() => new Set(selectedStudentIds), [selectedStudentIds]);
  const selectedContainer =
    containers.find((container) => container.id === selectedContainerId) ?? null;
  const pendingApprovalStudents = students.filter((student) => student.pendingApproval);
  const selectedStudents = students.filter((student) =>
    selectedStudentSet.has(student.id)
  );

  const classStats = new Map<
    string,
    {
      readyCount: number;
      totalCount: number;
    }
  >();

  for (const student of students) {
    const current = classStats.get(student.className) ?? {
      readyCount: 0,
      totalCount: 0
    };

    current.totalCount += 1;

    if (student.readyForTeacherOverride) {
      current.readyCount += 1;
    }

    classStats.set(student.className, current);
  }

  const classOptions = Array.from(classStats.entries())
    .sort(([left], [right]) => left.localeCompare(right, "id-ID"))
    .map(([className, stats]) => ({
      className,
      readyCount: stats.readyCount,
      totalCount: stats.totalCount
    }));

  const readyStudentsInClass = students.filter((student) => {
    if (!student.readyForTeacherOverride) {
      return false;
    }

    if (selectedClassName === ALL_CLASSES) {
      return true;
    }

    return student.className === selectedClassName;
  });

  const filteredStudents = students.filter((student) => {
    if (selectedClassName !== ALL_CLASSES && student.className !== selectedClassName) {
      return false;
    }

    if (onlyReady && !student.readyForTeacherOverride) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [student.name, student.nis, student.className, student.major ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  const selectedReadyInClassCount = readyStudentsInClass.filter((student) =>
    selectedStudentSet.has(student.id)
  ).length;
  const selectedClassLabel =
    selectedClassName === ALL_CLASSES ? "Semua kelas" : selectedClassName;

  useEffect(() => {
    const allowedStudentIds = new Set(
      students
        .filter((student) => {
          if (!student.readyForTeacherOverride) {
            return false;
          }

          if (selectedClassName === ALL_CLASSES) {
            return true;
          }

          return student.className === selectedClassName;
        })
        .map((student) => student.id)
    );

    setSelectedStudentIds((current) =>
      current.filter((studentId) => allowedStudentIds.has(studentId))
    );
  }, [selectedClassName, students]);

  const loadPanelData = async () => {
    if (!session?.access_token || !canApprove) {
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [studentItems, containerItems] = await Promise.all([
        fetchStudentsForApproval(session.access_token),
        fetchContainers(session.access_token, false)
      ]);

      setStudents(studentItems);
      setContainers(containerItems);
      setSelectedContainerId((current) => {
        if (containerItems.some((container) => container.id === current)) {
          return current;
        }

        return containerItems[0]?.id ?? "";
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal memuat panel approval guru.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPanelData();
  }, [canApprove, session?.access_token]);

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) => {
      if (current.includes(studentId)) {
        return current.filter((item) => item !== studentId);
      }

      return [...current, studentId];
    });
    setApprovalError(null);
    setApprovalResult(null);
  };

  const handleSelectAllReadyInClass = () => {
    setSelectedStudentIds(readyStudentsInClass.map((student) => student.id));
    setApprovalError(null);
    setApprovalResult(null);
  };

  const handleClearSelection = () => {
    setSelectedStudentIds([]);
    setApprovalError(null);
    setApprovalResult(null);
  };

  const handleApprove = async () => {
    if (!session?.access_token) {
      setApprovalError("Sesi login tidak tersedia.");
      return;
    }

    if (selectedStudentIds.length === 0) {
      setApprovalError("Pilih minimal satu siswa yang siap di-approve.");
      return;
    }

    if (!selectedContainerId) {
      setApprovalError("Pilih container terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);
    setApprovalError(null);

    try {
      const result = await submitTeacherApproval(session.access_token, {
        containerId: selectedContainerId,
        studentIds: selectedStudentIds,
        type: approvalType
      });

      setApprovalResult(result);
      setSelectedStudentIds([]);
      toast.success(`${result.bulk.processedCount} approval berhasil diproses`);
      await loadPanelData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal menyimpan approval guru.";
      setApprovalError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const successfulApprovalItems =
    approvalResult?.items.filter(
      (item) =>
        item.result === "created" ||
        item.result === "updated" ||
        item.result === "replayed"
    ) ?? [];
  const skippedApprovalItems =
    approvalResult?.items.filter(
      (item) =>
        item.result !== "created" &&
        item.result !== "updated" &&
        item.result !== "replayed"
    ) ?? [];

  return (
    <Layout
      title="Panel Approval Guru"
      eyebrow="Milestone 14: Bulk Teacher Approval UI"
    >
      {!isReady ? (
        <section className="content-panel">
          <p className="lead compact-lead">Memeriksa sesi login staff...</p>
        </section>
      ) : !session || !snapshot ? (
        <section className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Login Dibutuhkan</span>
            <h2>Halaman ini hanya untuk teacher, homeroom, atau admin</h2>
          </div>
          <p className="lead compact-lead">
            Login dengan akun staff agar sistem bisa mengaktifkan approval guru
            dan memandu siswa menyelesaikan transaksi keluar lewat halaman scan.
          </p>
          <div className="button-row compact-button-row">
            <Link className="primary-button" href="/login">
              Buka login
            </Link>
          </div>
        </section>
      ) : !canApprove ? (
        <section className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Akses Ditolak</span>
            <h2>Role saat ini tidak memiliki izin approval guru</h2>
          </div>
          <p className="lead compact-lead">
            Role `{snapshot.appUser.role}` tidak termasuk jalur override guru.
            Fitur ini hanya tersedia untuk `teacher`, `homeroom`, dan `admin`.
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
                <span className="panel-tag">Approval Guru</span>
                <h2>Pilih satu kelas lalu aktifkan approval massal</h2>
              </div>
              <p className="lead compact-lead">
                Gunakan filter kelas, pilih banyak siswa yang memang siap
                mengambil HP, lalu kirim satu approval massal. Approval tetap
                tersimpan sebagai izin aktif dan baru dikonsumsi saat siswa scan
                container.
              </p>

              <div className="approval-filter-grid">
                <label className="field-group">
                  <span>Filter kelas</span>
                  <select
                    className="text-input select-input"
                    onChange={(event) => {
                      setSelectedClassName(event.target.value);
                      setApprovalError(null);
                      setApprovalResult(null);
                    }}
                    value={selectedClassName}
                  >
                    <option value={ALL_CLASSES}>Semua kelas</option>
                    {classOptions.map((option) => (
                      <option key={option.className} value={option.className}>
                        {option.className} ({option.readyCount} siap / {option.totalCount} total)
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
                    placeholder="Cari nama, NIS, jurusan, atau kelas"
                    type="text"
                    value={search}
                  />
                </label>
              </div>

              <div className="selection-toolbar">
                <button
                  className={onlyReady ? "secondary-button is-active-toggle" : "secondary-button"}
                  onClick={() => {
                    setOnlyReady((current) => !current);
                  }}
                  type="button"
                >
                  {onlyReady ? "Hanya siswa siap approval" : "Tampilkan semua siswa"}
                </button>
                <button
                  className="secondary-button"
                  disabled={readyStudentsInClass.length === 0}
                  onClick={handleSelectAllReadyInClass}
                  type="button"
                >
                  Pilih semua siap di {selectedClassLabel}
                </button>
                <button
                  className="secondary-button"
                  disabled={selectedStudentIds.length === 0}
                  onClick={handleClearSelection}
                  type="button"
                >
                  Kosongkan pilihan
                </button>
              </div>
              <p className="session-meta">
                {filteredStudents.length} siswa tampil, {readyStudentsInClass.length} siap
                di {selectedClassLabel}, {selectedStudentIds.length} dipilih.
              </p>

              <label className="field-group">
                <span>Pilih container tujuan</span>
                <select
                  className="text-input select-input"
                  onChange={(event) => {
                    setSelectedContainerId(event.target.value);
                    setApprovalError(null);
                    setApprovalResult(null);
                  }}
                  value={selectedContainerId}
                >
                  {containers.length === 0 ? (
                    <option value="">Belum ada container aktif</option>
                  ) : (
                    containers.map((container) => (
                      <option key={container.id} value={container.id}>
                        {container.name} - {container.location}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <div className="choice-grid">
                {approvalOptions.map((option) => (
                  <button
                    className={
                      option.value === approvalType
                        ? "choice-card is-active"
                        : "choice-card"
                    }
                    key={option.value}
                    onClick={() => {
                      setApprovalType(option.value);
                      setApprovalError(null);
                      setApprovalResult(null);
                    }}
                    type="button"
                  >
                    <span className="panel-tag">{option.value}</span>
                    <strong>{option.label}</strong>
                    <p>{option.description}</p>
                  </button>
                ))}
              </div>

              <div className="scanner-controls">
                <button
                  className="primary-button"
                  disabled={
                    isSubmitting ||
                    selectedStudentIds.length === 0 ||
                    !selectedContainerId
                  }
                  onClick={() => {
                    void handleApprove();
                  }}
                  type="button"
                >
                  {isSubmitting
                    ? "Mengaktifkan approval massal..."
                    : `Aktifkan approval untuk ${selectedStudentIds.length} siswa`}
                </button>
                <button
                  className="secondary-button"
                  disabled={isLoading}
                  onClick={() => {
                    void loadPanelData();
                  }}
                  type="button"
                >
                  {isLoading ? "Memuat..." : "Muat ulang data"}
                </button>
              </div>

              {approvalError ? <p className="form-error">{approvalError}</p> : null}
              {loadError ? <p className="form-error">{loadError}</p> : null}
            </div>

            <div className="signal-panel">
              <span className="signal-label">Pilihan Massal</span>
              <strong>{selectedStudentIds.length}</strong>
              <p>
                {selectedStudentIds.length === 0
                  ? `Pilih siswa siap approval di ${selectedClassLabel} untuk mulai approval massal.`
                  : `${selectedStudentIds.length} siswa siap diajukan sebagai satu batch approval ${approvalType.toLowerCase()}.`}
              </p>
              <span className="status-badge status-outside">
                {selectedReadyInClassCount} terpilih di {selectedClassLabel}
              </span>
              {selectedContainer ? (
                <p className="session-meta">
                  Container tujuan: <strong>{selectedContainer.name}</strong> di{" "}
                  {selectedContainer.location}
                </p>
              ) : null}
              {selectedStudents.length > 0 ? (
                <div className="selection-pill-list">
                  {selectedStudents.slice(0, 8).map((student) => (
                    <span className="status-badge status-pending" key={student.id}>
                      {student.name}
                    </span>
                  ))}
                  {selectedStudents.length > 8 ? (
                    <span className="status-badge status-pending">
                      +{selectedStudents.length - 8} lainnya
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {approvalResult ? (
            <section className="content-panel">
              <div className="panel-header">
                <span className="panel-tag">Hasil Bulk Approval</span>
                <h2>Batch approval sudah diproses</h2>
              </div>
              <p className="lead compact-lead">{approvalResult.message}</p>
              <div className="result-grid">
                <div className="summary-block">
                  <span className="summary-label">Diproses</span>
                  <strong>{approvalResult.bulk.processedCount}</strong>
                  <p className="session-meta">
                    dari {approvalResult.bulk.requestedCount} siswa
                  </p>
                </div>
                <div className="summary-block">
                  <span className="summary-label">Baru / Update / Replay</span>
                  <strong>
                    {approvalResult.bulk.createdCount} / {approvalResult.bulk.updatedCount} /{" "}
                    {approvalResult.bulk.replayedCount}
                  </strong>
                  <p className="session-meta">
                    {approvalResult.bulk.skippedCount} siswa dilewati
                  </p>
                </div>
                <div className="summary-block">
                  <span className="summary-label">Operator</span>
                  <strong>{approvalResult.approvedBy.name}</strong>
                  <p className="session-meta">{approvalResult.approvedBy.role}</p>
                </div>
                <div className="summary-block">
                  <span className="summary-label">Container</span>
                  <strong>{approvalResult.container.name}</strong>
                  <p className="session-meta">
                    {approvalResult.container.location}
                  </p>
                </div>
              </div>

              {successfulApprovalItems.length > 0 ? (
                <>
                  <div className="panel-header bulk-result-header">
                    <span className="panel-tag">Siap Dipakai</span>
                    <h2>Approval aktif yang berhasil diproses</h2>
                  </div>
                  <div className="container-grid">
                    {successfulApprovalItems.map((item) => (
                      <article
                        className="container-card compact-summary"
                        key={`${item.student.id}-${item.result}`}
                      >
                        <div className="student-card-row">
                          <div>
                            <span className="status-label">
                              {item.student.className ?? "Tanpa kelas"}
                            </span>
                            <h3>{item.student.name ?? item.student.id}</h3>
                          </div>
                          <span className={getBulkResultClass(item.result)}>
                            {getBulkResultLabel(item.result)}
                          </span>
                        </div>
                        <p className="container-meta">
                          {item.student.nis ? `NIS ${item.student.nis}` : "Data NIS tidak tersedia"}
                        </p>
                        <p className="container-meta">{item.message}</p>
                        {item.approval ? (
                          <p className="container-meta">
                            Aktif sejak {formatDateTime(item.approval.approvedAt)} untuk{" "}
                            {item.approval.container.name}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </>
              ) : null}

              {skippedApprovalItems.length > 0 ? (
                <>
                  <div className="panel-header bulk-result-header">
                    <span className="panel-tag">Perlu Tindak Lanjut</span>
                    <h2>Siswa yang tidak ikut ter-approve pada batch ini</h2>
                  </div>
                  <div className="container-grid">
                    {skippedApprovalItems.map((item) => (
                      <article
                        className="container-card compact-summary"
                        key={`${item.student.id}-${item.result}`}
                      >
                        <div className="student-card-row">
                          <div>
                            <span className="status-label">
                              {item.student.className ?? "Tanpa kelas"}
                            </span>
                            <h3>{item.student.name ?? item.student.id}</h3>
                          </div>
                          <span className={getBulkResultClass(item.result)}>
                            {getBulkResultLabel(item.result)}
                          </span>
                        </div>
                        <p className="container-meta">
                          {item.student.nis ? `NIS ${item.student.nis}` : "Data NIS tidak tersedia"}
                        </p>
                        <p className="container-meta">{item.message}</p>
                      </article>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {pendingApprovalStudents.length > 0 ? (
            <section className="content-panel">
              <div className="panel-header">
                <span className="panel-tag">Menunggu Scan</span>
                <h2>Approval aktif yang belum dipakai siswa</h2>
              </div>
              <div className="container-grid">
                {pendingApprovalStudents.map((student) => (
                  <article className="container-card" key={student.pendingApproval?.id}>
                    <div className="student-card-row">
                      <div>
                        <span className="status-label">{student.className}</span>
                        <h3>{student.name}</h3>
                      </div>
                      <span className="status-badge status-pending">
                        {student.pendingApproval?.type}
                      </span>
                    </div>
                    <p className="container-meta">NIS {student.nis}</p>
                    <p className="container-meta">
                      Container: {student.pendingApproval?.container.name} |{" "}
                      {student.pendingApproval?.container.location}
                    </p>
                    <p className="container-meta">
                      Diaktifkan oleh {student.pendingApproval?.approvedBy.name} pada{" "}
                      {student.pendingApproval
                        ? formatDateTime(student.pendingApproval.approvedAt)
                        : "-"}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="content-panel">
            <div className="panel-header">
              <span className="panel-tag">Daftar Siswa</span>
              <h2>Pilih banyak siswa dalam satu kelas untuk approval massal</h2>
            </div>
            {isLoading && students.length === 0 ? (
              <ListSkeleton items={5} />
            ) : filteredStudents.length === 0 ? (
              <p className="lead compact-lead">
                {onlyReady
                  ? "Belum ada siswa yang siap di-approve untuk filter saat ini."
                  : "Tidak ada siswa yang cocok dengan filter kelas atau pencarian saat ini."}
              </p>
            ) : (
              <div style={{ height: "700px", minHeight: "700px" }}>
                <AutoSizer
                  renderProp={({ height, width }) => {
                    if (!height || !width) {
                      return null;
                    }

                    const columnCount = Math.max(1, Math.floor(width / (260 + 16)));
                    const rowCount = Math.ceil(filteredStudents.length / columnCount);
                    
                    return (
                      <List
                        defaultHeight={700}
                        rowComponent={VirtualizedGridRow}
                        rowCount={rowCount}
                        rowHeight={380}
                        rowProps={{
                          items: filteredStudents,
                          columnCount,
                          onToggle: handleToggleStudent,
                          selectedStudentSet
                        }}
                        style={{ height, width }}
                      />
                    );
                  }}
                />
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
