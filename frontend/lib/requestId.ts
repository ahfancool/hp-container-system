export function createClientRequestId(prefix: string): string {
  const normalizedPrefix = prefix.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${normalizedPrefix}-${crypto.randomUUID()}`;
  }

  return `${normalizedPrefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
