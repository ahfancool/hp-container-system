import { createServiceRoleClient } from "./supabase";
import type { AppEnv } from "./env";

export type StudentViolation = {
  id: string;
  studentId: string;
  violationType: string;
  timestamp: string;
  resolvedAt: string | null;
  operatorId: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    name: string;
    nis: string;
    className: string;
  };
};

export async function listViolations(
  env: AppEnv,
  options?: { studentId?: string; resolved?: boolean }
): Promise<StudentViolation[]> {
  const client = createServiceRoleClient(env);
  let query = client
    .from("student_violations")
    .select("*, student:students(name, nis, class_name)")
    .order("timestamp", { ascending: false });

  if (options?.studentId) {
    query = query.eq("student_id", options.studentId);
  }

  if (options?.resolved !== undefined) {
    if (options.resolved) {
      query = query.not("resolved_at", "is", null);
    } else {
      query = query.is("resolved_at", null);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`VIOLATIONS_FETCH_FAILED:${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    violationType: row.violation_type,
    timestamp: row.timestamp,
    resolvedAt: row.resolved_at,
    operatorId: row.operator_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    student: row.student ? {
      name: row.student.name,
      nis: row.student.nis,
      className: row.student.class_name
    } : undefined
  }));
}

export async function createViolation(
  env: AppEnv,
  input: {
    studentId: string;
    violationType: string;
    operatorId?: string;
    timestamp?: string;
  }
): Promise<StudentViolation> {
  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("student_violations")
    .insert({
      student_id: input.studentId,
      violation_type: input.violationType,
      operator_id: input.operatorId || null,
      timestamp: input.timestamp || new Date().toISOString()
    })
    .select("*, student:students(name, nis, class_name)")
    .single();

  if (error || !data) {
    throw new Error(`VIOLATION_CREATE_FAILED:${error?.message ?? "Unknown error"}`);
  }

  return {
    id: data.id,
    studentId: data.student_id,
    violationType: data.violation_type,
    timestamp: data.timestamp,
    resolvedAt: data.resolved_at,
    operatorId: data.operator_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    student: data.student ? {
      name: data.student.name,
      nis: data.student.nis,
      className: data.student.class_name
    } : undefined
  };
}

export async function resolveViolation(
  env: AppEnv,
  violationId: string,
  operatorId: string
): Promise<void> {
  const client = createServiceRoleClient(env);
  const { error } = await client
    .from("student_violations")
    .update({
      resolved_at: new Date().toISOString(),
      operator_id: operatorId
    })
    .eq("id", violationId);

  if (error) {
    throw new Error(`VIOLATION_RESOLVE_FAILED:${error.message}`);
  }
}

export async function detectMissingScanIn(env: AppEnv): Promise<number> {
  const client = createServiceRoleClient(env);
  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];
  
  // 1. Get all active students
  const { data: students, error: sError } = await client
    .from("students")
    .select("id, name")
    .eq("is_active", true);
    
  if (sError) throw new Error(`Fetch students failed: ${sError.message}`);

  // 2. Get today's transactions
  const { data: transactions, error: tError } = await client
    .from("phone_transactions")
    .select("student_id, action")
    .gte("timestamp", `${todayISO}T00:00:00Z`)
    .lte("timestamp", `${todayISO}T23:59:59Z`);

  if (tError) throw new Error(`Fetch transactions failed: ${tError.message}`);

  const studentsWithScanIn = new Set(
    transactions.filter(t => t.action === 'IN').map(t => t.student_id)
  );

  let detectedCount = 0;
  for (const student of students) {
    if (!studentsWithScanIn.has(student.id)) {
      // Check if already has an unresolved 'MISSING_SCAN_IN' for today
      const { data: existing } = await client
        .from("student_violations")
        .select("id")
        .eq("student_id", student.id)
        .eq("violation_type", "MISSING_SCAN_IN")
        .is("resolved_at", null)
        .gte("timestamp", `${todayISO}T00:00:00Z`)
        .maybeSingle();

      if (!existing) {
        await createViolation(env, {
          studentId: student.id,
          violationType: "MISSING_SCAN_IN",
          timestamp: new Date().toISOString()
        });
        detectedCount++;
      }
    }
  }

  return detectedCount;
}
