/** Strip trailing slashes (path kept if present — prefer `publicSiteOrigin()`). */
export function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Canonical origin for auth redirect URLs and Stripe return URLs.
 * Uses only scheme + host (+ port) so `PUBLIC_SITE_URL` cannot accidentally
 * produce `.../something/auth/callback`.
 */
export function publicSiteOrigin(): string {
  const raw = process.env.PUBLIC_SITE_URL?.trim();
  const fallback = "http://localhost:3000";
  if (!raw) return fallback;
  try {
    const href = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    return new URL(href).origin;
  } catch {
    return fallback;
  }
}

/**
 * Base URL for auth email links. Must match Supabase → Authentication →
 * Redirect URLs (including localhost vs 127.0.0.1).
 */
export function resolvePublicOrigin(_request: Request): string {
  return publicSiteOrigin();
}

export function getServerEnv() {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const stripeSecret = process.env.STRIPE_SECRET_KEY ?? "";
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const stripePriceSubscription = process.env.STRIPE_PRICE_SUBSCRIPTION ?? "";
  const stripePriceUpload = process.env.STRIPE_PRICE_UPLOAD ?? "";
  const siteUrl = publicSiteOrigin();

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRole,
    stripeSecret,
    stripeWebhookSecret,
    stripePriceSubscription,
    stripePriceUpload,
    siteUrl,
    stripeConfigured: Boolean(stripeSecret && stripePriceSubscription && stripePriceUpload),
  };
}
