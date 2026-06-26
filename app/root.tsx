import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  useLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { getSessionUser } from "./lib/auth.server";
import type { DatabaseProfile } from "./lib/types";
import { SiteHeader } from "./components/SiteHeader";
import type { User } from "@supabase/supabase-js";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Outfit:wght@400;500;600;700&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { user, profile, headers } = await getSessionUser(request);
  return data(
    { user, profile },
    { headers },
  );
}

export default function App() {
  const { user, profile } = useLoaderData() as {
    user: User | null;
    profile: DatabaseProfile | null;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader user={user} profile={profile} />
      <Outlet context={{ user, profile }} />
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-24">
      <h1 className="font-display text-3xl font-semibold text-white">{message}</h1>
      <p className="mt-3 text-white/65">{details}</p>
      {stack && (
        <pre className="mt-6 w-full overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-white/70">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
