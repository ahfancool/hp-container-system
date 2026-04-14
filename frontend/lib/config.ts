type PublicRuntimeConfig = {
  appEnvironment: string;
  apiBaseUrl: string;
  supabaseAnonKey: string;
  supabaseUrl: string;
};

function requirePublicEnv(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Missing required public environment variable: ${name}`);
  }

  return value.trim();
}

function shouldAllowPublicFallbacks(): boolean {
  return process.env.NODE_ENV !== "production";
}

function readOptionalPublicEnv(
  value: string | undefined,
  fallback: string
): string {
  if (!value?.trim()) {
    return fallback;
  }

  return value.trim();
}

export function getPublicRuntimeConfig(): PublicRuntimeConfig {
  if (!shouldAllowPublicFallbacks()) {
    return {
      appEnvironment: requirePublicEnv(
        "NEXT_PUBLIC_APP_ENV",
        process.env.NEXT_PUBLIC_APP_ENV
      ),
      apiBaseUrl: requirePublicEnv(
        "NEXT_PUBLIC_API_BASE_URL",
        process.env.NEXT_PUBLIC_API_BASE_URL
      ),
      supabaseAnonKey: requirePublicEnv(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ),
      supabaseUrl: requirePublicEnv(
        "NEXT_PUBLIC_SUPABASE_URL",
        process.env.NEXT_PUBLIC_SUPABASE_URL
      )
    };
  }

  return {
    appEnvironment: readOptionalPublicEnv(
      process.env.NEXT_PUBLIC_APP_ENV,
      "local"
    ),
    apiBaseUrl: readOptionalPublicEnv(
      process.env.NEXT_PUBLIC_API_BASE_URL,
      "http://localhost:8787"
    ),
    supabaseAnonKey: readOptionalPublicEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "dummy-anon-key-prevent-crash"
    ),
    supabaseUrl: readOptionalPublicEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "https://dummy-project.supabase.co"
    )
  };
}

export function getPublicAppEnvironment(): string {
  return getPublicRuntimeConfig().appEnvironment;
}

export function buildApiUrl(path: string): string {
  const { apiBaseUrl } = getPublicRuntimeConfig();
  const normalizedBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}
