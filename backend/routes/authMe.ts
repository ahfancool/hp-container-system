import type { AuthorizedRequestContext } from "../middleware/auth";
import type { AppEnv } from "../services/env";
import { failure, success } from "../services/json";

export async function getAuthMe(
  _request: Request,
  _env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  if (!context.auth) {
    return failure("UNAUTHORIZED_ACTION", 401, origin);
  }

  const role = context.auth.appUser.role;

  return success(
    {
      authUser: context.auth.authUser,
      appUser: context.auth.appUser,
      student: context.auth.student,
      permissions: {
        canAuditLogs: role === "admin",
        canScan: role === "student" && Boolean(context.auth.student),
        canApprove: ["teacher", "homeroom", "admin"].includes(role),
        canViewDashboard: ["teacher", "homeroom", "admin"].includes(role)
      }
    },
    200,
    origin
  );
}
