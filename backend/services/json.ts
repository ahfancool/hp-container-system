type ErrorBody = {
  success: false;
  error: string;
  details?: unknown;
};

type SuccessBody<T> = {
  success: true;
  data: T;
};

function createResponse<T>(
  body: SuccessBody<T> | ErrorBody,
  status: number,
  origin: string
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export function success<T>(
  data: T,
  status = 200,
  origin = "*"
): Response {
  return createResponse({ success: true, data }, status, origin);
}

export function failure(
  error: string,
  status = 400,
  origin = "*",
  details?: unknown
): Response {
  return createResponse({ success: false, error, details }, status, origin);
}

export function notImplemented(feature: string, origin = "*"): Response {
  return failure("NOT_IMPLEMENTED", 501, origin, { feature });
}

