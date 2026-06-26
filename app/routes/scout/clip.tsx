import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/clip";
import { data } from "react-router";
import { requireScout } from "~/lib/auth.server";
import type { HighlightRow, ScoutEvaluationRow } from "~/lib/types";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, user, headers } = await requireScout(request);
  const { highlightId } = params;

  const { data: highlight, error: hErr } = await supabase
    .from("highlights")
    .select("*")
    .eq("id", highlightId)
    .single();

  if (hErr || !highlight) {
    throw new Response("Not found", { status: 404 });
  }

  const { data: evaluations } = await supabase
    .from("scout_evaluations")
    .select("*")
    .eq("highlight_id", highlightId)
    .order("updated_at", { ascending: false });

  const { data: signed } = await supabase.storage
    .from("highlights")
    .createSignedUrl((highlight as HighlightRow).storage_path, 3600);

  const mine = (evaluations ?? []).find(
    (e) => (e as ScoutEvaluationRow).scout_id === user.id,
  ) as ScoutEvaluationRow | undefined;

  return data(
    {
      highlight: highlight as HighlightRow,
      evaluations: (evaluations ?? []) as ScoutEvaluationRow[],
      mine,
      videoUrl: signed?.signedUrl ?? null,
    },
    { headers },
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase, user, headers } = await requireScout(request);
  const { highlightId } = params;
  const form = await request.formData();

  const overall_score = Number(form.get("overall_score") || 0);
  const technical_score = Number(form.get("technical_score") || 0);
  const physical_score = Number(form.get("physical_score") || 0);
  const notes = String(form.get("notes") ?? "").slice(0, 4000);

  const clamp = (n: number) =>
    Number.isFinite(n) ? Math.min(10, Math.max(1, Math.round(n))) : null;

  const { error } = await supabase.from("scout_evaluations").upsert(
    {
      highlight_id: highlightId!,
      scout_id: user.id,
      overall_score: clamp(overall_score),
      technical_score: clamp(technical_score),
      physical_score: clamp(physical_score),
      notes: notes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "highlight_id,scout_id" },
  );

  if (error) {
    return data({ error: error.message }, { status: 400, headers });
  }

  return data({ ok: true }, { headers });
}

export default function ScoutClip() {
  const { highlight, evaluations, mine, videoUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string; ok?: boolean }>();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  return (
    <div className="space-y-8">
      <Link
        to="/scout"
        className="text-sm text-[var(--color-accent)] hover:underline"
      >
        ← Back to all clips
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="glass-panel overflow-hidden p-0">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              className="aspect-video w-full bg-black object-contain"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm text-white/45">
              Could not load signed video URL.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-6">
            <h2 className="font-display text-xl font-semibold text-white">
              {highlight.title || "Highlight"}
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                <dt className="text-white/45">Player</dt>
                <dd className="text-white">{highlight.player_name || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                <dt className="text-white/45">Age at upload</dt>
                <dd className="text-white">{highlight.age_at_upload ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
                <dt className="text-white/45">Uploaded</dt>
                <dd className="text-white/80">
                  {new Date(highlight.uploaded_at).toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between gap-4 pb-1">
                <dt className="text-white/45">Length</dt>
                <dd className="text-white/80">
                  {Number(highlight.duration_seconds).toFixed(1)}s
                </dd>
              </div>
            </dl>
          </div>

          <div className="glass-panel p-6">
            <h3 className="font-display text-lg font-semibold text-white">
              Your evaluation
            </h3>
            <p className="mt-1 text-xs text-white/45">
              Scores use a 1–10 scale. Saved evaluations are visible to other
              scouts on this clip.
            </p>
            <Form method="post" className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <ScoreField
                  name="overall_score"
                  label="Overall"
                  defaultValue={mine?.overall_score ?? 7}
                />
                <ScoreField
                  name="technical_score"
                  label="Technical"
                  defaultValue={mine?.technical_score ?? 7}
                />
                <ScoreField
                  name="physical_score"
                  label="Physical"
                  defaultValue={mine?.physical_score ?? 7}
                />
              </div>
              <label className="block text-sm text-white/70">
                Notes
                <textarea
                  name="notes"
                  rows={4}
                  defaultValue={mine?.notes ?? ""}
                  className="field mt-1 resize-y"
                />
              </label>
              {actionData?.error && (
                <p className="text-sm text-red-300">{actionData.error}</p>
              )}
              {actionData?.ok && (
                <p className="text-sm text-[var(--color-accent)]">Saved.</p>
              )}
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? "Saving…" : "Save evaluation"}
              </button>
            </Form>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6">
        <h3 className="font-display text-lg font-semibold text-white">
          All scout scores
        </h3>
        {evaluations.length === 0 ? (
          <p className="mt-3 text-sm text-white/50">No evaluations yet.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {evaluations.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white/80"
              >
                <div className="flex flex-wrap gap-3 text-xs text-white/45">
                  <span>OVR {e.overall_score ?? "—"}</span>
                  <span>TEC {e.technical_score ?? "—"}</span>
                  <span>PHY {e.physical_score ?? "—"}</span>
                  <span className="text-white/35">
                    {new Date(e.updated_at).toLocaleString()}
                  </span>
                </div>
                {e.notes && (
                  <p className="mt-2 text-sm text-white/70">{e.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ScoreField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number;
}) {
  return (
    <label className="block text-sm text-white/70">
      {label}
      <input
        name={name}
        type="number"
        min={1}
        max={10}
        defaultValue={defaultValue}
        className="field mt-1"
      />
    </label>
  );
}
