import type { RequestAuth } from "./auth";
import { getContainerById } from "./containers";
import type { AppEnv, AppRole } from "./env";
import { getRegularInWindow, getRegularOutWindow } from "./schedule";
import { validateScanPayload, type ScanPreview } from "./scan";
import { getStudentById, type StudentRecord } from "./students";
import { createServiceRoleClient } from "./supabase";
import {
  consumePendingTeacherApproval,
  type ApprovalType,
  type PendingTeacherApproval
} from "./teacherApprovals";

export type TransactionType = "REGULAR" | "PEMBELAJARAN" | "DARURAT";

export type TransactionInput = {
  containerId: string;
  requestId: string | null;
  studentId: string;
  timestamp: string;
  type: TransactionType;
  qrToken?: string;
};

export type CreatedTransaction = {
  action: "IN" | "OUT";
  containerId: string;
  createdAt: string;
  id: string;
  isLateSync: boolean;
  operatorId: string | null;
  requestId: string | null;
  studentId: string;
  timestamp: string;
  type: TransactionType;
};

type TransactionRow = {
  action: "IN" | "OUT";
  container_id: string;
  created_at: string;
  id: string;
  is_late_sync: boolean;
  operator_id: string | null;
  request_id: string | null;
  student_id: string;
  timestamp: string;
  type: TransactionType;
};

type PreviousTransactionRow = {
  action: "IN" | "OUT";
  created_at: string;
  id: string;
  timestamp: string;
  type: TransactionType;
};

function isStaffRole(role: AppRole): boolean {
  return role === "teacher" || role === "homeroom" || role === "admin";
}

function mapTransaction(row: TransactionRow): CreatedTransaction {
  return {
    action: row.action,
    containerId: row.container_id,
    createdAt: row.created_at,
    id: row.id,
    isLateSync: row.is_late_sync,
    operatorId: row.operator_id,
    requestId: row.request_id,
    studentId: row.student_id,
    timestamp: row.timestamp,
    type: row.type
  };
}

export function normalizeTransactionType(value: string | undefined): TransactionType {
  const nextType = value?.trim().toUpperCase() || "REGULAR";

  if (
    nextType !== "REGULAR" &&
    nextType !== "PEMBELAJARAN" &&
    nextType !== "DARURAT"
  ) {
    throw new Error("INVALID_TRANSACTION_TYPE");
  }

  return nextType;
}

export function normalizeRequestId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  if (trimmedValue.length > 120) {
    throw new Error("INVALID_REQUEST_ID");
  }

  return trimmedValue;
}

async function resolveTargetStudent(
  env: AppEnv,
  auth: RequestAuth,
  studentId: string
): Promise<StudentRecord> {
  if (auth.student && auth.student.id === studentId) {
    return {
      className: auth.student.className,
      deviceFingerprint: null,
      fingerprintUpdatedAt: null,
      gradeLevel: auth.student.gradeLevel,
      id: auth.student.id,
      isActive: true,
      major: auth.student.major,
      name: auth.student.name,
      nis: auth.student.nis,
      userId: auth.appUser.id
    };
  }

  const student = await getStudentById(env, studentId);

  if (!student || !student.isActive) {
    throw new Error("STUDENT_NOT_FOUND");
  }

  return student;
}

function buildTeacherApprovalRule(
  env: AppEnv,
  approvalType: ApprovalType,
  approvedAt: string,
  timestamp: string
): Extract<ScanPreview["rules"], { scheduleType: "TEACHER_APPROVAL" }> {
  const outWindow = getRegularOutWindow(env, timestamp);

  return {
    allowedAt: outWindow.currentLocalTime,
    approvalType,
    approvedAt,
    currentLocalTime: outWindow.currentLocalTime,
    endsAt: null,
    isAllowed: true,
    scheduleType: "TEACHER_APPROVAL" as const,
    timeZone: outWindow.timeZone
  };
}

function getTransactionRules(
  env: AppEnv,
  action: "IN" | "OUT",
  type: TransactionType,
  timestamp: string,
  approval?: PendingTeacherApproval | null
): ScanPreview["rules"] {
  if (type !== "REGULAR") {
    return buildTeacherApprovalRule(
      env,
      type as ApprovalType,
      approval?.approvedAt ?? timestamp,
      timestamp
    );
  }

  if (action === "IN") {
    const inWindow = getRegularInWindow(env, timestamp);

    return {
      ...inWindow,
      scheduleType: "REGULAR_IN" as const
    };
  }

  const outWindow = getRegularOutWindow(env, timestamp);

  return {
    ...outWindow,
    endsAt: null,
    scheduleType: "REGULAR_OUT" as const
  };
}

