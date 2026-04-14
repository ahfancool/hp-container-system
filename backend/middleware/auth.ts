import type { AppEnv, AppRole } from "../services/env";
import {
  extractBearerToken,
  resolveRequestAuth,
  type RequestAuth
} from "../services/auth";
import { safeRecordAuditEvent } from "../services/audit";
import { failure } from "../services/json";
import type { RequestMeta } from "../services/requestMeta";

export type RouteAccess = "public" | "authenticated" | AppRole[];

export type AuthorizedRequestContext = {
  auth: RequestAuth | null;
  requestMeta: RequestMeta;
};

function hasRequiredRole(
  role: AppRole,
  access: Exclude<RouteAccess, "public" | "authenticated">
): boolean {
  return access.includes(role);
}

export async function authorizeRequest(
  request: Request,
  env: AppEnv,
  origin: string,
  access: RouteAccess,
  requestMeta: RequestMeta
): Promise<
  | {
      ok: true;
      context: AuthorizedRequestContext;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  if (access === "public") {
    return {
      ok: true,
      context: {
        auth: null,
        requestMeta
      }
    };
  }

  const token = extractBearerToken(request);

  if (!token) {
    await safeRecordAuditEvent(env, {
      details: {
        message: "Header Authorization Bearer token tidak ditemukan.",
        requiredAccess: access
      },
      eventType: "auth.missing_bearer_token",
      requestMeta,
      severity: "WARN",
      statusCode: 401
    });

    return {
      ok: false,
      response: failure("MISSING_BEARER_TOKEN", 401, origin, {
        message: "Endpoint ini membutuhkan header Authorization Bearer token."
      })
    };
  }

  const auth = await resolveRequestAuth(env, token);

  if (!auth) {
    await safeRecordAuditEvent(env, {
      details: {
        message: "Token tidak valid atau role belum terhubung ke aplikasi.",
        requiredAccess: access
      },
      eventType: "auth.invalid_token",
      requestMeta,
      severity: "WARN",
      statusCode: 401
    });

    return {
      ok: false,
      response: failure("INVALID_TOKEN", 401, origin, {
        message: "Sesi login tidak valid atau role belum terhubung ke aplikasi."
      })
    };
  }

  if (access !== "authenticated" && !hasRequiredRole(auth.appUser.role, access)) {
    await safeRecordAuditEvent(env, {
      auth,
      details: {
        currentRole: auth.appUser.role,
        requiredRoles: access
      },
      eventType: "auth.unauthorized_role",
      requestMeta,
      severity: "WARN",
      statusCode: 403
    });

    return {
      ok: false,
      response: failure("UNAUTHORIZED_ACTION", 403, origin, {
        requiredRoles: access,
        currentRole: auth.appUser.role
      })
    };
  }

  return {
    ok: true,
    context: {
      auth,
      requestMeta
    }
  };
}
