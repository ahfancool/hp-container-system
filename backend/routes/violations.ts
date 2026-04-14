import type { AuthorizedRequestContext } from "../middleware/auth";
import type { AppEnv } from "../services/env";
import { failure, success } from "../services/json";
import { listViolations, createViolation, resolveViolation } from "../services/violations";
import { readJsonBody, readRequiredTextField } from "../services/request";

export async function getViolations(
  request: Request,
  env: AppEnv,
  origin: string,
  _context: AuthorizedRequestContext
): Promise<Response> {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId") || undefined;
  const resolved = url.searchParams.has("resolved") ? url.searchParams.get("resolved") === "true" : undefined;

  try {
    const items = await listViolations(env, { studentId, resolved });
    return success({ items, total: items.length }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return failure("VIOLATIONS_FETCH_FAILED", 500, origin, { message });
  }
}

export async function postViolation(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  try {
    const payload = await readJsonBody(request);
    const studentId = readRequiredTextField(payload, "student_id");
    const violationType = readRequiredTextField(payload, "violation_type");
    
    const item = await createViolation(env, {
      studentId,
      violationType,
      operatorId: context.auth?.appUser.id
    });

    return success({ item }, 201, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return failure("VIOLATION_CREATE_FAILED", 500, origin, { message });
  }
}

export async function patchResolveViolation(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  try {
    const payload = await readJsonBody(request);
    const violationId = readRequiredTextField(payload, "violation_id");

    await resolveViolation(env, violationId, context.auth!.appUser.id);
    return success({ message: "Pelanggaran berhasil diselesaikan." }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    
    if (message === "INVALID_CONTENT_TYPE" || message === "INVALID_JSON_BODY" || message.startsWith("INVALID_FIELD_")) {
      return failure(message, 400, origin, { message: "Body harus JSON dengan field `violation_id`." });
    }

    return failure("VIOLATION_RESOLVE_FAILED", 500, origin, { message });
  }
}
