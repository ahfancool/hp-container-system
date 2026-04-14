import type { AuthorizedRequestContext, RouteAccess } from "../middleware/auth";
import { getContainers, postContainers, postContainerRotateToken } from "./containers";
import { getAuditLogs } from "./auditLogs";
import { getDashboardStatus } from "./dashboardStatus";
import { getHealth } from "./health";
import { getAuthMe } from "./authMe";
import { postScan } from "./scan";
import { getStudents, getMinimalStudents, postStudentFingerprint } from "./students";
import { postTeacherApprove } from "./teacherApprove";
import { postTransaction } from "./transaction";
import { getViolations, postViolation, patchResolveViolation } from "./violations";
import type { AppEnv } from "../services/env";
import type { RouteRateLimit } from "../services/rateLimit";

export type RouteHandler = (
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
) => Promise<Response>;

export type RouteDefinition = {
  access: RouteAccess;
  handler: RouteHandler;
  rateLimit?: RouteRateLimit;
};

export const routeTable: Record<string, RouteDefinition> = {
  "GET /health": {
    access: "public",
    handler: getHealth
  },
  "GET /auth/me": {
    access: "authenticated",
    handler: getAuthMe,
    rateLimit: {
      limit: 120,
      scope: "user",
      windowSeconds: 60
    }
  },
  "GET /containers": {
    access: "authenticated",
    handler: getContainers,
    rateLimit: {
      limit: 120,
      scope: "user",
      windowSeconds: 60
    }
  },
  "GET /students": {
    access: ["teacher", "homeroom", "admin"],
    handler: getStudents,
    rateLimit: {
      limit: 60,
      scope: "user",
      windowSeconds: 60
    }
  },
  "GET /students/minimal": {
    access: ["teacher", "homeroom", "admin"],
    handler: getMinimalStudents,
    rateLimit: {
      limit: 30,
      scope: "user",
      windowSeconds: 60
    }
  },
  "POST /students/fingerprint": {
    access: ["student"],
    handler: postStudentFingerprint,
    rateLimit: {
      limit: 10,
      scope: "student",
      windowSeconds: 60
    }
  },
  "GET /audit/logs": {
    access: ["admin"],
    handler: getAuditLogs,
    rateLimit: {
      limit: 30,
      scope: "user",
      windowSeconds: 60
    }
  },
  "POST /containers": {
    access: ["admin"],
    handler: postContainers,
    rateLimit: {
      limit: 20,
      scope: "user",
      windowSeconds: 60
    }
  },
  "POST /containers/rotate-token": {
    access: ["teacher", "homeroom", "admin"],
    handler: postContainerRotateToken,
    rateLimit: {
      limit: 10,
      scope: "user",
      windowSeconds: 60
    }
  },
  "POST /scan": {
    access: ["student"],
    handler: postScan,
    rateLimit: {
      limit: 30,
      scope: "student",
      windowSeconds: 60
    }
  },
  "POST /transaction": {
    access: "authenticated",
    handler: postTransaction,
    rateLimit: {
      limit: 20,
      scope: "student",
      windowSeconds: 60
    }
  },
  "POST /teacher/approve": {
    access: ["teacher", "homeroom", "admin"],
    handler: postTeacherApprove,
    rateLimit: {
      limit: 20,
      scope: "user",
      windowSeconds: 60
    }
  },
  "GET /dashboard/status": {
    access: ["teacher", "homeroom", "admin"],
    handler: getDashboardStatus,
    rateLimit: {
      limit: 30,
      scope: "user",
      windowSeconds: 60
    }
  },
  "GET /violations": {
    access: ["teacher", "homeroom", "admin"],
    handler: getViolations,
    rateLimit: {
      limit: 30,
      scope: "user",
      windowSeconds: 60
    }
  },
  "POST /violations": {
    access: ["teacher", "homeroom", "admin"],
    handler: postViolation,
    rateLimit: {
      limit: 20,
      scope: "user",
      windowSeconds: 60
    }
  },
  "POST /violations/resolve": {
    access: ["teacher", "homeroom", "admin"],
    handler: patchResolveViolation,
    rateLimit: {
      limit: 20,
      scope: "user",
      windowSeconds: 60
    }
  }
};
