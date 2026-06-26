import { Form, useLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/subscription";
import { data } from "react-router";
import { requirePlayer } from "~/lib/auth.server";
import { getServerEnv } from "~/lib/env.server";

export async function loader({ request }: Route.LoaderArgs) {
  const ctx = await requirePlayer(request);
  const env = getServerEnv();
  return data(
    {
      profile: ctx.profile,
      stripeReady: env.stripeConfigured,
    },
    { headers: ctx.headers },
  );
}

export default function SubscriptionPage() {
  const { profile, stripeReady } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const checkout = params.get("checkout");

  const status = profile?.subscription_status ?? "none";

  return (
    <div className="max-w-xl space-y-6">
      {checkout === "success" && (
        <p className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm text-[var(--color-accent)]">
          Checkout completed. It may take a moment for your subscription to
          activate via webhook.
        </p>
      )}
      {checkout === "cancel" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Checkout canceled—no charges were made.
        </p>
      )}

      <div className="glass-panel p-6">
        <h2 className="font-display text-lg font-semibold text-white">
          Monthly membership
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Pricing is wired to Stripe—set your{" "}
          <code className="rounded bg-black/40 px-1 text-[var(--color-accent)]">
            STRIPE_PRICE_SUBSCRIPTION
          </code>{" "}
          when you are ready. Webhooks keep this status in sync with Supabase.
        </p>
        <div className="mt-6 rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-wide text-white/45">
            Current status
          </p>
          <p className="mt-1 text-lg font-medium capitalize text-white">
            {status.replace("_", " ")}
          </p>
        </div>
        {!stripeReady ? (
          <p className="mt-6 text-sm text-amber-200/90">
            Stripe environment variables are missing. Add keys from{" "}
            <code className="rounded bg-black/40 px-1">.env.example</code> to
            enable live checkout.
          </p>
        ) : status !== "active" ? (
          <Form method="post" action="/api/checkout/subscription" className="mt-6">
            <button type="submit" className="btn-primary">
              Start subscription checkout
            </button>
          </Form>
        ) : (
          <p className="mt-6 text-sm text-[var(--color-accent)]">
            You are subscribed. Upload credits are purchased separately on the
            Highlights tab.
          </p>
        )}
      </div>
    </div>
  );
}
