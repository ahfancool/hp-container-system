import type { RequestAuth } from "./auth";
import { getContainerById, type ContainerRecord } from "./containers";
import type { AppEnv, AppRole } from "./env";
import { getStudentById, type StudentRecord } from "./students";
import { createServiceRoleClient } from "./supabase";

export type ApprovalType = "PEMBELAJARAN" | "DARURAT";

type ApprovalRow = {
  approved_at: string;
  approved_by: string;
  container_id: string;
  consumed_transaction_id: string | null;
  created_at: string;
  id: string;
  request_id: string | null;
  status: "PENDING" | "USED" | "CANCELLED";
  student_id: string;
  type: ApprovalType;
  updated_at: string;
  used_at: string | null;
};

type UserRow = {
  id: string;
  name: string;
  role: AppRole;
};

export type PendingTeacherApproval = {
  approvedAt: string;
  approvedBy: {
    id: string;
    name: string;
    role: AppRole;
  };
  container: ContainerRecord;
  id: string;
  requestId: string | null;
  studentId: string;
  type: ApprovalType;
  updatedAt: string;
};

export type TeacherApprovalResult = {
  approval: PendingTeacherApproval;
  idempotency: {
    replayed: boolean;
    requestId: string | null;
  };
  replacedExisting: boolean;
  status: "created" | "updated" | "replayed";
  student: StudentRecord;
};

type StudentLookupRow = {
  class_name: string;
  grade_level: string;
  id: string;
  is_active: boolean;
  major: string | null;
  name: string;
  nis: string;
  user_id: string | null;
};

type BulkApprovalRpcResult =
  | "CREATED"
  | "UPDATED"
  | "REPLAYED"
  | "SKIPPED_INVALID_STATE"
  | "SKIPPED_INACTIVE"
  | "SKIPPED_NOT_FOUND"
  | "SKIPPED_REQUEST_CONFLICT";

type BulkApprovalRpcRow = {
  approval_id: string | null;
  approval_request_id: string | null;
  approval_status: ApprovalRow["status"] | null;
  approved_at: string | null;
  latest_action: "IN" | "OUT" | null;
  result: BulkApprovalRpcResult;
  student_id: string;
  updated_at: string | null;
};

export type BulkTeacherApprovalItemStatus =
  | "created"
  | "updated"
  | "replayed"
  | "skipped_invalid_state"
  | "skipped_inactive"
  | "skipped_not_found"
  | "skipped_request_conflict";

export type BulkTeacherApprovalItem = {
  approval: PendingTeacherApproval | null;
  message: string;
  result: BulkTeacherApprovalItemStatus;
  student: {
    className: string | null;
    id: string;
    name: string | null;
    nis: string | null;
  };
};

export type BulkTeacherApprovalResult = {
  container: ContainerRecord;
  idempotency: {
    requestId: string | null;
  };
  items: BulkTeacherApprovalItem[];
  summary: {
    createdCount: number;
    processedCount: number;
    replayedCount: number;
    requestedCount: number;
    skippedCount: number;
    updatedCount: number;
  };
};

function isTeacherApprovalsSchemaMissingMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    (normalized.includes("teacher_approvals") ||
      normalized.includes("bulk_upsert_teacher_approvals")) &&
    (normalized.includes("schema cache") ||
      normalized.includes("does not exist") ||
      normalized.includes("could not find the table") ||
      normalized.includes("could not find the function"))
  );
}

function wrapTeacherApprovalError(prefix: string, message: string): never {
  if (isTeacherApprovalsSchemaMissingMessage(message)) {
    throw new Error("TEACHER_APPROVALS_SCHEMA_MISSING");
  }

  throw new Error(`${prefix}:${message}`);
}

function assertStaffRole(auth: RequestAuth) {
  if (
    auth.appUser.role !== "teacher" &&
    auth.appUser.role !== "homeroom" &&
    auth.appUser.role !== "admin"
  ) {
    throw new Error("UNAUTHORIZED_ACTION");
  }
}

