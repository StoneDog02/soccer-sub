import Stripe from "stripe";
import { getServerEnv } from "./env.server";

export function getStripe(): Stripe | null {
  const { stripeSecret } = getServerEnv();
  if (!stripeSecret) return null;
  return new Stripe(stripeSecret);
}
