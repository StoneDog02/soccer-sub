import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "./env.server";
import { normalizeSupabaseUrl } from "./supabase.url";

/** Server-only admin client for trusted mutations (credits + highlight row). */
export function createServiceSupabase() {
  const { supabaseUrl: rawUrl, supabaseServiceRole } = getServerEnv();
  const supabaseUrl = normalizeSupabaseUrl(rawUrl);
  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
