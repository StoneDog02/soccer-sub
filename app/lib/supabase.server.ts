import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import { getServerEnv } from "./env.server";
import { normalizeSupabaseUrl } from "./supabase.url";

export function createSupabase(request: Request) {
  const { supabaseUrl: rawUrl, supabaseAnonKey } = getServerEnv();
  const supabaseUrl = normalizeSupabaseUrl(rawUrl);
  const headers = new Headers();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      async getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "").map(
          (c) => ({
            name: c.name,
            value: c.value ?? "",
          }),
        );
      },
      setAll(cookiesToSet, responseHeadersFromSupabase) {
        cookiesToSet.forEach(({ name, value, options }) => {
          headers.append(
            "Set-Cookie",
            serializeCookieHeader(name, value, options),
          );
        });
        if (responseHeadersFromSupabase) {
          for (const [key, value] of Object.entries(responseHeadersFromSupabase)) {
            headers.set(key, String(value));
          }
        }
      },
    },
  });

  return { supabase, headers };
}
