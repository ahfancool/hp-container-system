import { buildApiUrl } from "./config";

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

type AuditLogsResponse = {
  data: {
    items: AuditLogRecord[];
    meta: {
      authorizedRole: string | null;
      eventType: string;
      limit: number;
      severity: "" | "INFO" | "WARN" | "ERROR";
      total: number;
    };
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
  }
): Promise<AuditLogsResponse["data"]> {
  const params = new URLSearchParams();

  if (options?.eventType?.trim()) {
    params.set("eventType", options.eventType.trim());
  }

  if (options?.severity) {
    params.set("severity", options.severity);
  }

  params.set("limit", String(options?.limit ?? 50));

  const response = await fetch(buildApiUrl(`/audit/logs?${params.toString()}`), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as AuditLogsResponse;
  return payload.data;
}
