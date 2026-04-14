import { authorizeRequest } from "../middleware/auth";
import { createPreflightResponse, resolveOrigin } from "../middleware/cors";
import { withErrorBoundary } from "../middleware/errors";
import { routeTable } from "../routes";
import { safeRecordAuditEvent } from "../services/audit";
import { archiveAuditLogs } from "../services/archive";
import type { AppEnv } from "../services/env";
import { failure } from "../services/json";
import {
  enforceRouteRateLimit,
  type RateLimitDecision
} from "../services/rateLimit";
import { createRequestMeta } from "../services/requestMeta";
import { sendWeeklyReport } from "../services/reports";
import { detectMissingScanIn } from "../services/violations";

function normalizePathname(pathname: string): string {
  if (pathname.length > 1) {
    return pathname.replace(/\/+$/, "");
  }

  return pathname;
}

function buildRouteKey(request: Request): string {
  const url = new URL(request.url);
  return `${request.method.toUpperCase()} ${normalizePathname(url.pathname)}`;
}

function attachResponseMetadata(
  response: Response,
  requestId: string,
  rateLimitDecision?: RateLimitDecision | null
): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);

  if (rateLimitDecision) {
    headers.set("x-rate-limit-limit", String(rateLimitDecision.limit));
    headers.set("x-rate-limit-remaining", String(rateLimitDecision.remaining));
    headers.set(
      "x-rate-limit-retry-after-seconds",
      String(rateLimitDecision.retryAfterSeconds)
    );
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  });
}

export default {
  async fetch(
    request: Request,
    env: AppEnv,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const origin = resolveOrigin(request, env.ALLOWED_ORIGIN);
    const requestMeta = createRequestMeta(request);

    if (request.method.toUpperCase() === "OPTIONS") {
      return attachResponseMetadata(
        createPreflightResponse(origin),
        requestMeta.requestId
      );
    }

    const routeKey = buildRouteKey(request);
    const route = routeTable[routeKey];

    if (!route) {
      return attachResponseMetadata(
        failure("ROUTE_NOT_FOUND", 404, origin, {
          method: requestMeta.method,
          path: requestMeta.path
        }),
        requestMeta.requestId
      );
    }

    let rateLimitDecision: RateLimitDecision | null = null;

    const response = await withErrorBoundary(async () => {
      const authResult = await authorizeRequest(
        request,
        env,
        origin,
        route.access,
        requestMeta
      );

      if (!authResult.ok) {
        return authResult.response;
      }

      const context = authResult.context;

      if (route.rateLimit) {
        rateLimitDecision = await enforceRouteRateLimit(
          env,
          routeKey,
          route.rateLimit,
          context
        );

        if (!rateLimitDecision.allowed) {
          await safeRecordAuditEvent(env, {
            auth: context.auth,
            details: {
              currentCount: rateLimitDecision.currentCount,
              key: rateLimitDecision.key,
              limit: rateLimitDecision.limit,
              remaining: rateLimitDecision.remaining,
              retryAfterSeconds: rateLimitDecision.retryAfterSeconds,
              routeKey,
              scope: rateLimitDecision.scope,
              windowSeconds: rateLimitDecision.windowSeconds
            },
            eventType: "rate_limit.exceeded",
            requestMeta,
            severity: "WARN",
            statusCode: 429
          });

          return failure("RATE_LIMIT_EXCEEDED", 429, origin, {
            limit: rateLimitDecision.limit,
            remaining: rateLimitDecision.remaining,
            retryAfterSeconds: rateLimitDecision.retryAfterSeconds
          });
        }
      }

      return route.handler(request, env, origin, context);
    }, origin);

    return attachResponseMetadata(
      response,
      requestMeta.requestId,
      rateLimitDecision
    );
  },

  async scheduled(
    event: ScheduledEvent,
    env: AppEnv,
    _ctx: ExecutionContext
  ): Promise<void> {
    console.log(`Cron triggered: ${event.cron}`);

    try {
      if (event.cron === "0 8 * * 1") {
        const reportResult = await sendWeeklyReport(env);
        console.log(`Weekly Report result: ${JSON.stringify(reportResult)}`);
      } else if (event.cron === "0 8 * * *") {
        const violationCount = await detectMissingScanIn(env);
        console.log(`Missing Scan Detection: ${violationCount} students flagged.`);
      } else {
        const archiveResult = await archiveAuditLogs(env);
        console.log(`Archive result: ${JSON.stringify(archiveResult)}`);
      }
    } catch (error) {
      console.error(
        `Scheduled task failed: ${error instanceof Error ? error.message : "UNKNOWN"}`
      );
    }
  }
};
