export function resolveOrigin(
  request: Request,
  allowedOrigin?: string
): string {
  const requestOrigin = request.headers.get("Origin");

  if (!allowedOrigin || allowedOrigin === "*") {
    return requestOrigin ?? "*";
  }

  return allowedOrigin;
}

export function createPreflightResponse(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-allow-methods": "GET, POST, OPTIONS"
    }
  });
}

