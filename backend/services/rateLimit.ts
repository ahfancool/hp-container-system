import type { AppEnv } from "./env";
import { createServiceRoleClient } from "./supabase";
import type { AuthorizedRequestContext } from "../middleware/auth";

export type RateLimitScope = "ip" | "user" | "student";

export type RouteRateLimit = {
  limit: number;
  scope: RateLimitScope;
  windowSeconds: number;
};

type RateLimitRow = {
  allowed: boolean;
  current_count: number;
  remaining: number;
  retry_after_seconds: number;
  window_started_at: string;
};

export type RateLimitDecision = {
  allowed: boolean;
  currentCount: number;
  key: string;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  scope: RateLimitScope;
  windowSeconds: number;
  windowStartedAt: string;
};

function resolveRateLimitKey(
  config: RouteRateLimit,
  context: AuthorizedRequestContext
): string {
  if (config.scope === "student") {
    if (context.auth?.student?.id) {
      return `student:${context.auth.student.id}`;
    }

    if (context.auth?.appUser.id) {
      return `user:${context.auth.appUser.id}`;
    }
  }

  if (config.scope === "user" && context.auth?.appUser.id) {
    return `user:${context.auth.appUser.id}`;
  }

  if (context.requestMeta.clientIp) {
    return `ip:${context.requestMeta.clientIp}`;
  }

  return `request:${context.requestMeta.requestId}`;
}

export async function enforceRouteRateLimit(
  env: AppEnv,
  routeKey: string,
  config: RouteRateLimit,
  context: AuthorizedRequestContext
): Promise<RateLimitDecision> {
  const client = createServiceRoleClient(env);
  const key = resolveRateLimitKey(config, context);
  const { data, error } = await client.rpc("register_rate_limit_hit", {
    p_limit_key: key,
    p_max_hits: config.limit,
    p_route_key: routeKey,
    p_window_seconds: config.windowSeconds
  });

  if (error) {
    throw new Error(`RATE_LIMIT_FAILED:${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : null) as RateLimitRow | null;

  if (!row) {
    throw new Error("RATE_LIMIT_FAILED:No rate limit response returned.");
  }

  return {
    allowed: row.allowed,
    currentCount: row.current_count,
    key,
    limit: config.limit,
    remaining: row.remaining,
    retryAfterSeconds: row.retry_after_seconds,
    scope: config.scope,
    windowSeconds: config.windowSeconds,
    windowStartedAt: row.window_started_at
  };
}
