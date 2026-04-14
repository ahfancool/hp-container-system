import type { AuthorizedRequestContext } from "../middleware/auth";
import { listAuditLogs, safeRecordAuditEvent } from "../services/audit";
import type { AppEnv } from "../services/env";
import { failure, success } from "../services/json";

function parseLimit(request: Request): number {
  const url = new URL(request.url);
  const rawValue = url.searchParams.get("limit");

  if (!rawValue) {
    return 50;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("INVALID_LIMIT");
  }

  return parsed;
}

function parseSeverity(request: Request): "" | "INFO" | "WARN" | "ERROR" {
  const url = new URL(request.url);
  const rawValue = url.searchParams.get("severity")?.trim().toUpperCase() ?? "";

  if (!rawValue) {
    return "";
  }

  if (rawValue === "INFO" || rawValue === "WARN" || rawValue === "ERROR") {
    return rawValue;
  }

  throw new Error("INVALID_SEVERITY");
}

function parseEventType(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("eventType")?.trim() ?? "";
}

export async function getAuditLogs(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  try {
    const limit = parseLimit(request);
    const severity = parseSeverity(request);
    const eventType = parseEventType(request);
    const items = await listAuditLogs(env, {
      eventType,
      limit,
      severity
    });

    await safeRecordAuditEvent(env, {
      auth: context.auth,
      details: {
        eventType,
        fetchedCount: items.length,
        limit,
        severity
      },
      eventType: "audit.logs_viewed",
      requestMeta: context.requestMeta,
      severity: "INFO",
      statusCode: 200
    });

    return success(
      {
        items,
        meta: {
          authorizedRole: context.auth?.appUser.role ?? null,
          eventType,
          limit: Math.min(limit, 200),
          severity,
          total: items.length
        }
      },
      200,
      origin
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (message === "INVALID_LIMIT" || message === "INVALID_SEVERITY") {
      return failure(message, 400, origin, {
        message:
          "Query parameter `limit` harus angka positif, dan `severity` hanya boleh INFO, WARN, atau ERROR."
      });
    }

    if (message.startsWith("AUDIT_LOGS_FETCH_FAILED:")) {
      return failure("AUDIT_LOGS_FETCH_FAILED", 500, origin, {
        message: message.replace("AUDIT_LOGS_FETCH_FAILED:", "")
      });
    }

    return failure("INTERNAL_ERROR", 500, origin, {
      message
    });
  }
}