function mapPendingApproval(
  row: ApprovalRow,
  container: ContainerRecord,
  approvedBy: UserRow
): PendingTeacherApproval {
  return {
    approvedAt: row.approved_at,
    approvedBy: {
      id: approvedBy.id,
      name: approvedBy.name,
      role: approvedBy.role
    },
    container,
    id: row.id,
    requestId: row.request_id,
    studentId: row.student_id,
    type: row.type,
    updatedAt: row.updated_at
  };
}

function mapStudentLookupRow(row: StudentLookupRow): StudentRecord {
  return {
    className: row.class_name,
    deviceFingerprint: null,
    fingerprintUpdatedAt: null,
    gradeLevel: row.grade_level,
    id: row.id,
    isActive: row.is_active,
    major: row.major,
    name: row.name,
    nis: row.nis,
    userId: row.user_id
  };
}

function mapBulkApprovalResult(
  result: BulkApprovalRpcResult
): BulkTeacherApprovalItemStatus {
  switch (result) {
    case "CREATED":
      return "created";
    case "UPDATED":
      return "updated";
    case "REPLAYED":
      return "replayed";
    case "SKIPPED_INACTIVE":
      return "skipped_inactive";
    case "SKIPPED_NOT_FOUND":
      return "skipped_not_found";
    case "SKIPPED_REQUEST_CONFLICT":
      return "skipped_request_conflict";
    default:
      return "skipped_invalid_state";
  }
}

function buildBulkApprovalMessage(
  result: BulkTeacherApprovalItemStatus,
  latestAction: "IN" | "OUT" | null
): string {
  if (result === "created") {
    return "Approval aktif. Minta siswa scan container untuk menyelesaikan transaksi keluar.";
  }

  if (result === "updated") {
    return "Approval aktif sebelumnya diperbarui dengan container atau tipe terbaru.";
  }

  if (result === "replayed") {
    return "Request approval yang sama sudah pernah diproses. Approval aktif sebelumnya dikembalikan tanpa perubahan baru.";
  }

  if (result === "skipped_inactive") {
    return "Siswa tidak aktif sehingga approval massal dilewati.";
  }

  if (result === "skipped_not_found") {
    return "Siswa tidak ditemukan pada data aktif sistem.";
  }

  if (result === "skipped_request_conflict") {
    return "request_id bulk ini berbenturan dengan approval lain yang berbeda, jadi siswa ini dilewati.";
  }

  if (latestAction === "OUT") {
    return "Siswa sedang berada di luar container, jadi approval keluar tidak diaktifkan ulang.";
  }

  return "Siswa belum memiliki transaksi IN terakhir yang valid, jadi approval keluar tidak dapat dibuat.";
}

async function hydratePendingApprovals(
  env: AppEnv,
  rows: ApprovalRow[]
): Promise<PendingTeacherApproval[]> {
  if (rows.length === 0) {
    return [];
  }

  const client = createServiceRoleClient(env);
  const uniqueContainerIds = [...new Set(rows.map((row) => row.container_id))];
  const uniqueUserIds = [...new Set(rows.map((row) => row.approved_by))];

  const [containerData, userData] = await Promise.all([
    Promise.all(uniqueContainerIds.map((containerId) => getContainerById(env, containerId))),
    client.from("users").select("id, name, role").in("id", uniqueUserIds)
  ]);

  const containerMap = new Map<string, ContainerRecord>();

  for (const container of containerData) {
    if (container) {
      containerMap.set(container.id, container);
    }
  }

  if (userData.error) {
    throw new Error(`TEACHER_APPROVAL_USERS_FETCH_FAILED:${userData.error.message}`);
  }

  const approvedByMap = new Map<string, UserRow>();

  for (const row of userData.data ?? []) {
    const user = row as UserRow;
    approvedByMap.set(user.id, user);
  }

  return rows
    .map((row) => {
      const container = containerMap.get(row.container_id);
      const approvedBy = approvedByMap.get(row.approved_by);

      if (!container || !approvedBy) {
        return null;
      }

      return mapPendingApproval(row, container, approvedBy);
    })
    .filter((item): item is PendingTeacherApproval => Boolean(item));
}

