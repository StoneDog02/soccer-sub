import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("signup/check-email", "routes/signup.check-email.tsx"),
  route("logout", "routes/logout.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  ...prefix("api", [
    route("webhooks/stripe", "routes/api.webhooks.stripe.tsx"),
    route("checkout/subscription", "routes/api.checkout.subscription.tsx"),
    route("checkout/upload", "routes/api.checkout.upload.tsx"),
  ]),
  ...prefix("dashboard", [
    layout("routes/dashboard/layout.tsx", [
      index("routes/dashboard/_index.tsx"),
      route("subscription", "routes/dashboard/subscription.tsx"),
      route("uploads", "routes/dashboard/uploads.tsx"),
      route("performance", "routes/dashboard/performance.tsx"),
      route("messages", "routes/dashboard/messages.tsx"),
      route("settings", "routes/dashboard/settings.tsx"),
    ]),
  ]),
  ...prefix("scout", [
    layout("routes/scout/layout.tsx", [
      index("routes/scout/_index.tsx"),
      route("clips/:highlightId", "routes/scout/clip.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