function resolveTransactionPlan(
  auth: RequestAuth,
  targetStudent: StudentRecord,
  requestedType: TransactionType,
  preview: ScanPreview,
  env: AppEnv
): {
  effectiveType: TransactionType;
  operatorId: string | null;
} {
  const role = auth.appUser.role;

  if (role === "student") {
    if (!auth.student || auth.student.id !== targetStudent.id) {
      throw new Error("UNAUTHORIZED_STUDENT_TRANSACTION");
    }

    if (requestedType !== "REGULAR") {
      throw new Error("UNAUTHORIZED_ACTION");
    }

    if (preview.actionPreview === "IN") {
      if (!preview.rules.isAllowed) {
        throw new Error("REGULAR_IN_NOT_ALLOWED_NOW");
      }

      return {
        effectiveType: "REGULAR",
        operatorId: null
      };
    }

    if (preview.activeApproval) {
      return {
        effectiveType: preview.activeApproval.type,
        operatorId: preview.activeApproval.approvedBy.id
      };
    }

    if (!preview.rules.isAllowed) {
      throw new Error("REGULAR_OUT_NOT_ALLOWED_YET");
    }

    return {
      effectiveType: "REGULAR",
      operatorId: null
    };
  }

  if (!isStaffRole(role)) {
    throw new Error("UNAUTHORIZED_ACTION");
  }

  if (preview.actionPreview === "IN") {
    throw new Error("INVALID_TRANSACTION_TYPE_FOR_ACTION");
  }

  if (requestedType === "REGULAR") {
    throw new Error("STAFF_REGULAR_TRANSACTION_NOT_ALLOWED");
  }

  return {
    effectiveType: requestedType,
    operatorId: auth.appUser.id
  };
}

