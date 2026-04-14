type JsonRecord = Record<string, unknown>;

export async function readJsonBody(request: Request): Promise<JsonRecord> {
  const contentType = request.headers.get("Content-Type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("INVALID_CONTENT_TYPE");
  }

  const payload = (await request.json()) as unknown;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("INVALID_JSON_BODY");
  }

  return payload as JsonRecord;
}

export function readRequiredTextField(
  payload: JsonRecord,
  field: string
): string {
  const value = payload[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`INVALID_FIELD_${field.toUpperCase()}`);
  }

  return value.trim();
}

export function readOptionalTextField(
  payload: JsonRecord,
  field: string
): string | null {
  const value = payload[field];

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function readRequiredTextArrayField(
  payload: JsonRecord,
  field: string
): string[] {
  const value = payload[field];

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`INVALID_FIELD_${field.toUpperCase()}`);
  }

  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);

  if (items.length === 0) {
    throw new Error(`INVALID_FIELD_${field.toUpperCase()}`);
  }

  return items;
}
