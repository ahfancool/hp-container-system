import { buildApiUrl } from "./config";

export type StudentApprovalRecord = {
  className: string;
  gradeLevel: string;
  id: string;
  isActive: boolean;
  latestTransaction: {
    action: "IN" | "OUT";
    containerId: string;
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
  userId: string | null;
};

type StudentsResponse = {
  data: {
    items: StudentApprovalRecord[];
    meta: {
      authorizedRole: string | null;
      includeInactive: boolean;
      search: string;
      total: number;
    };
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

export async function fetchStudentsForApproval(
  accessToken: string
): Promise<StudentApprovalRecord[]> {
  const response = await fetch(buildApiUrl("/students"), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as StudentsResponse;
  return payload.data.items;
}
