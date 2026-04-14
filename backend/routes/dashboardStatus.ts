import type { AuthorizedRequestContext } from "../middleware/auth";
import { getDashboardCacheTtlSeconds, type AppEnv } from "../services/env";
import { readEdgeJson, writeEdgeJson } from "../services/edgeCache";
import { getDashboardStatusData } from "../services/dashboard";
import { failure, success } from "../services/json";

export async function getDashboardStatus(
  _request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  if (!context.auth) {
    return failure("UNAUTHORIZED_ACTION", 401, origin);
  }

  const snapshotTtlSeconds = getDashboardCacheTtlSeconds(env);
  const cacheKey = `v1:${context.auth.appUser.role}`;
  const cached = await readEdgeJson<Record<string, unknown>>(
    "dashboard-status",
    cacheKey
  );

  if (cached.status === "HIT" && cached.data) {
    return success(
      {
        ...cached.data,
        performance: {
          snapshotCache: cached.status,
          snapshotTtlSeconds
        }
      },
      200,
      origin
    );
  }

  try {
    const payload = await getDashboardStatusData(env, context.auth.appUser.role);

    await writeEdgeJson("dashboard-status", cacheKey, payload, snapshotTtlSeconds);

    return success(
      {
        ...payload,
        performance: {
          snapshotCache: cached.status === "SKIP" ? "SKIP" : "MISS",
          snapshotTtlSeconds
        }
      },
      200,
      origin
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (
      message.startsWith("STUDENTS_FETCH_FAILED:") ||
      message.startsWith("STUDENT_LATEST_TRANSACTIONS_FETCH_FAILED:") ||
      message.startsWith("CONTAINERS_FETCH_FAILED:") ||
      message.startsWith("DASHBOARD_RECENT_FETCH_FAILED:") ||
      message.startsWith("DASHBOARD_OPERATORS_FETCH_FAILED:") ||
      message.startsWith("DASHBOARD_STUDENTS_LOOKUP_FAILED:")
    ) {
      return failure("DASHBOARD_FETCH_FAILED", 500, origin, {
        message: message.replace(
          /^(STUDENTS_FETCH_FAILED:|STUDENT_LATEST_TRANSACTIONS_FETCH_FAILED:|CONTAINERS_FETCH_FAILED:|DASHBOARD_RECENT_FETCH_FAILED:|DASHBOARD_OPERATORS_FETCH_FAILED:|DASHBOARD_STUDENTS_LOOKUP_FAILED:)/,
          ""
        )
      });
    }

    return failure("INTERNAL_ERROR", 500, origin, {
      message
    });
  }
}
