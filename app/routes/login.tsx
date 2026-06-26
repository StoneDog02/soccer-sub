import {
  Form,
  Link,
  data,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
} from "react-router";
import type { Route } from "./+types/login";
import {
  getSessionUser,
  syncQuestionnaireFromAuthToProfile,
} from "~/lib/auth.server";
import { createSupabase } from "~/lib/supabase.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Log in — PitchLedger" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, profile, headers } = await getSessionUser(request);
  if (user) {
    if (profile?.role === "scout") {
      throw redirect("/scout", { headers });
    }
    throw redirect("/dashboard", { headers });
  }
  return data(null, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return data({ error: error.message }, { headers, status: 400 });
  }

  await supabase.auth.getSession();

  const {
    data: { user: signedInUser },
  } = await supabase.auth.getUser();
  if (signedInUser) {
    await syncQuestionnaireFromAuthToProfile(supabase, signedInUser);
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

export default function Login() {
  const actionData = useActionData<{ error?: string }>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const [searchParams] = useSearchParams();
  const urlError = searchParams.get("error");

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-semibold text-white">
        Welcome back
      </h1>
      {urlError && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {urlError}
        </p>
      )}
      <p className="mt-2 text-sm text-white/55">
        New here?{" "}
        <Link to="/signup" className="text-[var(--color-accent)] hover:underline">
          Create an account
        </Link>
      </p>
      <Form method="post" className="glass-panel mt-8 space-y-4 p-6">
        <label className="block text-sm text-white/70">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="field mt-1"
          />
        </label>
        <label className="block text-sm text-white/70">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="field mt-1"
          />
        </label>
        {actionData && "error" in actionData && actionData.error && (
          <p className="text-sm text-red-300">{actionData.error}</p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </Form>
    </main>
  );
}
