import type { AuthorizedRequestContext } from "../middleware/auth";
import { safeRecordAuditEvent } from "../services/audit";
import type { AppEnv } from "../services/env";
import { createContainer, listContainers, rotateContainerQrToken } from "../services/containers";
import { failure, success } from "../services/json";
import { readJsonBody, readRequiredTextField } from "../services/request";

function parseIncludeInactive(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.get("includeInactive") === "true";
}

export async function getContainers(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  const role = context.auth?.appUser.role ?? null;
  const includeInactive = role === "admin" && parseIncludeInactive(request);
  const items = await listContainers(env, includeInactive);

  return success(
    {
      items,
      meta: {
        authorizedRole: role,
        includeInactive,
        total: items.length
      }
    },
    200,
    origin
  );
}

export async function postContainers(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  try {
    const payload = await readJsonBody(request);
    const name = readRequiredTextField(payload, "name");
    const location = readRequiredTextField(payload, "location");
    const item = await createContainer(env, { location, name });
    await safeRecordAuditEvent(env, {
      auth: context.auth,
      containerId: item.id,
      details: {
        containerLocation: item.location,
        containerName: item.name,
        qrCode: item.qrCode
      },
      eventType: "container.created",
      requestMeta: context.requestMeta,
      severity: "INFO",
      statusCode: 201
    });

    return success(
      {
        item,
        meta: {
          createdBy: context.auth?.appUser.id ?? null,
          createdByRole: context.auth?.appUser.role ?? null
        }
      },
      201,
      origin
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (
      message === "INVALID_CONTENT_TYPE" ||
      message === "INVALID_JSON_BODY" ||
      message.startsWith("INVALID_FIELD_")
    ) {
      return failure(message, 400, origin, {
        message:
          "Body request harus JSON dengan field `name` dan `location` bertipe string."
      });
    }

    if (message.startsWith("CONTAINER_CREATE_FAILED:")) {
      return failure("CONTAINER_CREATE_FAILED", 500, origin, {
        message: message.replace("CONTAINER_CREATE_FAILED:", "")
      });
    }

    return failure("INTERNAL_ERROR", 500, origin, {
      message
    });
  }
}

export async function postContainerRotateToken(
  request: Request,
  env: AppEnv,
  origin: string,
  context: AuthorizedRequestContext
): Promise<Response> {
  try {
    const payload = await readJsonBody(request);
    const containerId = readRequiredTextField(payload, "container_id");

    const item = await rotateContainerQrToken(env, containerId);
    await safeRecordAuditEvent(env, {
      auth: context.auth,
      containerId: item.id,
      details: {
        containerLocation: item.location,
        containerName: item.name,
        newQrCode: item.qrCode
      },
      eventType: "container.qr_rotated",
      requestMeta: context.requestMeta,
      severity: "WARN",
      statusCode: 200
    });

    return success(
      {
        item,
        meta: {
          rotatedBy: context.auth?.appUser.id ?? null,
          rotatedByRole: context.auth?.appUser.role ?? null
        }
      },
      200,
      origin
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (
      message === "INVALID_CONTENT_TYPE" ||
      message === "INVALID_JSON_BODY" ||
      message.startsWith("INVALID_FIELD_")
    ) {
      return failure(message, 400, origin, {
        message:
          "Body request harus JSON dengan field `container_id` bertipe string."
      });
    }

    if (message.startsWith("CONTAINER_TOKEN_ROTATE_FAILED:")) {
      return failure("CONTAINER_TOKEN_ROTATE_FAILED", 500, origin, {
        message: message.replace("CONTAINER_TOKEN_ROTATE_FAILED:", "")
      });
    }

    return failure("INTERNAL_ERROR", 500, origin, {
      message
    });
  }
}
