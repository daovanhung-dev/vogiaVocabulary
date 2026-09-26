export interface SupabaseEnvironmentValues {
  SUPABASE_PUBLISHABLE_KEYS?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SECRET_KEYS?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export interface ResolvedSupabaseKeys {
  publishableKey?: string;
  secretKey?: string;
}

function readDefaultKey(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "default" in parsed) {
      const value = (parsed as { default?: unknown }).default;
      return typeof value === "string" && value.trim()
        ? value.trim()
        : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function readValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function resolveSupabaseKeys(
  values: SupabaseEnvironmentValues,
): ResolvedSupabaseKeys {
  return {
    publishableKey: readDefaultKey(values.SUPABASE_PUBLISHABLE_KEYS) ??
      readValue(values.SUPABASE_PUBLISHABLE_KEY) ??
      readValue(values.SUPABASE_ANON_KEY),
    secretKey: readDefaultKey(values.SUPABASE_SECRET_KEYS) ??
      readValue(values.SUPABASE_SECRET_KEY) ??
      readValue(values.SUPABASE_SERVICE_ROLE_KEY),
  };
}
