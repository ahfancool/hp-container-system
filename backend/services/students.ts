import type { AppEnv } from "./env";
import {
  listPendingTeacherApprovalsByStudentIds,
  type PendingTeacherApproval
} from "./teacherApprovals";
import { createServiceRoleClient } from "./supabase";

export type StudentRecord = {
  className: string;
  deviceFingerprint: string | null;
  fingerprintUpdatedAt: string | null;
  gradeLevel: string;
  id: string;
  isActive: boolean;
  major: string | null;
  name: string;
  nis: string;
  userId: string | null;
};

export type StudentPhoneStatus = "INSIDE" | "OUTSIDE" | "NOT_SCANNED";

export type StudentLatestTransaction = {
  action: "IN" | "OUT";
  containerId: string;
  timestamp: string;
  type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
} | null;

export type StudentListItem = StudentRecord & {
  latestTransaction: StudentLatestTransaction;
  nextExpectedAction: "IN" | "OUT";
  pendingApproval: PendingTeacherApproval | null;
  phoneStatus: StudentPhoneStatus;
  readyForTeacherOverride: boolean;
};

type StudentRow = {
  class_name: string;
  device_fingerprint: string | null;
  fingerprint_updated_at: string | null;
  grade_level: string;
  id: string;
  is_active: boolean;
  major: string | null;
  name: string;
  nis: string;
  user_id: string | null;
};

type StudentTransactionRow = {
  action: "IN" | "OUT";
  container_id: string;
  created_at: string;
  request_id: string | null;
  student_id: string;
  timestamp: string;
  type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
  operator_id: string | null;
};

function mapStudent(row: StudentRow): StudentRecord {
  return {
    className: row.class_name,
    deviceFingerprint: row.device_fingerprint,
    fingerprintUpdatedAt: row.fingerprint_updated_at,
    gradeLevel: row.grade_level,
    id: row.id,
    isActive: row.is_active,
    major: row.major,
    name: row.name,
    nis: row.nis,
    userId: row.user_id
  };
}

function matchesSearch(student: StudentRecord, search: string): boolean {
  if (!search) {
    return true;
  }

  const haystack = [
    student.name,
    student.nis,
    student.className,
    student.gradeLevel,
    student.major ?? ""
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

function buildStudentListItem(
  student: StudentRecord,
  latestTransaction: StudentLatestTransaction,
  pendingApproval: PendingTeacherApproval | null
): StudentListItem {
  const nextExpectedAction = latestTransaction?.action === "IN" ? "OUT" : "IN";
  const phoneStatus: StudentPhoneStatus = latestTransaction
    ? latestTransaction.action === "IN"
      ? "INSIDE"
      : "OUTSIDE"
    : "NOT_SCANNED";

  return {
    ...student,
    latestTransaction,
    nextExpectedAction,
    pendingApproval,
    phoneStatus,
    readyForTeacherOverride: nextExpectedAction === "OUT" && !pendingApproval
  };
}

export type StudentMinimalRecord = {
  className: string;
  id: string;
  name: string;
  nis: string;
};

export async function listMinimalStudents(
  env: AppEnv
): Promise<StudentMinimalRecord[]> {
  const client = createServiceRoleClient(env);

  const { data, error } = await client
    .from("students")
    .select("id, name, nis, class_name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`STUDENTS_MINIMAL_FETCH_FAILED:${error.message}`);
  }

  return (data ?? []).map((row) => ({
    className: row.class_name,
    id: row.id,
    name: row.name,
    nis: row.nis
  }));
}

export async function getStudentById(
  env: AppEnv,
  studentId: string
): Promise<StudentRecord | null> {
  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("students")
    .select("id, user_id, nis, name, class_name, major, grade_level, is_active, device_fingerprint, fingerprint_updated_at")
    .eq("id", studentId)
    .maybeSingle();

  if (error) {
    throw new Error(`STUDENT_FETCH_FAILED:${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapStudent(data as StudentRow);
}

export async function updateStudentFingerprint(
  env: AppEnv,
  studentId: string,
  fingerprint: string
): Promise<void> {
  const client = createServiceRoleClient(env);
  const { error } = await client
    .from("students")
    .update({
      device_fingerprint: fingerprint,
      fingerprint_updated_at: new Date().toISOString()
    })
    .eq("id", studentId);

  if (error) {
    throw new Error(`STUDENT_FINGERPRINT_UPDATE_FAILED:${error.message}`);
  }
}

export async function verifyStudentFingerprint(
  env: AppEnv,
  studentId: string,
  fingerprint: string
): Promise<{ isValid: boolean; storedFingerprint: string | null }> {
  const student = await getStudentById(env, studentId);

  if (!student) {
    return { isValid: false, storedFingerprint: null };
  }

  // If no fingerprint stored yet, allow it (first device registration)
  if (!student.deviceFingerprint) {
    return { isValid: true, storedFingerprint: null };
  }

  return {
    isValid: student.deviceFingerprint === fingerprint,
    storedFingerprint: student.deviceFingerprint
  };
}

export async function listStudents(
  env: AppEnv,
  options?: {
    includeInactive?: boolean;
    search?: string;
  }
): Promise<StudentListItem[]> {
  const includeInactive = options?.includeInactive ?? false;
  const search = options?.search?.trim().toLowerCase() ?? "";
  const client = createServiceRoleClient(env);

  let query = client
    .from("students")
    .select("id, user_id, nis, name, class_name, major, grade_level, is_active, device_fingerprint, fingerprint_updated_at")
    .order("class_name", { ascending: true })
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`STUDENTS_FETCH_FAILED:${error.message}`);
  }

  const students = (data ?? [])
    .map((row) => mapStudent(row as StudentRow))
    .filter((student) => matchesSearch(student, search));

  if (students.length === 0) {
    return [];
  }

  const studentIds = students.map((student) => student.id);
  const { data: transactionData, error: transactionError } = await client.rpc(
    "latest_student_transactions",
    {
      student_ids: studentIds
    }
  );

  if (transactionError) {
    throw new Error(
      `STUDENT_LATEST_TRANSACTIONS_FETCH_FAILED:${transactionError.message}`
    );
  }

  const latestByStudent = new Map<string, StudentLatestTransaction>();

  for (const row of transactionData ?? []) {
    const item = row as StudentTransactionRow;

    if (latestByStudent.has(item.student_id)) {
      continue;
    }

    latestByStudent.set(item.student_id, {
      action: item.action,
      containerId: item.container_id,
      timestamp: item.timestamp,
      type: item.type
    });
  }

  const pendingApprovalsByStudent = await listPendingTeacherApprovalsByStudentIds(
    env,
    studentIds
  );

  return students.map((student) =>
    buildStudentListItem(
      student,
      latestByStudent.get(student.id) ?? null,
      pendingApprovalsByStudent.get(student.id) ?? null
    )
  );
}
