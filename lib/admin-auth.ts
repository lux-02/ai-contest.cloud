function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function getAdminEmailAllowlist() {
  const values = [
    process.env.ADMIN_SUPABASE_EMAILS ?? "",
    process.env.ADMIN_SUPABASE_EMAIL ?? "",
  ]
    .flatMap((value) => value.split(","))
    .map((value) => normalizeEmail(value))
    .filter(Boolean);

  return Array.from(new Set(values));
}

export function getDefaultAdminEmail() {
  return getAdminEmailAllowlist()[0] ?? "";
}

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return getAdminEmailAllowlist().includes(normalizeEmail(email));
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function isAdminAuthEnabled() {
  return isSupabaseConfigured() && getAdminEmailAllowlist().length > 0;
}
