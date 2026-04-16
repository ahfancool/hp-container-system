import Link from "next/link";
import React, { useDeferredValue, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { List, type RowComponentProps } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";

import { Layout } from "../../components/Layout";
import { DashboardListSkeleton, Skeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Card";
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
  onQuickApprove: (student: StudentApprovalRecord) => void;
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
    return "Di container";
  }

  if (status === "OUTSIDE") {
    return "Sedang keluar";
  }

  return "Belum scan";
}

function getPhoneStatusClass(status: StudentApprovalRecord["phoneStatus"]): string {
  if (status === "INSIDE") {
    return "status-badge status-inside";
  }

  if (status === "OUTSIDE") {
    return "status-badge status-pending"; // Orange
  }

  return "status-badge status-neutral"; // Gray
}

// Memoized individual student card for performance
const StudentOptionCard = React.memo(({ 
  student, 
  isSelected, 
  onToggle,
  onQuickApprove
}: { 
  student: StudentApprovalRecord; 
  isSelected: boolean; 
  onToggle: (id: string) => void;
  onQuickApprove: (student: StudentApprovalRecord) => void;
}) => {
  const isSelectable = student.readyForTeacherOverride;

  return (
    <article
      className={[
        "student-option-card",
        "fade-in",
        "hover-lift",
        isSelected ? "is-selected" : "",
        !isSelectable && !student.pendingApproval ? "opacity-60" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ height: "100%", width: "100%", cursor: "default" }}
    >
      <div className="student-card-row">
        <div>
          <span className="status-label">{student.className}</span>
          <h3 style={{ margin: "4px 0" }}>{student.name}</h3>
        </div>
        <span className={getPhoneStatusClass(student.phoneStatus)}>
          {getPhoneStatusLabel(student.phoneStatus)}
        </span>
      </div>
      
      <p className="container-meta" style={{ marginBottom: "12px" }}>
        NIS {student.nis} {student.major ? ` | ${student.major}` : ""}
      </p>

      {student.pendingApproval ? (
        <div className="approval-inline-card compact-approval-card" style={{ marginBottom: "12px" }}>
          <span className="summary-label">Approval Aktif</span>
          <strong>{student.pendingApproval.type}</strong>
          <p className="session-meta">
            Menunggu scan di {student.pendingApproval.container.name}
          </p>
        </div>
      ) : (
        <p className="session-meta" style={{ marginBottom: "12px", minHeight: "2.4em" }}>
          {isSelectable 
            ? "Siap untuk mendapatkan approval keluar." 
            : "Belum bisa approval (HP tidak di dalam container)."}
        </p>
      )}

      <div className="flex gap-2 mt-auto">
        <Button
          variant={isSelected ? "primary" : "secondary"}
          size="sm"
          className="flex-1"
          disabled={!isSelectable}
          onClick={() => onToggle(student.id)}
        >
          {isSelected ? "Terpilih" : "Pilih Massal"}
        </Button>
        {isSelectable && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onQuickApprove(student)}
          >
            Quick Approve
          </Button>
        )}
      </div>
    </article>
  );
});

