import type { RequestAuth } from "./auth";
import type { AppEnv, AppRole } from "./env";
import type { RequestMeta } from "./requestMeta";
import { createServiceRoleClient } from "./supabase";

export type AuditSeverity = "INFO" | "WARN" | "ERROR";

export type AuditLogRecord = {
  actorRole: AppRole | "anonymous" | "system";
  actorUserId: string | null;
  containerId: string | null;
  createdAt: string;
  details: Record<string, unknown>;
  eventType: string;
  id: string;
  ipAddress: string | null;
  requestId: string | null;
  routeMethod: string;
  routePath: string;
  severity: AuditSeverity;
  statusCode: number | null;
  studentId: string | null;
  transactionId: string | null;
  userAgent: string | null;
};

type AuditLogRow = {
  actor_role: AuditLogRecord["actorRole"];
  actor_user_id: string | null;
  container_id: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
  event_type: string;
  id: string;
  ip_address: string | null;
  request_id: string | null;
  route_method: string;
  route_path: string;
  severity: AuditSeverity;
  status_code: number | null;
  student_id: string | null;
  transaction_id: string | null;
  user_agent: string | null;
};

type AuditLogInsertRow = {
  actor_role: AuditLogRecord["actorRole"];
  actor_user_id: string | null;
  container_id: string | null;
  details: Record<string, unknown>;
  event_type: string;
  ip_address: string | null;
  request_id: string | null;
  route_method: string;
  route_path: string;
  severity: AuditSeverity;
  status_code: number | null;
  student_id: string | null;
  transaction_id: string | null;
  user_agent: string | null;
};

export type RecordAuditEventInput = {
  actorRole?: AuditLogRecord["actorRole"];
  auth?: RequestAuth | null;
  containerId?: string | null;
  details?: Record<string, unknown>;
  eventType: string;
  requestId?: string | null;
  requestMeta: RequestMeta;
  severity: AuditSeverity;
  statusCode?: number | null;
  studentId?: string | null;
  transactionId?: string | null;
};

function mapAuditLog(row: AuditLogRow): AuditLogRecord {
  return {
    actorRole: row.actor_role,
    actorUserId: row.actor_user_id,
    containerId: row.container_id,
    createdAt: row.created_at,
    details: row.details ?? {},
    eventType: row.event_type,
    id: row.id,
    ipAddress: row.ip_address,
    requestId: row.request_id,
    routeMethod: row.route_method,
    routePath: row.route_path,
    severity: row.severity,
    statusCode: row.status_code,
    studentId: row.student_id,
    transactionId: row.transaction_id,
    userAgent: row.user_agent
  };
}

function resolveActorRole(
  input: RecordAuditEventInput
): AuditLogRecord["actorRole"] {
  if (input.actorRole) {
    return input.actorRole;
  }

  if (input.auth?.appUser.role) {
    return input.auth.appUser.role;
  }

  return "anonymous";
}

function buildDetails(input: RecordAuditEventInput): Record<string, unknown> {
  const actorName = input.auth?.appUser.name ?? null;
  const actorEmail = input.auth?.appUser.email ?? null;

  return {
    actorEmail,
    actorName,
    ...input.details
  };
}

function buildAuditInsertRow(input: RecordAuditEventInput): AuditLogInsertRow {
  return {
    actor_role: resolveActorRole(input),
    actor_user_id: input.auth?.appUser.id ?? null,
    container_id: input.containerId ?? null,
    details: buildDetails(input),
    event_type: input.eventType,
    ip_address: input.requestMeta.clientIp,
    request_id: input.requestId ?? input.requestMeta.requestId,
    route_method: input.requestMeta.method,
    route_path: input.requestMeta.path,
    severity: input.severity,
    status_code: input.statusCode ?? null,
    student_id: input.studentId ?? input.auth?.student?.id ?? null,
    transaction_id: input.transactionId ?? null,
    user_agent: input.requestMeta.userAgent
  };
}

export async function recordAuditEvent(
  env: AppEnv,
  input: RecordAuditEventInput
): Promise<void> {
  await recordAuditEvents(env, [input]);
}

export async function recordAuditEvents(
  env: AppEnv,
  inputs: RecordAuditEventInput[]
): Promise<void> {
  if (inputs.length === 0) {
    return;
  }

  const client = createServiceRoleClient(env);
  const { error } = await client
    .from("audit_logs")
    .insert(inputs.map((item) => buildAuditInsertRow(item)));

  if (error) {
    throw new Error(`AUDIT_LOG_CREATE_FAILED:${error.message}`);
  }
}

export async function safeRecordAuditEvent(
  env: AppEnv,
  input: RecordAuditEventInput
): Promise<void> {
  await safeRecordAuditEvents(env, [input]);
}

export async function safeRecordAuditEvents(
  env: AppEnv,
  inputs: RecordAuditEventInput[]
): Promise<void> {
  try {
    await recordAuditEvents(env, inputs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_AUDIT_ERROR";
    console.warn(`Audit log skipped: ${message}`);
  }
}

export async function listAuditLogs(
  env: AppEnv,
  options?: {
    eventType?: string;
    limit?: number;
    severity?: AuditSeverity | "";
  }
): Promise<AuditLogRecord[]> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const eventType = options?.eventType?.trim() ?? "";
  const severity = options?.severity?.trim() ?? "";
  const client = createServiceRoleClient(env);

  let query = client
    .from("audit_logs")
    .select(
      "id, event_type, severity, request_id, actor_user_id, actor_role, student_id, container_id, transaction_id, route_method, route_path, status_code, ip_address, user_agent, details, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  if (severity === "INFO" || severity === "WARN" || severity === "ERROR") {
    query = query.eq("severity", severity);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`AUDIT_LOGS_FETCH_FAILED:${error.message}`);
  }

  return (data ?? []).map((row) => mapAuditLog(row as AuditLogRow));
}