async function getTransactionByRequestId(
  env: AppEnv,
  requestId: string
): Promise<CreatedTransaction | null> {
  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("phone_transactions")
    .select(
      "id, student_id, container_id, action, type, timestamp, operator_id, created_at, request_id, is_late_sync"
    )
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) {
    throw new Error(`TRANSACTION_LOOKUP_FAILED:${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapTransaction(data as TransactionRow);
}

async function getPreviousTransaction(
  env: AppEnv,
  transaction: CreatedTransaction
): Promise<ScanPreview["lastTransaction"]> {
  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("phone_transactions")
    .select("id, action, type, timestamp, created_at")
    .eq("student_id", transaction.studentId)
    .lte("timestamp", transaction.timestamp)
    .order("timestamp", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`TRANSACTION_HISTORY_LOOKUP_FAILED:${error.message}`);
  }

  const previous = ((data ?? []) as PreviousTransactionRow[]).find((item) => {
    if (item.id === transaction.id) {
      return false;
    }

    if (item.timestamp < transaction.timestamp) {
      return true;
    }

    return (
      item.timestamp === transaction.timestamp &&
      item.created_at < transaction.createdAt
    );
  });

  if (!previous) {
    return null;
  }

  return {
    action: previous.action,
    timestamp: previous.timestamp,
    type: previous.type
  };
}

async function buildReplayPreview(
  env: AppEnv,
  transaction: CreatedTransaction
): Promise<ScanPreview> {
  const [container, previousTransaction] = await Promise.all([
    getContainerById(env, transaction.containerId),
    getPreviousTransaction(env, transaction)
  ]);

  if (!container) {
    throw new Error("INVALID_CONTAINER");
  }

  return {
    activeApproval: null,
    actionPreview: transaction.action,
    container,
    lastTransaction: previousTransaction,
    rules: getTransactionRules(
      env,
      transaction.action,
      transaction.type,
      transaction.timestamp
    ),
    transactionTypePreview: transaction.type,
    validatedTimestamp: transaction.timestamp
  };
}

async function buildReplayResult(
  env: AppEnv,
  student: StudentRecord,
  transaction: CreatedTransaction
): Promise<{
  consumedApproval: PendingTeacherApproval | null;
  idempotency: {
    replayed: boolean;
    requestId: string | null;
  };
  preview: ScanPreview;
  rules: ReturnType<typeof getTransactionRules>;
  student: StudentRecord;
  transaction: CreatedTransaction;
}> {
  const preview = await buildReplayPreview(env, transaction);

  return {
    consumedApproval: null,
    idempotency: {
      replayed: true,
      requestId: transaction.requestId
    },
    preview,
    rules: preview.rules,
    student,
    transaction
  };
}

function assertRequestIdMatchesTransaction(
  requestId: string,
  existingTransaction: CreatedTransaction,
  input: TransactionInput,
  student: StudentRecord
) {
  const requestedTypeMatches =
    existingTransaction.type === input.type ||
    (input.type === "REGULAR" && existingTransaction.type !== "REGULAR");

  if (
    existingTransaction.requestId !== requestId ||
    existingTransaction.studentId !== student.id ||
    existingTransaction.containerId !== input.containerId ||
    !requestedTypeMatches
  ) {
    throw new Error("REQUEST_ID_CONFLICT");
  }
}

export async function createPhoneTransaction(
  env: AppEnv,
  auth: RequestAuth,
  input: TransactionInput
): Promise<{
  consumedApproval: PendingTeacherApproval | null;
  idempotency: {
    replayed: boolean;
    requestId: string | null;
  };
  preview: ScanPreview;
  rules: ReturnType<typeof getTransactionRules>;
  student: StudentRecord;
  transaction: CreatedTransaction;
}> {
  const targetStudent = await resolveTargetStudent(env, auth, input.studentId);

  if (input.requestId) {
    const existingTransaction = await getTransactionByRequestId(env, input.requestId);

    if (existingTransaction) {
      assertRequestIdMatchesTransaction(
        input.requestId,
        existingTransaction,
        input,
        targetStudent
      );

      return buildReplayResult(env, targetStudent, existingTransaction);
    }
  }

  const preview = await validateScanPayload(env, auth, {
    containerId: input.containerId,
    studentId: targetStudent.id,
    timestamp: input.timestamp,
    qrToken: input.qrToken
  });

  const plan = resolveTransactionPlan(auth, targetStudent, input.type, preview, env);
  const client = createServiceRoleClient(env);

  const now = new Date();
  const validatedTime = new Date(preview.validatedTimestamp);
  const diffMs = now.getTime() - validatedTime.getTime();
  const isLateSync = diffMs > 30 * 60 * 1000; // 30 minutes TTL

  const { data, error } = await client
    .from("phone_transactions")
    .insert({
      action: preview.actionPreview,
      container_id: input.containerId,
      operator_id: plan.operatorId,
      request_id: input.requestId,
      student_id: targetStudent.id,
      timestamp: preview.validatedTimestamp,
      type: plan.effectiveType,
      is_late_sync: isLateSync
    })
    .select(
      "id, student_id, container_id, action, type, timestamp, operator_id, created_at, request_id, is_late_sync"
    )
    .single();

  if (error || !data) {
    if (
      input.requestId &&
      (error?.code === "23505" ||
        error?.message.includes("phone_transactions_request_id_uidx"))
    ) {
      const existingTransaction = await getTransactionByRequestId(env, input.requestId);

      if (existingTransaction) {
        assertRequestIdMatchesTransaction(
          input.requestId,
          existingTransaction,
          input,
          targetStudent
        );

        return buildReplayResult(env, targetStudent, existingTransaction);
      }
    }

    throw new Error(`TRANSACTION_CREATE_FAILED:${error?.message ?? "Unknown error"}`);
  }

  const transaction = mapTransaction(data as TransactionRow);
  let consumedApproval: PendingTeacherApproval | null = null;

  if (
    auth.appUser.role === "student" &&
    preview.activeApproval &&
    transaction.action === "OUT" &&
    transaction.type !== "REGULAR"
  ) {
    try {
      await consumePendingTeacherApproval(env, preview.activeApproval.id, transaction.id);
      consumedApproval = preview.activeApproval;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "TEACHER_APPROVAL_CONSUME_FAILED";
      console.warn(`Teacher approval consume skipped: ${message}`);
    }
  }

  return {
    consumedApproval,
    idempotency: {
      replayed: false,
      requestId: input.requestId
    },
    preview,
    rules: getTransactionRules(
      env,
      transaction.action,
      transaction.type,
      preview.validatedTimestamp,
      consumedApproval
    ),
    student: targetStudent,
    transaction
  };
}
