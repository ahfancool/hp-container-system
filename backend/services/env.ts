const requiredEnvKeys = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE",
  "JWT_SECRET",
  "RESEND_API_KEY",
  "ADMIN_EMAILS"
] as const;

type RequiredEnvKey = (typeof requiredEnvKeys)[number];

export const appRoles = ["student", "teacher", "homeroom", "admin"] as const;

export type AppRole = (typeof appRoles)[number];

export type AppEnv = {
  APP_ENV?: string;
  ALLOWED_ORIGIN?: string;
  CONTAINER_CACHE_TTL_SECONDS?: string;
  DASHBOARD_CACHE_TTL_SECONDS?: string;
  REGULAR_IN_ALLOWED_END?: string;
  REGULAR_IN_ALLOWED_START?: string;
  REGULAR_OUT_ALLOWED_TIME?: string;
  SCHOOL_TIMEZONE?: string;
  AUDIT_ARCHIVE?: R2Bucket;
} & Partial<Record<RequiredEnvKey, string>>;

export type EnvStatus = {
  isReady: boolean;
  missingKeys: RequiredEnvKey[];
};

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getEnvStatus(env: AppEnv): EnvStatus {
  const missingKeys = requiredEnvKeys.filter((key) => !hasText(env[key]));

  return {
    isReady: missingKeys.length === 0,
    missingKeys
  };
}

export function requireRuntimeConfig(
  env: AppEnv
): Record<RequiredEnvKey, string> {
  const status = getEnvStatus(env);

  if (!status.isReady) {
    throw new Error(
      `Missing required env keys: ${status.missingKeys.join(", ")}`
    );
  }

  return {
    SUPABASE_URL: env.SUPABASE_URL!.trim(),
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY!.trim(),
    SUPABASE_SERVICE_ROLE: env.SUPABASE_SERVICE_ROLE!.trim(),
    JWT_SECRET: env.JWT_SECRET!.trim(),
    RESEND_API_KEY: env.RESEND_API_KEY!.trim(),
    ADMIN_EMAILS: env.ADMIN_EMAILS!.trim()
  };
}

export function getContainerCacheTtlSeconds(env: AppEnv): number {
  return parsePositiveInt(env.CONTAINER_CACHE_TTL_SECONDS, 90);
}

export function getDashboardCacheTtlSeconds(env: AppEnv): number {
  return parsePositiveInt(env.DASHBOARD_CACHE_TTL_SECONDS, 10);
}

export function getAppEnvironment(env: AppEnv): string {
  if (hasText(env.APP_ENV)) {
    return env.APP_ENV.trim();
  }

  return "local";
}
