import {
  createClient,
  SupabaseClient,
  User,
} from "npm:@supabase/supabase-js@2.49.8";
import {
  resolveSupabaseKeys,
  SupabaseEnvironmentValues,
} from "./supabase-keys.ts";

function environmentValues(): SupabaseEnvironmentValues {
  return {
    SUPABASE_PUBLISHABLE_KEYS: Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"),
    SUPABASE_PUBLISHABLE_KEY: Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
    SUPABASE_SECRET_KEYS: Deno.env.get("SUPABASE_SECRET_KEYS"),
    SUPABASE_SECRET_KEY: Deno.env.get("SUPABASE_SECRET_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function requiredSupabaseUrl(): string {
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  if (!url) throw new Error("SUPABASE_CONFIG_MISSING: SUPABASE_URL");
  return url;
}

export function adminClient(): SupabaseClient {
  const keys = resolveSupabaseKeys(environmentValues());
  if (!keys.secretKey) {
    throw new Error(
      "SUPABASE_CONFIG_MISSING: SUPABASE_SECRET_KEYS.default or SUPABASE_SECRET_KEY",
    );
  }
  return createClient(
    requiredSupabaseUrl(),
    keys.secretKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

export async function authenticatedUser(
  request: Request,
): Promise<{ user: User; admin: SupabaseClient }> {
  const keys = resolveSupabaseKeys(environmentValues());
  if (!keys.publishableKey) {
    throw new Error(
      "SUPABASE_CONFIG_MISSING: SUPABASE_PUBLISHABLE_KEYS.default or SUPABASE_PUBLISHABLE_KEY",
    );
  }
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTH_REQUIRED");
  const token = authorization.slice("Bearer ".length);
  const verifier = createClient(
    requiredSupabaseUrl(),
    keys.publishableKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return { user: data.user, admin: adminClient() };
}
