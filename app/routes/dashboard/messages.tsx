import type { Route } from "./+types/messages";
import { data } from "react-router";
import { requirePlayer } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const ctx = await requirePlayer(request);
  return data({}, { headers: ctx.headers });
}

export default function MessagesPage() {
  return (
    <div className="glass-panel p-10 text-center">
      <h2 className="font-display text-xl font-semibold text-white">
        Messages
      </h2>
      <p className="mt-2 text-sm text-white/55">
        Conversations with scouts and coaches will appear here.
      </p>
    </div>
  );
}
