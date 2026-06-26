import { redirect } from "react-router";
import type { Route } from "./+types/auth.callback";
import { syncQuestionnaireFromAuthToProfile } from "~/lib/auth.server";
import { createSupabase } from "~/lib/supabase.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabase(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    throw redirect(
      `/login?error=${encodeURIComponent("Missing confirmation code. Open the link from your latest email.")}`,
      { headers },
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    throw redirect(
      `/login?error=${encodeURIComponent("Email link expired or invalid. Try signing in or request a new verification email from the sign-up page.")}`,
      { headers },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await syncQuestionnaireFromAuthToProfile(supabase, user);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .single();

  const dest =
    profile && (profile as { role: string }).role === "scout"
      ? "/scout"
      : "/dashboard";

  throw redirect(dest, { headers });
}
