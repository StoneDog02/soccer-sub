import {
  Form,
  Link,
  data,
  redirect,
  useActionData,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/signup";
import { getSessionUser, syncQuestionnaireFromAuthToProfile } from "~/lib/auth.server";
import { resolvePublicOrigin } from "~/lib/env.server";
import { PLAYER_POSITIONS, PLAYER_SPORTS } from "~/lib/player-form-options";
import { createSupabase } from "~/lib/supabase.server";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign up — PitchLedger" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, profile, headers } = await getSessionUser(request);
  if (user && profile) {
    throw redirect(profile.role === "scout" ? "/scout" : "/dashboard", {
      headers,
    });
  }
  return data(null, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  const form = await request.formData();

  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const password_confirm = String(form.get("password_confirm") ?? "");
  const full_name = String(form.get("full_name") ?? "").trim();
  const date_of_birth = String(form.get("date_of_birth") ?? "").trim();
  const sport = String(form.get("sport") ?? "").trim();
  const primary_position = String(form.get("primary_position") ?? "").trim();
  const goals = String(form.get("goals") ?? "").trim().slice(0, 2000);

  if (!USERNAME_RE.test(username)) {
    return data(
      {
        error:
          "Username must be 3–24 characters: letters, numbers, and underscores only.",
      },
      { headers, status: 400 },
    );
  }

  if (password.length < 8) {
    return data(
      { error: "Password must be at least 8 characters." },
      { headers, status: 400 },
    );
  }

  if (password !== password_confirm) {
    return data({ error: "Passwords do not match." }, { headers, status: 400 });
  }

  if (!sport) {
    return data({ error: "Please select your primary sport." }, { headers, status: 400 });
  }

  const origin = resolvePublicOrigin(request);
  const emailRedirectTo = new URL("/auth/callback", `${origin}/`).href;

  const { data: signData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        full_name,
        date_of_birth,
        sport,
        primary_position: primary_position || "",
        goals: goals || "",
      },
      emailRedirectTo,
    },
  });

  if (error) {
    let message = error.message;
    if (/invalid path|redirect/i.test(message)) {
      message = `${message} — If redirect URLs are already correct, check SUPABASE_URL / VITE_SUPABASE_URL: they must be the project base only (https://YOUR-REF.supabase.co) with no /auth/v1 or /rest/v1. Confirm the ref matches the Supabase project you configured. Confirmation link uses: ${emailRedirectTo}`;
    }
    return data({ error: message }, { headers, status: 400 });
  }

  await supabase.auth.getSession();

  if (signData.session) {
    const {
      data: { user: newUser },
    } = await supabase.auth.getUser();
    if (newUser) {
      await syncQuestionnaireFromAuthToProfile(supabase, newUser);
    }
    throw redirect("/dashboard", { headers });
  }

  const qp = new URLSearchParams({ email });
  throw redirect(`/signup/check-email?${qp.toString()}`, { headers });
}

export default function Signup() {
  const actionData = useActionData<{ error?: string }>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-display text-3xl font-semibold text-white">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-white/55">
        Already registered?{" "}
        <Link to="/login" className="text-[var(--color-accent)] hover:underline">
          Log in
        </Link>
      </p>

      <Form method="post" className="glass-panel mt-8 space-y-6 p-6 sm:p-8">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            Account
          </h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm text-white/70">
              Username
              <input
                name="username"
                required
                autoComplete="username"
                placeholder="e.g. alex_striker_10"
                className="field mt-1"
                pattern="[a-zA-Z0-9_]{3,24}"
                title="3–24 characters: letters, numbers, underscores"
              />
              <span className="mt-1 block text-xs text-white/40">
                Public handle; letters, numbers, and underscores only.
              </span>
            </label>
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
                autoComplete="new-password"
                minLength={8}
                className="field mt-1"
              />
            </label>
            <label className="block text-sm text-white/70">
              Confirm password
              <input
                name="password_confirm"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                className="field mt-1"
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            Profile
          </h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm text-white/70">
              Full name
              <input name="full_name" required className="field mt-1" />
            </label>
            <label className="block text-sm text-white/70">
              Date of birth
              <input
                name="date_of_birth"
                type="date"
                required
                className="field mt-1"
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            Your sport
          </h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm text-white/70">
              Primary sport
              <select name="sport" required className="field mt-1">
                <option value="">Select…</option>
                {PLAYER_SPORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-white/70">
              Primary position
              <select name="primary_position" className="field mt-1">
                {PLAYER_POSITIONS.map((p) => (
                  <option key={p.value || "none"} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-white/70">
              What are you hoping to get from the platform?{" "}
              <span className="font-normal text-white/40">(optional)</span>
              <textarea
                name="goals"
                rows={3}
                maxLength={2000}
                placeholder="e.g. College recruitment clips, visibility with scouts…"
                className="field mt-1 resize-y"
              />
            </label>
          </div>
        </section>

        {actionData?.error && (
          <p className="text-sm text-red-300">{actionData.error}</p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Creating account…" : "Create account & send verification"}
        </button>

        <p className="text-center text-xs text-white/40">
          Scout accounts are assigned in the database. You&apos;ll receive an
          email to verify before your first login (when email confirmation is
          enabled in Supabase).
        </p>
      </Form>
    </main>
  );
}
