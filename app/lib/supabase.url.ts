/**
 * Supabase client expects the **project URL** only, e.g.
 * `https://abcdefghij.supabase.co`
 *
 * If `SUPABASE_URL` mistakenly includes `/auth/v1`, `/rest/v1`, etc., the
 * SDK will build broken paths like `.../auth/v1/auth/v1/signup`, which often
 * surfaces as "Invalid path specified in request URL" from the API gateway.
 */
export function normalizeSupabaseUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  const suffixes = [
    "/auth/v1",
    "/rest/v1",
    "/storage/v1",
    "/functions/v1",
    "/realtime/v1",
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of suffixes) {
      if (u.endsWith(s)) {
        u = u.slice(0, -s.length).replace(/\/+$/, "");
        changed = true;
      }
    }
  }
  return u;
}
