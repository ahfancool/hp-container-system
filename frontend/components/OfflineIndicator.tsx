import React, { useState, useEffect } from "react";
import { getBufferSize, getBufferedScans, removeFromBuffer } from "../lib/offline-buffer";
import { buildApiUrl } from "../lib/config";
import { useAuth } from "../context/AuthContext";

const OfflineIndicator: React.FC = () => {
  const { session } = useAuth();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [bufferSize, setBufferSize] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (session?.access_token) {
        syncBufferedScans(session.access_token);
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial buffer check
    checkBuffer();

    const interval = setInterval(checkBuffer, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [session]);

  const checkBuffer = async () => {
    const size = await getBufferSize();
    setBufferSize(size);
    if (size > 0 && navigator.onLine && !isSyncing && session?.access_token) {
      syncBufferedScans(session.access_token);
    }
  };

  const syncBufferedScans = async (token: string) => {
    if (isSyncing) return;
    
    const scans = await getBufferedScans();
    if (scans.length === 0) return;

    setIsSyncing(true);
    for (const scan of scans) {
      try {
        const response = await fetch(buildApiUrl("/transaction"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(scan),
        });

        if (response.ok || response.status === 409) {
          // 409 means conflict/already exists (idempotency), so we can remove it
          await removeFromBuffer(scan.request_id);
        }
      } catch (error) {
        console.error("Failed to sync scan:", error);
        break; // Stop syncing if error (probably network again)
      }
    }

    const newSize = await getBufferSize();
    setBufferSize(newSize);
    setIsSyncing(false);
  };

  if (isOnline && bufferSize === 0) return null;

  return (
    <div className={`offline-indicator ${!isOnline ? "is-offline" : ""}`}>
      <div className="offline-indicator-content">
        {!isOnline && (
          <svg className="offline-indicator-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
          </svg>
        )}
        {isOnline && isSyncing && (
          <svg className="offline-indicator-icon spinner" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
        <span className="offline-indicator-text">
          {!isOnline ? "Mode Offline Aktif" : isSyncing ? "Menyinkronkan data..." : "Online"}
          {bufferSize > 0 && ` (${bufferSize} antrian)`}
        </span>
      </div>
      {bufferSize > 0 && !isOnline && (
        <span className="offline-indicator-tag">
          Tersimpan Lokal
        </span>
      )}
    </div>
  );
};

export default OfflineIndicator;
