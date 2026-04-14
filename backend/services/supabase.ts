import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppEnv } from "./env";
import { requireRuntimeConfig } from "./env";

export function createAnonClient(env: AppEnv): SupabaseClient {
  const runtime = requireRuntimeConfig(env);

  return createClient(runtime.SUPABASE_URL, runtime.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createServiceRoleClient(env: AppEnv): SupabaseClient {
  const runtime = requireRuntimeConfig(env);

  return createClient(runtime.SUPABASE_URL, runtime.SUPABASE_SERVICE_ROLE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
