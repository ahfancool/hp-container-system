import type { AppEnv, AppRole } from "./env";
import { appRoles } from "./env";
import { createAnonClient, createServiceRoleClient } from "./supabase";

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

export type RequestAuth = {
  accessToken: string;
  authUser: {
    id: string;
    email: string | null;
  };
  appUser: AppUserProfile;
  student: StudentProfile | null;
};

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && appRoles.includes(value as AppRole);
}

export function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return null;
  }

  return token.trim();
}

export async function resolveRequestAuth(
  env: AppEnv,
  accessToken: string
): Promise<RequestAuth | null> {
  const authClient = createAnonClient(env);
  const { data: authData, error: authError } = await authClient.auth.getUser(
    accessToken
  );

  if (authError || !authData.user?.id) {
    return null;
  }

  const serviceClient = createServiceRoleClient(env);
  const { data: appUserRow, error: appUserError } = await serviceClient
    .from("users")
    .select("id, auth_user_id, name, role, email, is_active")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (
    appUserError ||
    !appUserRow?.id ||
    !appUserRow.auth_user_id ||
    !appUserRow.is_active ||
    !isAppRole(appUserRow.role)
  ) {
    return null;
  }

  let student: StudentProfile | null = null;

  if (appUserRow.role === "student") {
    const { data: studentRow } = await serviceClient
      .from("students")
      .select("id, nis, name, class_name, major, grade_level, is_active")
      .eq("user_id", appUserRow.id)
      .maybeSingle();

    if (studentRow?.id && studentRow.is_active) {
      student = {
        id: studentRow.id,
        nis: studentRow.nis,
        name: studentRow.name,
        className: studentRow.class_name,
        major: studentRow.major,
        gradeLevel: studentRow.grade_level
      };
    }
  }

  return {
    accessToken,
    authUser: {
      id: authData.user.id,
      email: authData.user.email ?? null
    },
    appUser: {
      id: appUserRow.id,
      authUserId: appUserRow.auth_user_id,
      name: appUserRow.name,
      role: appUserRow.role,
      email: appUserRow.email,
      isActive: appUserRow.is_active
    },
    student
  };
}
