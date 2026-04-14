import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";

import { buildApiUrl } from "../lib/config";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { getFingerprint } from "../lib/fingerprint";

export type AppRole = "student" | "teacher" | "homeroom" | "admin";

export type StudentProfile = {
  id: string;
  nis: string;
  name: string;
  className: string;
  major: string | null;
  gradeLevel: string;
};

export type AppUserProfile = {
  id: string;
  authUserId: string;
  name: string;
  role: AppRole;
  email: string;
  isActive: boolean;
};

export type AuthSnapshot = {
  authUser: {
    id: string;
    email: string | null;
  };
  appUser: AppUserProfile;
  permissions: {
    canAuditLogs: boolean;
    canApprove: boolean;
    canScan: boolean;
    canViewDashboard: boolean;
  };
  student: StudentProfile | null;
};

type AuthContextValue = {
  error: string | null;
  isLoading: boolean;
  isReady: boolean;
  session: Session | null;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
  snapshot: AuthSnapshot | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
      details?: { message?: string };
    };

    return payload.details?.message ?? payload.error ?? "Terjadi kesalahan.";
  } catch {
    return "Terjadi kesalahan.";
  }
}

async function fetchAuthSnapshot(
  session: Session | null
): Promise<AuthSnapshot | null> {
  if (!session) {
    return null;
  }

  const response = await fetch(buildApiUrl("/auth/me"), {
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as {
    data: AuthSnapshot;
    success: boolean;
  };

  return payload.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [snapshot, setSnapshot] = useState<AuthSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const syncSession = async (nextSession: Session | null) => {
      setIsLoading(true);
      setError(null);

      try {
        const nextSnapshot = await fetchAuthSnapshot(nextSession);

        if (!isActive) {
          return;
        }

        setSession(nextSession);
        setSnapshot(nextSnapshot);
      } catch (authError) {
        if (!isActive) {
          return;
        }

        setSession(nextSession);
        setSnapshot(null);
        setError(
          authError instanceof Error
            ? authError.message
            : "Gagal memuat profil login."
        );
      } finally {
        if (!isActive) {
          return;
        }

        setIsLoading(false);
        setIsReady(true);
      }
    };

    void (async () => {
      try {
        const client = getSupabaseBrowserClient();
        const {
          data: { session: initialSession },
          error: sessionError
        } = await client.auth.getSession();

        if (sessionError && isActive) {
          setError(sessionError.message);
        }

        await syncSession(initialSession);

        const {
          data: { subscription }
        } = client.auth.onAuthStateChange((_event, nextSession) => {
          void syncSession(nextSession);
        });

        return () => {
          isActive = false;
          subscription.unsubscribe();
        };
      } catch (initError) {
        setError(
          initError instanceof Error
            ? initError.message
            : "Gagal inisialisasi layanan database."
        );
        setIsLoading(false);
        setIsReady(true);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const signInWithPassword = async (
    email: string,
    password: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    const client = getSupabaseBrowserClient();
    const { data, error: signInError } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setIsLoading(false);
      setError(signInError.message);
      return false;
    }

    setSession(data.session);

    // Register fingerprint if student
    if (data.session) {
      try {
        const nextSnapshot = await fetchAuthSnapshot(data.session);
        if (nextSnapshot?.student) {
          const fingerprint = await getFingerprint();
          await fetch(buildApiUrl("/students/fingerprint"), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ fingerprint })
          });
        }
      } catch (fpError) {
        console.warn("Gagal sinkronisasi fingerprint perangkat:", fpError);
      }
    }

    return true;
  };

  const signOut = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    const client = getSupabaseBrowserClient();
    const { error: signOutError } = await client.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
    }

    setIsLoading(false);
  };

  const refreshSnapshot = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const nextSnapshot = await fetchAuthSnapshot(session);
      setSnapshot(nextSnapshot);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Gagal memuat ulang profil login."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        error,
        isLoading,
        isReady,
        session,
        signInWithPassword,
        signOut,
        refreshSnapshot,
        snapshot
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider.");
  }

  return context;
}
