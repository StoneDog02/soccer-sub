import { data, redirect } from "react-router";
import type { Route } from "./+types/api.checkout.upload";
import { requireUser } from "~/lib/auth.server";
import { getServerEnv } from "~/lib/env.server";
import { getStripe } from "~/lib/stripe.server";
import { createSupabase } from "~/lib/supabase.server";

export async function action({ request }: Route.ActionArgs) {
  const { user, profile, headers } = await requireUser(request);
  const stripe = getStripe();
  const env = getServerEnv();

  if (!stripe || !env.stripeConfigured) {
    return data(
      {
        error:
          "Stripe is not configured. Add STRIPE_SECRET_KEY and price IDs to your environment.",
      },
      { status: 503, headers },
    );
  }

  if (profile?.subscription_status !== "active") {
    return data(
      { error: "An active subscription is required before purchasing uploads." },
      { status: 400, headers },
    );
  }

  let customerId = profile?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    const { supabase } = createSupabase(request);
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: env.stripePriceUpload, quantity: 1 }],
    success_url: `${env.siteUrl}/dashboard/uploads?checkout=success`,
    cancel_url: `${env.siteUrl}/dashboard/uploads?checkout=cancel`,
    metadata: {
      supabase_user_id: user.id,
      checkout_type: "upload",
    },
  });

  if (!session.url) {
    return data({ error: "Could not start checkout." }, { status: 500, headers });
  }

  throw redirect(session.url);
}
