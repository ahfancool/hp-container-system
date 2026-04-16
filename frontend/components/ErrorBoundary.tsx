import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell flex items-center justify-center py-20">
          <EmptyState
            title="Terjadi kesalahan"
            description="Maaf, terjadi kesalahan saat memuat halaman ini. Silakan coba lagi nanti."
            icon={
              <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
            action={{
              label: "Coba Lagi",
              onClick: () => window.location.reload()
            }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
