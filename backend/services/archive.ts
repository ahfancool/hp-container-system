import { type AppEnv } from "./env";
import { createServiceRoleClient } from "./supabase";

export async function archiveAuditLogs(env: AppEnv): Promise<{ archivedCount: number; purgedCount: number; fileName: string | null }> {
  if (!env.AUDIT_ARCHIVE) {
    throw new Error("AUDIT_ARCHIVE R2 bucket binding is missing.");
  }

  const client = createServiceRoleClient(env);
  
  // Archive logs older than 30 days
  const archiveBefore = new Date();
  archiveBefore.setDate(archiveBefore.getDate() - 30);
  const archiveBeforeISO = archiveBefore.toISOString();

  // 1. Fetch data to archive
  // Note: For very large datasets, this should be paginated. 
  // But for a daily cron, we assume the daily volume fits in memory or we fetch in chunks.
  const { data: logs, error: fetchError } = await client
    .from("audit_logs")
    .select("*")
    .lt("created_at", archiveBeforeISO)
    .order("created_at", { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to fetch logs for archiving: ${fetchError.message}`);
  }

  if (!logs || logs.length === 0) {
    return { archivedCount: 0, purgedCount: 0, fileName: null };
  }

  // 2. Format as JSONL
  const jsonl = logs.map(log => JSON.stringify(log)).join("\n");
  
  // 3. Determine file name: logs/YYYY-MM.jsonl (or with a timestamp if running daily)
  // The requirement said logs/YYYY-MM.*
  // We'll use logs/YYYY-MM/YYYY-MM-DD-HHmm.jsonl to avoid overwriting or needing to append (which R2 doesn't support directly)
  const now = new Date();
  const yearMonth = now.toISOString().substring(0, 7); // YYYY-MM
  const fullStamp = now.toISOString().replace(/[:.]/g, "-");
  const fileName = `logs/${yearMonth}/${fullStamp}.jsonl`;

  // 4. Upload to R2
  await env.AUDIT_ARCHIVE.put(fileName, jsonl, {
    httpMetadata: { contentType: "application/x-jsonlines" },
    customMetadata: {
      archivedAt: now.toISOString(),
      recordCount: String(logs.length),
      oldestRecord: logs[0].created_at,
      newestRecord: logs[logs.length - 1].created_at
    }
  });

  // 5. Verify upload (R2 put is atomic and throws on error, but we can double check)
  const head = await env.AUDIT_ARCHIVE.head(fileName);
  if (!head) {
    throw new Error("Archive verification failed: File not found in R2 after put.");
  }

  // 6. Purge from Database
  const logIds = logs.map(l => l.id);
  // Delete in chunks if too many IDs
  const chunkSize = 100;
  let purgedCount = 0;
  for (let i = 0; i < logIds.length; i += chunkSize) {
    const chunk = logIds.slice(i, i + chunkSize);
    const { error: deleteError, count } = await client
      .from("audit_logs")
      .delete({ count: "exact" })
      .in("id", chunk);

    if (deleteError) {
      console.error(`Partial purge failure: ${deleteError.message}`);
      // We don't throw here to avoid infinite retry of archived data, 
      // but in production we should log this clearly.
    } else {
      purgedCount += count ?? 0;
    }
  }

  return {
    archivedCount: logs.length,
    purgedCount,
    fileName
  };
}

export async function listArchives(env: AppEnv): Promise<string[]> {
  if (!env.AUDIT_ARCHIVE) {
    throw new Error("AUDIT_ARCHIVE R2 bucket binding is missing.");
  }

  const list = await env.AUDIT_ARCHIVE.list({ prefix: "logs/" });
  return list.objects.map(obj => obj.key);
}

export async function fetchArchiveContent(env: AppEnv, key: string): Promise<any[]> {
  if (!env.AUDIT_ARCHIVE) {
    throw new Error("AUDIT_ARCHIVE R2 bucket binding is missing.");
  }

  const obj = await env.AUDIT_ARCHIVE.get(key);
  if (!obj) {
    throw new Error(`Archive ${key} not found.`);
  }

  const text = await obj.text();
  return text.split("\n").filter(line => line.trim().length > 0).map(line => JSON.parse(line));
}

export async function restoreSampleFromArchive(env: AppEnv, key: string, limit = 100): Promise<number> {
  const logs = await fetchArchiveContent(env, key);
  const sample = logs.slice(0, limit);
  
  const client = createServiceRoleClient(env);
  const { error } = await client.from("audit_logs").insert(sample);
  
  if (error) {
    throw new Error(`Failed to restore sample logs: ${error.message}`);
  }

  return sample.length;
}
