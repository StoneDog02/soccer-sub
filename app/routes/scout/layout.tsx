import { NavLink, Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { data } from "react-router";
import { requireScout } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const ctx = await requireScout(request);
  return data({ profile: ctx.profile }, { headers: ctx.headers });
}

export default function ScoutLayout() {
  return (
    <div className="mx-auto max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
          Scout workspace
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Review highlight reels, log scores, and track evaluations over time.
        </p>
      </div>
      <nav className="mt-8 flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <NavLink
          to="/scout"
          end
          className={({ isActive }) =>
            `rounded-lg border px-4 py-2 text-sm font-medium transition ${
              isActive ? "tab-active" : "tab-idle"
            }`
          }
        >
          All clips
        </NavLink>
      </nav>
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  );
}
