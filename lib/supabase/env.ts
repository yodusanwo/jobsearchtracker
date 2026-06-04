/** Supabase env helpers — names match the current Supabase dashboard. */

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

/** Browser-safe key (Supabase dashboard: Publishable key). */
export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

/** Server-only key (Supabase dashboard: Secret keys). */
export function getSupabaseSecretKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  );
}

export function isSupabaseConfigured() {
  return !!(getSupabaseUrl() && getSupabasePublishableKey());
}

export function isSupabaseAdminConfigured() {
  return !!(getSupabaseUrl() && getSupabaseSecretKey());
}
