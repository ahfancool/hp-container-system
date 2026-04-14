import { buildApiUrl } from "./config";

type ApprovalPreview = {
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
};

export type ScanValidationResponse = {
  authenticatedStudent: {
    id: string;
    name: string;
    nis: string;
  };
  message: string;
  transactionRecorded: boolean;
  validation: {
    activeApproval: ApprovalPreview | null;
    actionPreview: "IN" | "OUT";
    container: {
      createdAt: string;
      id: string;
      isActive: boolean;
      location: string;
      name: string;
      qrCode: string;
      updatedAt: string;
    };
    lastTransaction: {
      action: "IN" | "OUT";
      timestamp: string;
      type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
    } | null;
    penaltyStatus?: {
      isPenalized: boolean;
      message: string;
      type: "SEIZURE_24H" | "PARENT_PICKUP";
    };
    rules:
      | {
          allowedAt: string;
          approvalType: "PEMBELAJARAN" | "DARURAT";
          approvedAt: string;
          currentLocalTime: string;
          endsAt: null;
          isAllowed: true;
          scheduleType: "TEACHER_APPROVAL";
          timeZone: string;
        }
      | {
          allowedAt: string;
          currentLocalTime: string;
          endsAt: string | null;
          isAllowed: boolean;
          scheduleType: "REGULAR_IN" | "REGULAR_OUT";
          timeZone: string;
        };
    transactionTypePreview: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
    validatedTimestamp: string;
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

export async function submitScanValidation(
  accessToken: string,
  payload: {
    containerId: string;
    studentId: string;
    timestamp: string;
    fingerprint?: string;
    qrToken?: string;
  }
): Promise<ScanValidationResponse> {
  const response = await fetch(buildApiUrl("/scan"), {
    body: JSON.stringify({
      container_id: payload.containerId,
      qr_token: payload.qrToken,
      student_id: payload.studentId,
      timestamp: payload.timestamp,
      fingerprint: payload.fingerprint
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
    data: ScanValidationResponse;
  };

  return result.data;
}