async function getApprovalByRequestId(
  env: AppEnv,
  requestId: string
): Promise<ApprovalRow | null> {
  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("teacher_approvals")
    .select(
      "id, student_id, container_id, type, approved_by, approved_at, status, request_id, consumed_transaction_id, used_at, created_at, updated_at"
    )
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) {
    wrapTeacherApprovalError("TEACHER_APPROVAL_LOOKUP_FAILED", error.message);
  }

  if (!data) {
    return null;
  }

  return data as ApprovalRow;
}

async function getPendingApprovalRowByStudent(
  env: AppEnv,
  studentId: string
): Promise<ApprovalRow | null> {
  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("teacher_approvals")
    .select(
      "id, student_id, container_id, type, approved_by, approved_at, status, request_id, consumed_transaction_id, used_at, created_at, updated_at"
    )
    .eq("student_id", studentId)
    .eq("status", "PENDING")
    .maybeSingle();

  if (error) {
    wrapTeacherApprovalError("TEACHER_APPROVAL_LOOKUP_FAILED", error.message);
  }

  if (!data) {
    return null;
  }

  return data as ApprovalRow;
}

async function getLatestActionForStudent(
  env: AppEnv,
  studentId: string
): Promise<"IN" | "OUT" | null> {
  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("phone_transactions")
    .select("action, timestamp, created_at")
    .eq("student_id", studentId)
    .order("timestamp", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`TEACHER_APPROVAL_STATE_LOOKUP_FAILED:${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data.action as "IN" | "OUT";
}

function assertRequestIdMatchesApproval(
  requestId: string,
  approval: ApprovalRow,
  input: {
    containerId: string;
    studentId: string;
    type: ApprovalType;
  }
) {
  if (
    approval.request_id !== requestId ||
    approval.student_id !== input.studentId ||
    approval.container_id !== input.containerId ||
    approval.type !== input.type
  ) {
    throw new Error("REQUEST_ID_CONFLICT");
  }
}

async function listStudentsByIds(
  env: AppEnv,
  studentIds: string[]
): Promise<StudentRecord[]> {
  if (studentIds.length === 0) {
    return [];
  }

  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("students")
    .select("id, user_id, nis, name, class_name, major, grade_level, is_active")
    .in("id", studentIds);

  if (error) {
    throw new Error(`STUDENT_FETCH_FAILED:${error.message}`);
  }

  return (data ?? []).map((row) => mapStudentLookupRow(row as StudentLookupRow));
}

function buildBulkPendingApproval(
  row: BulkApprovalRpcRow,
  auth: RequestAuth,
  container: ContainerRecord,
  type: ApprovalType
): PendingTeacherApproval | null {
  if (
    !row.approval_id ||
    !row.approved_at ||
    !row.updated_at ||
    row.approval_status !== "PENDING"
  ) {
    return null;
  }

  return {
    approvedAt: row.approved_at,
    approvedBy: {
      id: auth.appUser.id,
      name: auth.appUser.name,
      role: auth.appUser.role
    },
    container,
    id: row.approval_id,
    requestId: row.approval_request_id,
    studentId: row.student_id,
    type,
    updatedAt: row.updated_at
  };
}

function dedupeStudentIds(studentIds: string[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const studentId of studentIds) {
    if (!seen.has(studentId)) {
      seen.add(studentId);
      items.push(studentId);
    }
  }

  return items;
}

export async function getPendingTeacherApprovalByStudent(
  env: AppEnv,
  studentId: string
): Promise<PendingTeacherApproval | null> {
  let row: ApprovalRow | null = null;

  try {
    row = await getPendingApprovalRowByStudent(env, studentId);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "TEACHER_APPROVALS_SCHEMA_MISSING"
    ) {
      return null;
    }

    throw error;
  }

  if (!row) {
    return null;
  }

  const [approval] = await hydratePendingApprovals(env, [row]);
  return approval ?? null;
}

export async function listPendingTeacherApprovalsByStudentIds(
  env: AppEnv,
  studentIds: string[]
): Promise<Map<string, PendingTeacherApproval>> {
  if (studentIds.length === 0) {
    return new Map();
  }

  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("teacher_approvals")
    .select(
      "id, student_id, container_id, type, approved_by, approved_at, status, request_id, consumed_transaction_id, used_at, created_at, updated_at"
    )
    .in("student_id", studentIds)
    .eq("status", "PENDING");

  if (error) {
    if (isTeacherApprovalsSchemaMissingMessage(error.message)) {
      return new Map();
    }

    throw new Error(`TEACHER_APPROVALS_FETCH_FAILED:${error.message}`);
  }

  const approvals = await hydratePendingApprovals(env, (data ?? []) as ApprovalRow[]);
  return new Map(approvals.map((approval) => [approval.studentId, approval]));
}

export async function createBulkTeacherApprovals(
  env: AppEnv,
  auth: RequestAuth,
  input: {
    containerId: string;
    requestId: string | null;
    studentIds: string[];
    timestamp: string;
    type: ApprovalType;
  }
): Promise<BulkTeacherApprovalResult> {
  assertStaffRole(auth);

  const studentIds = dedupeStudentIds(input.studentIds);

  if (studentIds.length === 0) {
    throw new Error("INVALID_STUDENT_IDS");
  }

  const [container, students] = await Promise.all([
    getContainerById(env, input.containerId),
    listStudentsByIds(env, studentIds)
  ]);

  if (!container || !container.isActive) {
    throw new Error("INVALID_CONTAINER");
  }

  const studentMap = new Map(students.map((student) => [student.id, student]));
  const client = createServiceRoleClient(env);
  const { data, error } = await client.rpc("bulk_upsert_teacher_approvals", {
    p_approval_type: input.type,
    p_approved_at: input.timestamp,
    p_approved_by: auth.appUser.id,
    p_bulk_request_id: input.requestId,
    p_container_id: input.containerId,
    p_student_ids: studentIds
  });

  if (error) {
    wrapTeacherApprovalError("TEACHER_APPROVAL_BULK_FAILED", error.message);
  }

  const resultRows = new Map(
    ((data ?? []) as BulkApprovalRpcRow[]).map((row) => [row.student_id, row])
  );
  const items = studentIds.map((studentId) => {
    const row =
      resultRows.get(studentId) ??
      ({
        approval_id: null,
        approval_request_id: null,
        approval_status: null,
        approved_at: null,
        latest_action: null,
        result: "SKIPPED_NOT_FOUND",
        student_id: studentId,
        updated_at: null
      } satisfies BulkApprovalRpcRow);
    const result = mapBulkApprovalResult(row.result);
    const student = studentMap.get(studentId);

    return {
      approval: buildBulkPendingApproval(row, auth, container, input.type),
      message: buildBulkApprovalMessage(result, row.latest_action),
      result,
      student: {
        className: student?.className ?? null,
        id: studentId,
        name: student?.name ?? null,
        nis: student?.nis ?? null
      }
    };
  });

  const summary = items.reduce(
    (accumulator, item) => {
      if (item.result === "created") {
        accumulator.createdCount += 1;
      } else if (item.result === "updated") {
        accumulator.updatedCount += 1;
      } else if (item.result === "replayed") {
        accumulator.replayedCount += 1;
      } else {
        accumulator.skippedCount += 1;
      }

      return accumulator;
    },
    {
      createdCount: 0,
      processedCount: 0,
      replayedCount: 0,
      requestedCount: studentIds.length,
      skippedCount: 0,
      updatedCount: 0
    }
  );

  summary.processedCount =
    summary.createdCount + summary.updatedCount + summary.replayedCount;

  return {
    container,
    idempotency: {
      requestId: input.requestId
    },
    items,
    summary
  };
}

export async function createOrReplaceTeacherApproval(
  env: AppEnv,
  auth: RequestAuth,
  input: {
    containerId: string;
    requestId: string | null;
    studentId: string;
    timestamp: string;
    type: ApprovalType;
  }
): Promise<TeacherApprovalResult> {
  assertStaffRole(auth);

  const [student, container] = await Promise.all([
    getStudentById(env, input.studentId),
    getContainerById(env, input.containerId)
  ]);

  if (!student || !student.isActive) {
    throw new Error("STUDENT_NOT_FOUND");
  }

  if (!container || !container.isActive) {
    throw new Error("INVALID_CONTAINER");
  }

  const latestAction = await getLatestActionForStudent(env, student.id);

  if (latestAction !== "IN") {
    throw new Error("INVALID_APPROVAL_STATE");
  }

  if (input.requestId) {
    const existingByRequestId = await getApprovalByRequestId(env, input.requestId);

    if (existingByRequestId) {
      assertRequestIdMatchesApproval(input.requestId, existingByRequestId, input);
      const [approval] = await hydratePendingApprovals(env, [existingByRequestId]);

      if (!approval) {
        throw new Error("TEACHER_APPROVAL_LOOKUP_FAILED:Approval replay not found.");
      }

      return {
        approval,
        idempotency: {
          replayed: true,
          requestId: input.requestId
        },
        replacedExisting: false,
        status: "replayed",
        student
      };
    }
  }

  const existingPendingApproval = await getPendingApprovalRowByStudent(env, student.id);
  const client = createServiceRoleClient(env);

  let approvalRow: ApprovalRow | null = null;
  let replacedExisting = false;

  if (existingPendingApproval) {
    replacedExisting = true;
    const { data, error } = await client
      .from("teacher_approvals")
      .update({
        approved_at: input.timestamp,
        approved_by: auth.appUser.id,
        container_id: input.containerId,
        request_id: input.requestId,
        type: input.type
      })
      .eq("id", existingPendingApproval.id)
      .select(
        "id, student_id, container_id, type, approved_by, approved_at, status, request_id, consumed_transaction_id, used_at, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      wrapTeacherApprovalError(
        "TEACHER_APPROVAL_SAVE_FAILED",
        error?.message ?? "Unknown error"
      );
    }

    approvalRow = data as ApprovalRow;
  } else {
    const { data, error } = await client
      .from("teacher_approvals")
      .insert({
        approved_at: input.timestamp,
        approved_by: auth.appUser.id,
        container_id: input.containerId,
        request_id: input.requestId,
        status: "PENDING",
        student_id: student.id,
        type: input.type
      })
      .select(
        "id, student_id, container_id, type, approved_by, approved_at, status, request_id, consumed_transaction_id, used_at, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      wrapTeacherApprovalError(
        "TEACHER_APPROVAL_SAVE_FAILED",
        error?.message ?? "Unknown error"
      );
    }

    approvalRow = data as ApprovalRow;
  }

  const [approval] = await hydratePendingApprovals(env, [approvalRow]);

  if (!approval) {
    throw new Error("TEACHER_APPROVAL_LOOKUP_FAILED:Approval result not found.");
  }

  return {
    approval,
    idempotency: {
      replayed: false,
      requestId: input.requestId
    },
    replacedExisting,
    status: replacedExisting ? "updated" : "created",
    student
  };
}

export async function consumePendingTeacherApproval(
  env: AppEnv,
  approvalId: string,
  transactionId: string
): Promise<void> {
  const client = createServiceRoleClient(env);
  const { error } = await client
    .from("teacher_approvals")
    .update({
      consumed_transaction_id: transactionId,
      status: "USED",
      used_at: new Date().toISOString()
    })
    .eq("id", approvalId)
    .eq("status", "PENDING");

  if (error) {
    wrapTeacherApprovalError("TEACHER_APPROVAL_CONSUME_FAILED", error.message);
  }
}
