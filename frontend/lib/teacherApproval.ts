import { buildApiUrl } from "./config";
import { createClientRequestId } from "./requestId";

type ApprovalType = "PEMBELAJARAN" | "DARURAT";

type ApprovalContainer = {
  createdAt: string;
  id: string;
  isActive: boolean;
  location: string;
  name: string;
  qrCode: string;
  updatedAt: string;
};

export type TeacherApprovalResponse = {
  approvedBy: {
    id: string;
    name: string;
    role: "teacher" | "homeroom" | "admin";
  };
  bulk: {
    createdCount: number;
    processedCount: number;
    replayedCount: number;
    requestId: string | null;
    requestedCount: number;
    skippedCount: number;
    updatedCount: number;
  };
  container: ApprovalContainer;
  items: Array<{
    approval: {
      approvedAt: string;
      approvedBy: {
        id: string;
        name: string;
        role: "teacher" | "homeroom" | "admin";
      };
      container: ApprovalContainer;
      id: string;
      requestId: string | null;
      studentId: string;
      type: ApprovalType;
      updatedAt: string;
    } | null;
    message: string;
    result:
      | "created"
      | "updated"
      | "replayed"
      | "skipped_invalid_state"
      | "skipped_inactive"
      | "skipped_not_found"
      | "skipped_request_conflict";
    student: {
      className: string | null;
      id: string;
      name: string | null;
      nis: string | null;
    };
  }>;
  message: string;
  type: ApprovalType;
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

export async function submitTeacherApproval(
  accessToken: string,
  payload: {
    containerId: string;
    requestId?: string;
    studentIds: string[];
    timestamp?: string;
    type: ApprovalType;
  }
): Promise<TeacherApprovalResponse> {
  const requestId = payload.requestId ?? createClientRequestId("teacher-approval");

  const response = await fetch(buildApiUrl("/teacher/approve"), {
    body: JSON.stringify({
      container_id: payload.containerId,
      request_id: requestId,
      student_ids: payload.studentIds,
      timestamp: payload.timestamp,
      type: payload.type
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const result = (await response.json()) as {
    data: TeacherApprovalResponse;
  };

  return result.data;
}
