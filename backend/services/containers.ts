import { createServiceRoleClient } from "./supabase";
import type { AppEnv } from "./env";
import { getContainerCacheTtlSeconds } from "./env";
import { readEdgeJson, writeEdgeJson } from "./edgeCache";

type ContainerRow = {
  created_at: string;
  id: string;
  is_active: boolean;
  location: string;
  name: string;
  qr_code: string;
  qr_secret_token: string;
  updated_at: string;
};

const containerRecordCacheNamespace = "container-record";

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

export type CreateContainerInput = {
  location: string;
  name: string;
};

function mapContainer(row: ContainerRow): ContainerRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    location: row.location,
    name: row.name,
    qrCode: row.qr_code,
    qrSecretToken: row.qr_secret_token,
    updatedAt: row.updated_at
  };
}

export function buildContainerQrCode(containerId: string, secretToken: string): string {
  return `container://${containerId}?t=${secretToken}`;
}

export async function listContainers(
  env: AppEnv,
  includeInactive = false
): Promise<ContainerRecord[]> {
  const client = createServiceRoleClient(env);
  let query = client
    .from("containers")
    .select("id, name, location, qr_code, qr_secret_token, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`CONTAINERS_FETCH_FAILED:${error.message}`);
  }

  return (data ?? []).map((row) => mapContainer(row as ContainerRow));
}

export async function getContainerById(
  env: AppEnv,
  containerId: string
): Promise<ContainerRecord | null> {
  const cached = await readEdgeJson<ContainerRecord>(
    containerRecordCacheNamespace,
    containerId
  );

  if (cached.status === "HIT" && cached.data) {
    return cached.data;
  }

  const client = createServiceRoleClient(env);
  const { data, error } = await client
    .from("containers")
    .select("id, name, location, qr_code, qr_secret_token, is_active, created_at, updated_at")
    .eq("id", containerId)
    .maybeSingle();

  if (error) {
    throw new Error(`CONTAINER_FETCH_FAILED:${error.message}`);
  }

  if (!data) {
    return null;
  }

  const container = mapContainer(data as ContainerRow);

  await writeEdgeJson(
    containerRecordCacheNamespace,
    containerId,
    container,
    getContainerCacheTtlSeconds(env)
  );

  return container;
}

export async function createContainer(
  env: AppEnv,
  input: CreateContainerInput
): Promise<ContainerRecord> {
  const client = createServiceRoleClient(env);
  const id = crypto.randomUUID();
  const secretToken = encodeURIComponent(crypto.randomUUID().replace(/-/g, ""));
  const qrCode = buildContainerQrCode(id, secretToken);

  const { data, error } = await client
    .from("containers")
    .insert({
      id,
      is_active: true,
      location: input.location,
      name: input.name,
      qr_code: qrCode,
      qr_secret_token: secretToken
    })
    .select("id, name, location, qr_code, qr_secret_token, is_active, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(`CONTAINER_CREATE_FAILED:${error?.message ?? "Unknown error"}`);
  }

  const container = mapContainer(data as ContainerRow);

  await writeEdgeJson(
    containerRecordCacheNamespace,
    container.id,
    container,
    getContainerCacheTtlSeconds(env)
  );

  return container;
}

export async function rotateContainerQrToken(
  env: AppEnv,
  containerId: string
): Promise<ContainerRecord> {
  const client = createServiceRoleClient(env);
  const nextSecretToken = encodeURIComponent(crypto.randomUUID().replace(/-/g, ""));
  const nextQrCode = buildContainerQrCode(containerId, nextSecretToken);

  const { data, error } = await client
    .from("containers")
    .update({
      qr_code: nextQrCode,
      qr_secret_token: nextSecretToken
    })
    .eq("id", containerId)
    .select("id, name, location, qr_code, qr_secret_token, is_active, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(`CONTAINER_TOKEN_ROTATE_FAILED:${error?.message ?? "Unknown error"}`);
  }

  const container = mapContainer(data as ContainerRow);

  await writeEdgeJson(
    containerRecordCacheNamespace,
    container.id,
    container,
    getContainerCacheTtlSeconds(env)
  );

  return container;
}
