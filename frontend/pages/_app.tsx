import type { AppProps } from "next/app";
import React, { useState, useEffect, type ReactNode } from "react";

import { AuthProvider } from "../context/AuthContext";
import { Toaster } from "sonner";
import OfflineIndicator from "../components/OfflineIndicator";
import GlobalSearch from "../components/GlobalSearch";
import "../styles/globals.css";

// True React Error Boundary
class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
          <div className="content-panel" style={{ maxWidth: "500px", textAlign: "center", padding: "40px" }}>
            <h2 style={{ color: "#dc2626", marginBottom: "16px" }}>Aplikasi Terhenti</h2>
            <p className="lead compact-lead">
              Sistem mendeteksi kesalahan fatal saat memuat komponen. 
              Hal ini dapat terjadi karena masalah koneksi atau konfigurasi yang belum lengkap.
            </p>
            <div className="scan-blocking-note" style={{ textAlign: "left", marginTop: "24px", background: "#fef2f2", border: "1px solid #fee2e2" }}>
               <span className="summary-label" style={{ color: "#991b1b" }}>Detail Teknis</span>
               <code style={{ display: "block", marginTop: "8px", fontSize: "0.85rem", color: "#b91c1c", whiteSpace: "pre-wrap" }}>
                 {this.state.error?.message || "Kesalahan Tidak Diketahui"}
               </code>
            </div>
            <div className="button-row" style={{ justifyContent: "center", marginTop: "32px" }}>
              <button 
                className="primary-button" 
                onClick={() => window.location.reload()}
              >
                Coba Muat Ulang
              </button>
              <a 
                href="/login" 
                className="secondary-button"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = "/login";
                }}
              >
                Ke Halaman Masuk
              </a>
            </div>
            <p className="session-meta" style={{ marginTop: "24px" }}>
              Saran: Cek tab <b>Konsol</b> di Browser (F12) untuk informasi lebih detil.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // Prevent hydration mismatch
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Component {...pageProps} />
        <OfflineIndicator />
        <GlobalSearch />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </ErrorBoundary>
  );
}
