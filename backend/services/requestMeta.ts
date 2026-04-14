export type RequestMeta = {
  clientIp: string | null;
  method: string;
  path: string;
  requestId: string;
  userAgent: string | null;
};

function readClientIp(request: Request): string | null {
  const cfIp = request.headers.get("CF-Connecting-IP")?.trim();

  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = request.headers.get("X-Forwarded-For");

  if (!forwardedFor) {
    return null;
  }

  const firstValue = forwardedFor.split(",")[0]?.trim();
  return firstValue || null;
}

export function createRequestMeta(request: Request): RequestMeta {
  const url = new URL(request.url);
  const headerRequestId = request.headers.get("X-Request-Id")?.trim();

  return {
    clientIp: readClientIp(request),
    method: request.method.toUpperCase(),
    path: url.pathname,
    requestId: headerRequestId || crypto.randomUUID(),
    userAgent: request.headers.get("User-Agent")?.trim() || null
  };
}
