import { buildApiUrl } from "./config";

export type StudentViolation = {
  id: string;
  studentId: string;
  violationType: string;
  timestamp: string;
  resolvedAt: string | null;
  operatorId: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    name: string;
    nis: string;
    className: string;
  };
};

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
      details?: { message?: string };
    };
    return payload.details?.message ?? payload.error ?? "Terjadi kesalahan API.";
  } catch {
    return "Terjadi kesalahan API.";
  }
}

export async function fetchViolations(
  accessToken: string,
  options?: { studentId?: string; resolved?: boolean }
): Promise<StudentViolation[]> {
  let url = buildApiUrl("/violations");
  const params = new URLSearchParams();
  if (options?.studentId) params.append("studentId", options.studentId);
  if (options?.resolved !== undefined) params.append("resolved", String(options.resolved));
  if (params.toString()) url += `?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) throw new Error(await readApiError(response));
  const payload = (await response.json()) as { data: { items: StudentViolation[] } };
  return payload.data.items;
}

export async function createViolationRequest(
  accessToken: string,
  input: { studentId: string; violationType: string }
): Promise<StudentViolation> {
  const response = await fetch(buildApiUrl("/violations"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      student_id: input.studentId,
      violation_type: input.violationType
    })
  });

  if (!response.ok) throw new Error(await readApiError(response));
  const payload = (await response.json()) as { data: { item: StudentViolation } };
  return payload.data.item;
}

export async function resolveViolationRequest(
  accessToken: string,
  violationId: string
): Promise<void> {
  const response = await fetch(buildApiUrl(`/violations/resolve`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ violation_id: violationId }) // Standard body for our static router
  });

  if (!response.ok) throw new Error(await readApiError(response));
}
