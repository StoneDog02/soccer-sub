import { createBrowserClient } from "@supabase/ssr";
import { normalizeSupabaseUrl } from "./supabase.url";

export function createBrowserSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(normalizeSupabaseUrl(url), anon);
}
