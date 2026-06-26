import type { Route } from "./+types/api.webhooks.stripe";
import { getServerEnv } from "~/lib/env.server";
import { getStripe } from "~/lib/stripe.server";
import { createServiceSupabase } from "~/lib/supabase.service.server";

export async function action({ request }: Route.ActionArgs) {
  const stripe = getStripe();
  const { stripeWebhookSecret } = getServerEnv();
  if (!stripe || !stripeWebhookSecret) {
    return new Response("Stripe not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const payload = await request.text();

  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    const userId = session.metadata?.supabase_user_id;
    const checkoutType = session.metadata?.checkout_type;

    if (!userId || !checkoutType) {
      return new Response(null, { status: 200 });
    }

    const admin = createServiceSupabase();

    if (checkoutType === "subscription") {
      await admin
        .from("profiles")
        .update({ subscription_status: "active" })
        .eq("id", userId);
    }

    if (checkoutType === "upload") {
      const { data: row } = await admin
        .from("profiles")
        .select("upload_credits")
        .eq("id", userId)
        .single();

      const next = (row?.upload_credits ?? 0) + 1;
      await admin
        .from("profiles")
        .update({ upload_credits: next })
        .eq("id", userId);
    }
  }

  return new Response(null, { status: 200 });
}
