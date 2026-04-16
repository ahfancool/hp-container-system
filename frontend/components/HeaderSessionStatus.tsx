import Link from "next/link";

import { useAuth } from "../context/AuthContext";
import { RoleBadge } from "./RoleBadge";

export function HeaderSessionStatus() {
  const { isLoading, isReady, signOut, snapshot } = useAuth();

  if (!isReady) {
    return (
      <div className="session-status">
        <span className="session-meta">Memeriksa sesi login...</span>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="session-status">
        <span className="session-meta">Belum login</span>
        <Link className="secondary-button compact-button" href="/login">
          Masuk
        </Link>
      </div>
    );
  }

  return (
    <div className="session-status">
      <div>
        <div className="session-role-row">
          <RoleBadge role={snapshot.appUser.role} />
          <span className="session-meta">{snapshot.authUser.email}</span>
        </div>
        <strong className="session-name">{snapshot.appUser.name}</strong>
      </div>
      <button
        className="secondary-button compact-button"
        disabled={isLoading}
        onClick={() => {
          void signOut();
        }}
        type="button"
        aria-label="Keluar dari akun"
      >
        Keluar
      </button>
    </div>
  );
}

