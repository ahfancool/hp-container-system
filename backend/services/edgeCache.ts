export type EdgeCacheStatus = "HIT" | "MISS" | "SKIP";

async function getDefaultCache(): Promise<Cache | null> {
  try {
    return typeof caches !== "undefined"
      ? await caches.open("hp-container-system-edge-cache")
      : null;
  } catch {
    return null;
  }
}

function buildCacheRequest(namespace: string, key: string): Request {
  return new Request(
    `https://edge-cache.hp-container.local/${namespace}/${encodeURIComponent(key)}`
  );
}

export async function readEdgeJson<T>(
  namespace: string,
  key: string
): Promise<{
  data: T | null;
  status: EdgeCacheStatus;
}> {
  const cache = await getDefaultCache();

  if (!cache) {
    return {
      data: null,
      status: "SKIP"
    };
  }

  try {
    const cached = await cache.match(buildCacheRequest(namespace, key));

    if (!cached) {
      return {
        data: null,
        status: "MISS"
      };
    }

    return {
      data: (await cached.json()) as T,
      status: "HIT"
    };
  } catch {
    return {
      data: null,
      status: "SKIP"
    };
  }
}

export async function writeEdgeJson<T>(
  namespace: string,
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const cache = await getDefaultCache();

  if (!cache) {
    return;
  }

  try {
    await cache.put(
      buildCacheRequest(namespace, key),
      new Response(JSON.stringify(value), {
        headers: {
          "cache-control": `public, max-age=${ttlSeconds}`,
          "content-type": "application/json; charset=utf-8"
        }
      })
    );
  } catch {
    return;
  }
}
