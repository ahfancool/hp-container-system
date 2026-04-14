import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface ScanPayload {
  student_id: string;
  container_id: string;
  timestamp: string;
  type: string;
  request_id: string;
  fingerprint?: string;
  qr_token?: string;
}

interface ScanDB extends DBSchema {
  "scan-buffer": {
    key: string;
    value: ScanPayload;
    indexes: { "by-timestamp": string };
  };
}

const DB_NAME = "hp-container-offline-v1";
const STORE_NAME = "scan-buffer";

let dbPromise: Promise<IDBPDatabase<ScanDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ScanDB>(DB_NAME, 1, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "request_id",
        });
        store.createIndex("by-timestamp", "timestamp");
      },
    });
  }
  return dbPromise;
}

export async function addToBuffer(payload: ScanPayload) {
  const db = await getDB();
  await db.put(STORE_NAME, payload);
}

export async function getBufferedScans() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function removeFromBuffer(requestId: string) {
  const db = await getDB();
  await db.delete(STORE_NAME, requestId);
}

export async function clearBuffer() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

export async function getBufferSize() {
  const db = await getDB();
  return db.count(STORE_NAME);
}