// Row component that renders multiple columns
function VirtualizedGridRow({
  columnCount,
  index,
  items,
  onToggle,
  onQuickApprove,
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
            onQuickApprove={onQuickApprove}
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

  // Quick Approval State
  const [quickApproveStudent, setQuickApproveStudent] = useState<StudentApprovalRecord | null>(null);
  const [quickApprovalType, setQuickApprovalType] = useState<ApprovalType>("PEMBELAJARAN");

  const canApprove = Boolean(snapshot?.permissions.canApprove);
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const selectedStudentSet = useMemo(() => new Set(selectedStudentIds), [selectedStudentIds]);
  const selectedContainer =
    containers.find((container) => container.id === selectedContainerId) ?? null;
  const pendingApprovalStudents = students.filter((student) => student.pendingApproval);
  
  // History: Students who were approved today and still have pending approval
  // Or simply use the ones with pendingApproval as "active history" for this session
  const activeApprovalsHistory = useMemo(() => {
    return students.filter(s => s.pendingApproval).sort((a, b) => {
      const timeA = new Date(a.pendingApproval!.approvedAt).getTime();
      const timeB = new Date(b.pendingApproval!.approvedAt).getTime();
      return timeB - timeA;
    });
  }, [students]);

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

  const loadPanelData = async (silent = false) => {
    if (!session?.access_token || !canApprove) {
      return;
    }

    if (!silent) setIsLoading(true);
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
      if (!silent) toast.error(message);
    } finally {
      if (!silent) setIsLoading(false);
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

  const handleQuickApprove = async () => {
    if (!session?.access_token || !quickApproveStudent || !selectedContainerId) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitTeacherApproval(session.access_token, {
        containerId: selectedContainerId,
        studentIds: [quickApproveStudent.id],
        type: quickApprovalType
      });

      toast.success(`Approval ${quickApprovalType.toLowerCase()} aktif untuk ${quickApproveStudent.name}`);
      setQuickApproveStudent(null);
      await loadPanelData(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal quick approve");
    } finally {
      setIsSubmitting(false);
    }
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
      title="Teacher Approval"
      eyebrow="Milestone 14: Approval Workflow"
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
          <div className="button-row compact-button-row">
            <Link className="secondary-button" href={getDefaultRoute(snapshot)}>
              Buka halaman utama
            </Link>
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-8">
          <section className="hero-grid">
            <Card className="p-8">
              <div className="panel-header">
                <span className="panel-tag">Quick Search & Filter</span>
                <h2>Cari siswa atau filter per kelas</h2>
              </div>
              
              <div className="flex flex-col gap-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="field-group">
                    <span>Cari siswa</span>
                    <input
                      className="text-input"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Nama, NIS, atau jurusan"
                      type="text"
                      value={search}
                    />
                  </div>
                  <div className="field-group">
                    <span>Filter kelas</span>
                    <select
                      className="text-input select-input"
                      onChange={(event) => setSelectedClassName(event.target.value)}
                      value={selectedClassName}
                    >
                      <option value={ALL_CLASSES}>Semua kelas</option>
                      {classOptions.map((option) => (
                        <option key={option.className} value={option.className}>
                          {option.className} ({option.readyCount} siap)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={onlyReady ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setOnlyReady(!onlyReady)}
                  >
                    {onlyReady ? "Hanya Siap Approval" : "Semua Siswa"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={readyStudentsInClass.length === 0}
                    onClick={() => setSelectedStudentIds(readyStudentsInClass.map(s => s.id))}
                  >
                    Pilih Semua di {selectedClassLabel}
                  </Button>
                  {selectedStudentIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedStudentIds([])}
                    >
                      Batal Pilih ({selectedStudentIds.length})
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            <div className="signal-panel">
              <span className="signal-label">Bulk Configuration</span>
              <div className="flex flex-col gap-4 mt-2">
                <div className="field-group">
                  <span>Container Tujuan</span>
                  <select
                    className="text-input select-input"
                    onChange={(event) => setSelectedContainerId(event.target.value)}
                    value={selectedContainerId}
                  >
                    {containers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <span>Tipe Approval</span>
                  <div className="flex gap-2">
                    {approvalOptions.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={approvalType === opt.value ? "primary" : "secondary"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setApprovalType(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full mt-2"
                  disabled={selectedStudentIds.length === 0 || isSubmitting}
                  isLoading={isSubmitting}
                  onClick={handleApprove}
                >
                  Approve {selectedStudentIds.length} Siswa
                </Button>
              </div>
            </div>
          </section>

          {approvalResult && (
            <section className="content-panel border-2 border-accent/20">
              <div className="panel-header">
                <div className="flex justify-between items-center w-full">
                  <div>
                    <span className="panel-tag">Batch Results</span>
                    <h2>Hasil Bulk Approval Terakhir</h2>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setApprovalResult(null)}>
                    Tutup Hasil
                  </Button>
                </div>
              </div>
              <p className="lead compact-lead mt-2">{approvalResult.message}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-surface p-4 rounded-xl">
                  <span className="summary-label">Diproses</span>
                  <strong className="text-xl block">{approvalResult.bulk.processedCount}</strong>
                </div>
                <div className="bg-surface p-4 rounded-xl">
                  <span className="summary-label">Siswa Dilewati</span>
                  <strong className="text-xl block">{approvalResult.bulk.skippedCount}</strong>
                </div>
                <div className="bg-surface p-4 rounded-xl">
                  <span className="summary-label">Container</span>
                  <strong className="text-lg block truncate">{approvalResult.container.name}</strong>
                </div>
                <div className="bg-surface p-4 rounded-xl">
                  <span className="summary-label">Tipe</span>
                  <strong className="text-lg block">{approvalResult.type}</strong>
                </div>
              </div>

              {successfulApprovalItems.length > 0 && (
                <div className="mt-8">
                  <div className="panel-header mb-4">
                    <span className="panel-tag">Success</span>
                    <h3>Approval Aktif Berhasil Diproses</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {successfulApprovalItems.map((item) => (
                      <article
                        className="p-4 border border-line rounded-xl bg-white"
                        key={`${item.student.id}-${item.result}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-muted">{item.student.className}</span>
                            <h4 className="font-bold">{item.student.name}</h4>
                          </div>
                          <span className={getBulkResultClass(item.result)}>
                            {getBulkResultLabel(item.result)}
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-2">{item.message}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {activeApprovalsHistory.length > 0 && (
            <section className="content-panel">
              <div className="panel-header">
                <span className="panel-tag">Active Approvals Today</span>
                <h2>Siswa yang sudah di-approve & menunggu scan</h2>
              </div>
              <div className="container-grid mt-4">
                {activeApprovalsHistory.slice(0, 4).map((student) => (
                  <Card key={student.id} className="p-4 bg-surface/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="status-label">{student.className}</span>
                        <h3 className="text-lg font-bold">{student.name}</h3>
                        <p className="session-meta mt-1">
                          {student.pendingApproval?.type} • {formatDateTime(student.pendingApproval!.approvedAt)}
                        </p>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="content-panel">
            <div className="panel-header">
              <span className="panel-tag">Student List</span>
              <h2>{selectedClassLabel}</h2>
            </div>
            
            {isLoading && students.length === 0 ? (
              <DashboardListSkeleton items={5} />
            ) : filteredStudents.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="lead">Tidak ada siswa yang ditemukan.</p>
              </Card>
            ) : (
              <div style={{ height: "700px", minHeight: "700px" }}>
                <AutoSizer
                  renderProp={({ height, width }) => {
                    if (!height || !width) return null;
                    const columnCount = Math.max(1, Math.floor(width / (280 + 16)));
                    const rowCount = Math.ceil(filteredStudents.length / columnCount);
                    return (
                      <List
                        defaultHeight={700}
                        rowComponent={VirtualizedGridRow}
                        rowCount={rowCount}
                        rowHeight={280}
                        rowProps={{
                          items: filteredStudents,
                          columnCount,
                          onToggle: handleToggleStudent,
                          onQuickApprove: setQuickApproveStudent,
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

          {/* Quick Approval Modal */}
          <Modal
            isOpen={!!quickApproveStudent}
            onClose={() => setQuickApproveStudent(null)}
            title="Quick Approval"
            footer={
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full"
                  isLoading={isSubmitting}
                  onClick={handleQuickApprove}
                >
                  Konfirmasi Approval
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setQuickApproveStudent(null)}
                >
                  Batal
                </Button>
              </div>
            }
          >
            {quickApproveStudent && (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-muted text-sm uppercase font-bold tracking-wider">Siswa</p>
                  <h3 className="text-2xl font-bold mt-1">{quickApproveStudent.name}</h3>
                  <p className="text-muted">{quickApproveStudent.className} • NIS {quickApproveStudent.nis}</p>
                </div>

                <div className="field-group">
                  <span>Pilih Tipe Approval</span>
                  <div className="grid grid-cols-2 gap-3">
                    {approvalOptions.map((opt) => (
                      <button
                        key={opt.value}
                        className={`choice-card ${quickApprovalType === opt.value ? "is-active" : ""}`}
                        onClick={() => setQuickApprovalType(opt.value)}
                      >
                        <strong className="block text-lg">{opt.label}</strong>
                        <p className="text-xs leading-tight mt-1">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-surface-strong p-4 rounded-xl">
                  <p className="text-sm">
                    HP akan dapat diambil di <strong>{selectedContainer?.name}</strong> segera setelah konfirmasi.
                  </p>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}
    </Layout>
  );
}

