import { buildApiUrl } from "./config";
import { createClientRequestId } from "./requestId";

export type TransactionResponse = {
  consumedApproval: {
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
    type: "PEMBELAJARAN" | "DARURAT";
  } | null;
  idempotency: {
    replayed: boolean;
    requestId: string | null;
  };
  message: string;
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
  student: {
    id: string;
    name: string;
    nis: string;
  };
  transaction: {
    action: "IN" | "OUT";
    containerId: string;
    createdAt: string;
    id: string;
    isLateSync: boolean;
    operatorId: string | null;
    requestId: string | null;
    studentId: string;
    timestamp: string;
    type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
  };
  validation: {
    activeApproval: {
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

export async function submitPhoneTransaction(
  accessToken: string,
  payload: {
    containerId: string;
    requestId?: string;
    studentId: string;
    timestamp: string;
    type?: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
    fingerprint?: string;
    qrToken?: string;
  }
): Promise<TransactionResponse> {
  const requestId = payload.requestId ?? createClientRequestId("transaction");

  const response = await fetch(buildApiUrl("/transaction"), {
    body: JSON.stringify({
      container_id: payload.containerId,
      fingerprint: payload.fingerprint,
      qr_token: payload.qrToken,
      request_id: requestId,
      student_id: payload.studentId,
      timestamp: payload.timestamp,
      type: payload.type ?? "REGULAR"
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
    data: TransactionResponse;
  };

  return result.data;
}
