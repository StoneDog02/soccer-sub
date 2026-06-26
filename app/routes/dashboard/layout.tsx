import { Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { data } from "react-router";
import { requirePlayer } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const ctx = await requirePlayer(request);
  return data(
    { profile: ctx.profile },
    { headers: ctx.headers },
  );
}

export default function DashboardLayout() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-6 sm:px-6">
      <Outlet />
    </main>
  );
}
