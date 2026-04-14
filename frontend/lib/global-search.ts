import { buildApiUrl } from "./config";

export type StudentMinimalRecord = {
  className: string;
  id: string;
  name: string;
  nis: string;
};

const CACHE_KEY = "hp_container_students_minimal_v1";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

type CachedData = {
  items: StudentMinimalRecord[];
  timestamp: number;
};

export async function fetchMinimalStudents(
  accessToken: string,
  forceRefresh = false
): Promise<StudentMinimalRecord[]> {
  if (!forceRefresh) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as CachedData;
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed.items;
      }
    }
  }

  const response = await fetch(buildApiUrl("/students/minimal"), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("Gagal mengambil data siswa minimal untuk pencarian.");
  }

  const payload = (await response.json()) as {
    data: { items: StudentMinimalRecord[] };
  };

  const items = payload.data.items;
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      items,
      timestamp: Date.now()
    })
  );

  return items;
}
