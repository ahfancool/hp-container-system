import type { AuthorizedRequestContext } from "../middleware/auth";
import type { AppEnv } from "../services/env";
import { getAppEnvironment, getEnvStatus } from "../services/env";
import { success } from "../services/json";

export async function getHealth(
  _request: Request,
  env: AppEnv,
  origin: string,
  _context: AuthorizedRequestContext
): Promise<Response> {
  const envStatus = getEnvStatus(env);

  return success(
    {
      service: "hp-container-system-api",
      appEnvironment: getAppEnvironment(env),
      milestone: "10-deployment",
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: envStatus
    },
    200,
    origin
  );
}
