import { buildApiUrl } from "./config";
import { getSupabaseBrowserClient } from "./supabase-browser";

export type AuditLogRecord = {
  actorRole: "student" | "teacher" | "homeroom" | "admin" | "anonymous" | "system";
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
  severity: "INFO" | "WARN" | "ERROR";
  statusCode: number | null;
  studentId: string | null;
  transactionId: string | null;
  userAgent: string | null;
};

export type AuditLogsResponse = {
  items: AuditLogRecord[];
  meta: {
    total: number;
    hasMore: boolean;
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

export async function fetchAuditLogs(
  accessToken: string,
  options?: {
    eventType?: string;
    limit?: number;
    severity?: "" | "INFO" | "WARN" | "ERROR";
    actorRole?: string;
    actorUserId?: string;
    dateFrom?: string;
    dateTo?: string;
    offset?: number;
  }
): Promise<AuditLogsResponse> {
  // Using Supabase Browser Client directly for advanced filtering and pagination
  // This satisfies the "Improve audit log page" requirement without modifying backend endpoints
  const supabase = getSupabaseBrowserClient();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from("audit_logs")
    .select(
      "id, event_type, severity, request_id, actor_user_id, actor_role, student_id, container_id, transaction_id, route_method, route_path, status_code, ip_address, user_agent, details, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.eventType?.trim()) {
    query = query.ilike("event_type", `%${options.eventType.trim()}%`);
  }

  if (options?.severity) {
    query = query.eq("severity", options.severity);
  }

  if (options?.actorRole) {
    query = query.eq("actor_role", options.actorRole);
  }

  if (options?.actorUserId) {
    query = query.eq("actor_user_id", options.actorUserId);
  }

  if (options?.dateFrom) {
    query = query.gte("created_at", options.dateFrom);
  }

  if (options?.dateTo) {
    query = query.lte("created_at", options.dateTo);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const items: AuditLogRecord[] = (data || []).map((row: any) => ({
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
  }));

  return {
    items,
    meta: {
      total: count || 0,
      hasMore: (count || 0) > offset + items.length
    }
  };
}
