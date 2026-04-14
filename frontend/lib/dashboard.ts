import { buildApiUrl } from "./config";

type DashboardStudentStatus = {
  className: string;
  gradeLevel: string;
  id: string;
  latestTransaction: {
    action: "IN" | "OUT";
    containerId: string;
    containerLocation: string | null;
    containerName: string | null;
    timestamp: string;
    type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
  } | null;
  major: string | null;
  name: string;
  nextExpectedAction: "IN" | "OUT";
  nis: string;
  pendingApproval: {
    approvedAt: string;
    approvedBy: {
      id: string;
      name: string;
      role: "teacher" | "homeroom" | "admin";
    };
    container: {
      createdAt: string;
      id: string;
      isActive: boolean;
      location: string;
      name: string;
      qrCode: string;
      updatedAt: string;
    };
    id: string;
    requestId: string | null;
    studentId: string;
    type: "PEMBELAJARAN" | "DARURAT";
    updatedAt: string;
  } | null;
  phoneStatus: "INSIDE" | "OUTSIDE" | "NOT_SCANNED";
  readyForTeacherOverride: boolean;
};

export type DashboardStatusResponse = {
  authorizedRole: "teacher" | "homeroom" | "admin";
  classSummaries: Array<{
    className: string;
    emergencyReleaseCount: number;
    insideCount: number;
    notScannedCount: number;
    outsideCount: number;
    pendingApprovalCount: number;
    totalStudents: number;
  }>;
  containerSummaries: Array<{
    id: string;
    insideCount: number;
    isActive: boolean;
    location: string;
    name: string;
  }>;
  emergencyReleases: DashboardStudentStatus[];
  generatedAt: string;
  recentActivities: Array<{
    action: "IN" | "OUT";
    container: {
      id: string;
      location: string | null;
      name: string | null;
    };
    id: string;
    operator: {
      id: string;
      name: string;
      role: "teacher" | "homeroom" | "admin";
    } | null;
    student: {
      className: string | null;
      id: string;
      name: string | null;
      nis: string | null;
    };
    timestamp: string;
    type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
  }>;
  students: {
    inside: DashboardStudentStatus[];
    notScanned: DashboardStudentStatus[];
    outside: DashboardStudentStatus[];
  };
  performance: {
    snapshotCache: "HIT" | "MISS" | "SKIP";
    snapshotTtlSeconds: number;
  };
  summary: {
    activeContainerCount: number;
    activeStudentCount: number;
    emergencyReleaseCount: number;
    insideCount: number;
    insideRate: number;
    notScannedCount: number;
    outsideCount: number;
    overrideOutCount: number;
    pendingApprovalCount: number;
    totalStudents: number;
  };
};

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
      details?: { message?: string };
    };

    return payload.details?.message ?? payload.error ?? "Terjadi kesalahan API.";
  } catch {
    return "Terjadi kesalahan API.";
  }
}

export async function fetchDashboardStatus(
  accessToken: string
): Promise<DashboardStatusResponse> {
  const response = await fetch(buildApiUrl("/dashboard/status"), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as {
    data: DashboardStatusResponse;
  };

  return payload.data;
}
