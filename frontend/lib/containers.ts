import { buildApiUrl } from "./config";

export type ContainerRecord = {
  createdAt: string;
  id: string;
  isActive: boolean;
  location: string;
  name: string;
  qrCode: string;
  qrSecretToken: string;
  updatedAt: string;
};

type ContainersResponse = {
  data: {
    items: ContainerRecord[];
    meta: {
      authorizedRole: string | null;
      includeInactive: boolean;
      total: number;
    };
  };
};

type CreateContainerResponse = {
  data: {
    item: ContainerRecord;
    meta: {
      createdBy: string | null;
      createdByRole: string | null;
    };
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

export async function fetchContainers(
  accessToken: string,
  includeInactive = true
): Promise<ContainerRecord[]> {
  const response = await fetch(
    buildApiUrl(`/containers?includeInactive=${includeInactive}`),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as ContainersResponse;
  return payload.data.items;
}

export async function createContainerRequest(
  accessToken: string,
  input: { location: string; name: string }
): Promise<ContainerRecord> {
  const response = await fetch(buildApiUrl("/containers"), {
    body: JSON.stringify(input),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as CreateContainerResponse;
  return payload.data.item;
}

export async function rotateContainerQrTokenRequest(
  accessToken: string,
  containerId: string
): Promise<ContainerRecord> {
  const response = await fetch(buildApiUrl("/containers/rotate-token"), {
    body: JSON.stringify({ container_id: containerId }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as { data: { item: ContainerRecord } };
  return payload.data.item;
}

