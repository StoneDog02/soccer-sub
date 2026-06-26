import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/_index";
import { data } from "react-router";
import { requireScout } from "~/lib/auth.server";
import type { HighlightRow } from "~/lib/types";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await requireScout(request);

  const { data: highlights } = await supabase
    .from("highlights")
    .select("*")
    .order("uploaded_at", { ascending: false });

  return data(
    { highlights: (highlights ?? []) as HighlightRow[] },
    { headers },
  );
}

export default function ScoutIndex() {
  const { highlights } = useLoaderData<typeof loader>();

  return (
    <div className="glass-panel overflow-hidden p-0">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="font-display text-base font-semibold text-white">
          Player highlights
        </h2>
        <p className="mt-1 text-xs text-white/45">
          Name, age at upload, and date are stored with every clip.
        </p>
      </div>
      {highlights.length === 0 ? (
        <p className="px-6 py-10 text-sm text-white/50">
          No highlights in the system yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-6 py-3 font-medium">Player</th>
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Uploaded</th>
                <th className="px-6 py-3 font-medium">Age then</th>
                <th className="px-6 py-3 font-medium">Length</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {highlights.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-white/5 text-white/80 last:border-0"
                >
                  <td className="px-6 py-3 font-medium text-white">
                    {h.player_name || "—"}
                  </td>
                  <td className="px-6 py-3">{h.title || "—"}</td>
                  <td className="px-6 py-3 text-white/55">
                    {new Date(h.uploaded_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-white/55">
                    {h.age_at_upload ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-white/55">
                    {Number(h.duration_seconds).toFixed(1)}s
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      to={`/scout/clips/${h.id}`}
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
