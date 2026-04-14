import type { RequestAuth } from "./auth";
import { getContainerById, type ContainerRecord } from "./containers";
import type { AppEnv } from "./env";
import { getRegularInWindow, getRegularOutWindow } from "./schedule";
import {
  getPendingTeacherApprovalByStudent,
  type ApprovalType,
  type PendingTeacherApproval
} from "./teacherApprovals";
import { createServiceRoleClient } from "./supabase";

type ScanValidationInput = {
  containerId: string;
  studentId: string;
  timestamp: string;
  qrToken?: string;
};

export type ScanPreview = {
  activeApproval: PendingTeacherApproval | null;
  actionPreview: "IN" | "OUT";
  container: ContainerRecord;
  lastTransaction: {
    action: "IN" | "OUT";
    timestamp: string;
    type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
  } | null;
  penaltyStatus?: {
    isPenalized: boolean;
    type: "SEIZURE_24H" | "PARENT_PICKUP";
    message: string;
  };
  rules:
    | {
        allowedAt: string;
        approvalType: ApprovalType;
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

function normalizeTimestamp(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("INVALID_TIMESTAMP");
  }

  return parsedDate.toISOString();
}

export function normalizeIsoTimestamp(value: string): string {
  return normalizeTimestamp(value);
}

type ValidateScanOptions = {
  ignorePendingApproval?: boolean;
};

export async function validateScanPayload(
  env: AppEnv,
  auth: RequestAuth,
  input: ScanValidationInput,
  options?: ValidateScanOptions
): Promise<ScanPreview> {
  if (auth.appUser.role === "student" && !auth.student) {
    throw new Error("STUDENT_PROFILE_NOT_FOUND");
  }

  if (auth.student && input.studentId !== auth.student.id) {
    throw new Error("UNAUTHORIZED_STUDENT_SCAN");
  }

  const container = await getContainerById(env, input.containerId);

  if (!container || !container.isActive) {
    throw new Error("INVALID_CONTAINER");
  }

  // Milestone 16: QR Token Security
  if (input.qrToken && container.qrSecretToken !== input.qrToken) {
    throw new Error("QR_EXPIRED");
  }

  const validatedTimestamp = normalizeTimestamp(input.timestamp);
  const client = createServiceRoleClient(env);

  // Milestone 13: Consolidated validation via RPC
  const { data: rpcData, error: rpcError } = await client.rpc(
    "validate_and_get_preview",
    {
      p_student_id: input.studentId,
      p_container_id: input.containerId
    }
  );

  if (rpcError) {
    throw new Error(`SCAN_PREVIEW_FAILED:${rpcError.message}`);
  }

  const preview = rpcData as {
    is_allowed: boolean;
    action_preview: "IN" | "OUT";
    transaction_type_preview: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
    active_approval:
      | {
          id: string;
          approved_at: string;
          type: ApprovalType;
        }
      | null;
    penalty_status:
      | {
          is_penalized: boolean;
          message: string;
          type: "SEIZURE_24H" | "PARENT_PICKUP";
        }
      | null;
    last_transaction: any | null;
    error_code?: string;
    error_message?: string;
  };

  if (!preview.is_allowed && preview.error_code !== "STUDENT_PENALIZED") {
    throw new Error(preview.error_code || "SCAN_PREVIEW_REJECTED");
  }

  const actionPreview = preview.action_preview;
  const activeApproval = preview.active_approval
    ? await getPendingTeacherApprovalByStudent(env, input.studentId)
    : null;

  if (
    preview.active_approval &&
    (!activeApproval || activeApproval.id !== preview.active_approval.id)
  ) {
    throw new Error("PENDING_APPROVAL_LOOKUP_FAILED");
  }

  const penaltyStatus = preview.penalty_status
    ? {
        isPenalized: preview.penalty_status.is_penalized,
        message: preview.penalty_status.message,
        type: preview.penalty_status.type
      }
    : undefined;

  // Handle Penalty Status
  if (penaltyStatus) {
    const regularWindow =
      actionPreview === "IN"
        ? getRegularInWindow(env, validatedTimestamp)
        : getRegularOutWindow(env, validatedTimestamp);

    return {
      activeApproval,
      actionPreview,
      container,
      lastTransaction: preview.last_transaction,
      penaltyStatus,
      rules: {
        ...regularWindow,
        isAllowed: false, // Penalty overrides regular schedule
        scheduleType: actionPreview === "IN" ? "REGULAR_IN" : "REGULAR_OUT"
      },
      transactionTypePreview: preview.transaction_type_preview,
      validatedTimestamp
    };
  }

  if (activeApproval) {
    const outWindow = getRegularOutWindow(env, validatedTimestamp);

    return {
      activeApproval,
      actionPreview,
      container,
      lastTransaction: preview.last_transaction,
      rules: {
        allowedAt: outWindow.currentLocalTime,
        approvalType: activeApproval.type,
        approvedAt: activeApproval.approvedAt,
        currentLocalTime: outWindow.currentLocalTime,
        endsAt: null,
        isAllowed: true,
        scheduleType: "TEACHER_APPROVAL",
        timeZone: outWindow.timeZone
      },
      transactionTypePreview: activeApproval.type,
      validatedTimestamp
    };
  }

  const regularWindow =
    actionPreview === "IN"
      ? {
          ...getRegularInWindow(env, validatedTimestamp),
          scheduleType: "REGULAR_IN" as const
        }
      : {
          ...getRegularOutWindow(env, validatedTimestamp),
          endsAt: null,
          scheduleType: "REGULAR_OUT" as const
        };

  return {
    activeApproval: null,
    actionPreview,
    container,
    lastTransaction: preview.last_transaction,
    rules: regularWindow,
    transactionTypePreview: "REGULAR",
    validatedTimestamp
  };
}
