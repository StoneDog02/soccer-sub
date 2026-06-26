import {
  Form,
  Link,
  data,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/signup.check-email";
import { resolvePublicOrigin } from "~/lib/env.server";
import { createSupabase } from "~/lib/supabase.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Check your email — PitchLedger" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email") ?? "";
  const { supabase, headers } = createSupabase(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    throw redirect("/dashboard", { headers });
  }
  return data({ email }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabase(request);
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  if (!email) {
    return data({ error: "Email is required." }, { status: 400, headers });
  }
  const origin = resolvePublicOrigin(request);
  const emailRedirectTo = new URL("/auth/callback", `${origin}/`).href;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });
  if (error) {
    return data({ error: error.message }, { status: 400, headers });
  }
  return data({ ok: true as const }, { headers });
}

export default function SignupCheckEmail() {
  const { email } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-semibold text-white">
        Verify your email
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-white/60">
        We sent a confirmation link to{" "}
        <span className="font-medium text-white">{email || "your inbox"}</span>
        . Click the link in that email to activate your account—you&apos;ll be
        taken straight to your dashboard.
      </p>
      <div className="glass-panel mt-8 space-y-4 p-6">
        <p className="text-sm text-white/55">
          No message after a minute? Check spam, or resend the verification
          email.
        </p>
        <Form method="post" className="space-y-3">
          <input type="hidden" name="email" value={email} />
          <button type="submit" disabled={busy || !email} className="btn-ghost w-full">
            {busy ? "Sending…" : "Resend verification email"}
          </button>
        </Form>
        {actionData && "error" in actionData && actionData.error && (
          <p className="text-sm text-red-300">{actionData.error}</p>
        )}
        {actionData && "ok" in actionData && actionData.ok && (
          <p className="text-sm text-[var(--color-accent)]">
            Verification email sent again.
          </p>
        )}
      </div>
      <p className="mt-8 text-center text-sm text-white/45">
        Wrong address?{" "}
        <Link to="/signup" className="text-[var(--color-accent)] hover:underline">
          Start over
        </Link>
        {" · "}
        <Link to="/login" className="text-white/70 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
