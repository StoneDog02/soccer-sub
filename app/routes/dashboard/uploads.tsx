import {
  data,
  Form,
  Link,
  useFetcher,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/uploads";
import { ageFromDateOfBirth } from "~/lib/age";
import { requirePlayer } from "~/lib/auth.server";
import { getServerEnv } from "~/lib/env.server";
import { createServiceSupabase } from "~/lib/supabase.service.server";
import { createBrowserSupabase } from "~/lib/supabase.client";
import type { HighlightRow } from "~/lib/types";

const MAX_SECONDS = 60;

type ReelWithMeta = HighlightRow & {
  scout_saves: number;
  play_count: number;
  signed_video_url: string | null;
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user, profile, supabase, headers } = await requirePlayer(request);
  const env = getServerEnv();

  const { data: highlights } = await supabase
    .from("highlights")
    .select("*")
    .eq("user_id", user.id)
    .order("uploaded_at", { ascending: false });

  const list = (highlights ?? []) as HighlightRow[];
  const ids = list.map((h) => h.id);

  const saveCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: evalRows } = await supabase
      .from("scout_evaluations")
      .select("highlight_id")
      .in("highlight_id", ids);
    for (const row of evalRows ?? []) {
      const id = (row as { highlight_id: string }).highlight_id;
      saveCounts.set(id, (saveCounts.get(id) ?? 0) + 1);
    }
  }

  const signedPairs = await Promise.all(
    list.map(async (h) => {
      const { data: signed } = await supabase.storage
        .from("highlights")
        .createSignedUrl(h.storage_path, 3600);
      return [h.id, signed?.signedUrl ?? null] as const;
    }),
  );
  const signedById = Object.fromEntries(signedPairs) as Record<
    string,
    string | null
  >;

  const reels: ReelWithMeta[] = list.map((h) => ({
    ...h,
    scout_saves: saveCounts.get(h.id) ?? 0,
    play_count: 0,
    signed_video_url: signedById[h.id] ?? null,
  }));

  return data(
    {
      profile,
      reels,
      stripeReady: env.stripeConfigured,
      userId: user.id,
    },
    { headers },
  );
}

type FinalizePayload = {
  intent: "finalize";
  path: string;
  title: string;
  duration_seconds: number;
  mime_type: string;
  byte_size: number;
};

export async function action({ request }: Route.ActionArgs) {
  const { user, profile, headers } = await requirePlayer(request);
  const json = (await request.json()) as FinalizePayload;

  if (json.intent !== "finalize") {
    return data({ error: "Invalid intent" }, { status: 400, headers });
  }

  const prefix = `${user.id}/`;
  if (!json.path.startsWith(prefix)) {
    return data({ error: "Invalid storage path" }, { status: 400, headers });
  }

  if (
    typeof json.duration_seconds !== "number" ||
    json.duration_seconds <= 0 ||
    json.duration_seconds > MAX_SECONDS
  ) {
    return data(
      { error: `Duration must be between 0 and ${MAX_SECONDS} seconds.` },
      { status: 400, headers },
    );
  }

  if (profile?.subscription_status !== "active") {
    return data(
      { error: "Active subscription required to finalize uploads." },
      { status: 403, headers },
    );
  }

  const admin = createServiceSupabase();
  const { data: prof, error: profErr } = await admin
    .from("profiles")
    .select("upload_credits, full_name, date_of_birth")
    .eq("id", user.id)
    .single();

  if (profErr || !prof || prof.upload_credits < 1) {
    return data(
      { error: "No upload credits available. Purchase one first." },
      { status: 400, headers },
    );
  }

  const age = ageFromDateOfBirth(prof.date_of_birth);

  const { error: insErr } = await admin.from("highlights").insert({
    user_id: user.id,
    storage_path: json.path,
    title: json.title || null,
    duration_seconds: json.duration_seconds,
    player_name: prof.full_name,
    age_at_upload: age,
    mime_type: json.mime_type || null,
    byte_size: json.byte_size,
  });

  if (insErr) {
    return data({ error: insErr.message }, { status: 500, headers });
  }

  await admin
    .from("profiles")
    .update({ upload_credits: prof.upload_credits - 1 })
    .eq("id", user.id);

  return data({ ok: true }, { headers });
}

function slugFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject(new Error("Could not read video metadata"));
    };
    video.src = URL.createObjectURL(file);
  });
}

function formatDuration(seconds: number) {
  const s = Math.round(Number(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatRelative(iso: string) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const day = 864e5;
  if (diff < day) return "Today";
  if (diff < day * 2) return "Yesterday";
  const days = Math.floor(diff / day);
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return `${months} months ago`;
}

type SortKey = "recent" | "oldest" | "interest";

function pickTopReelId(reels: ReelWithMeta[]): string | null {
  if (!reels.length) return null;
  const sorted = [...reels].sort((a, b) => {
    if (b.scout_saves !== a.scout_saves) return b.scout_saves - a.scout_saves;
    if (b.play_count !== a.play_count) return b.play_count - a.play_count;
    return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
  });
  return sorted[0]!.id;
}

export default function UploadsPage() {
  const { profile, reels, stripeReady, userId } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const [params] = useSearchParams();
  const checkout = params.get("checkout");

  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wasSubmitting = useRef(false);

  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dragOver, setDragOver] = useState(false);

  const credits = profile?.upload_credits ?? 0;
  const subscribed = profile?.subscription_status === "active";

  useEffect(() => {
    if (fetcher.state !== "idle") {
      wasSubmitting.current = true;
      return;
    }
    if (!wasSubmitting.current) return;
    wasSubmitting.current = false;
    if (fetcher.data?.ok) revalidator.revalidate();
  }, [fetcher.state, fetcher.data?.ok, revalidator]);

  const sortedReels = useMemo(() => {
    const copy = [...reels];
    if (sort === "recent") {
      copy.sort(
        (a, b) =>
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
      );
    } else if (sort === "oldest") {
      copy.sort(
        (a, b) =>
          new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime(),
      );
    } else {
      copy.sort((a, b) => {
        if (b.scout_saves !== a.scout_saves) return b.scout_saves - a.scout_saves;
        if (b.play_count !== a.play_count) return b.play_count - a.play_count;
        return (
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        );
      });
    }
    return copy;
  }, [reels, sort]);

  const topReelId = useMemo(() => pickTopReelId(reels), [reels]);
  const totalPlays = useMemo(
    () => reels.reduce((n, r) => n + r.play_count, 0),
    [reels],
  );
  const totalScoutSaves = useMemo(
    () => reels.reduce((n, r) => n + r.scout_saves, 0),
    [reels],
  );

  const onFile = useCallback(
    async (file: File | null) => {
      setErr(null);
      setStatus(null);
      if (!file) return;
      if (!file.type.startsWith("video/")) {
        setErr("Please choose a video file.");
        return;
      }
      let duration: number;
      try {
        duration = await readVideoDuration(file);
      } catch {
        setErr("Could not read this video. Try another file.");
        return;
      }
      if (duration > MAX_SECONDS + 0.25) {
        setErr(
          `Clips must be ${MAX_SECONDS} seconds or shorter (this file is ~${Math.ceil(duration)}s).`,
        );
        return;
      }
      if (!subscribed) {
        setErr("You need an active subscription before uploading.");
        return;
      }
      if (credits < 1) {
        setErr("Purchase an upload credit before sending a file.");
        return;
      }

      setStatus("Uploading to your vault…");
      try {
        const supabase = createBrowserSupabase();
        const path = `${userId}/${Date.now()}-${slugFileName(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from("highlights")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });
        if (upErr) {
          setErr(upErr.message);
          setStatus(null);
          return;
        }

        const title = file.name.replace(/\.[^/.]+$/, "");

        fetcher.submit(
          {
            intent: "finalize",
            path,
            title,
            duration_seconds: Math.min(duration, MAX_SECONDS),
            mime_type: file.type,
            byte_size: file.size,
          } satisfies FinalizePayload,
          {
            method: "post",
            action: "/dashboard/uploads",
            encType: "application/json",
          },
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed");
        setStatus(null);
      }
    },
    [credits, subscribed, userId, fetcher],
  );

  const busy = fetcher.state !== "idle";
  const finalizeErr = fetcher.data?.error;

  const openFilePicker = () => fileRef.current?.click();

  const dropzoneClass =
    "relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-accent)]/45 bg-[var(--color-accent)]/[0.04] px-6 py-10 text-center transition hover:border-[var(--color-accent)]/70 hover:bg-[var(--color-accent)]/[0.07]";

  return (
    <div className="w-full space-y-8">
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {checkout === "success" && (
        <p className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm text-[var(--color-accent)]">
          Payment received. Webhook will add your upload credit shortly.
        </p>
      )}

      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          My reels
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55 sm:text-base">
          Manage your highlight clips and track how they&apos;re performing with
          scouts.
        </p>
      </header>

      {reels.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-pitch-900)]/40 p-6 shadow-[0_0_60px_-20px_rgba(62,224,122,0.35)] sm:p-10">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/35 shadow-[0_0_24px_rgba(62,224,122,0.25)]">
              <VideoCameraIcon className="h-7 w-7 text-[var(--color-accent)]" />
            </div>
            <h2 className="mt-6 font-display text-xl font-semibold text-white sm:text-2xl">
              Drop your first highlight
            </h2>
            <p className="mt-2 text-sm text-white/55 sm:text-base">
              60 seconds. Your best play. That&apos;s all it takes to start
              showing up in scout searches.
            </p>
          </div>

          <button
            type="button"
            disabled={busy || !subscribed || credits < 1}
            onClick={openFilePicker}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`${dropzoneClass} mt-8 w-full ${dragOver ? "border-[var(--color-accent)] bg-[var(--color-accent)]/12" : ""} disabled:cursor-not-allowed disabled:opacity-45`}
          >
            <CloudUploadIcon className="h-10 w-10 text-[var(--color-accent)]/90" />
            <span className="font-display text-base font-semibold text-white">
              Drop a clip or click to choose
            </span>
            <span className="text-xs text-white/45 sm:text-sm">
              MP4, MOV · max {MAX_SECONDS} seconds · uses 1 credit
            </span>
          </button>

          <TipsSection className="mt-10" />

          <div className="mt-10 flex justify-center">
            <CreditPurchasePill
              credits={credits}
              subscribed={subscribed}
              stripeReady={stripeReady}
            />
          </div>

          {(err || finalizeErr) && (
            <p className="mt-6 text-center text-sm text-red-300">
              {err || finalizeErr}
            </p>
          )}
          {(status || busy) && (
            <p className="mt-4 text-center text-sm text-white/60">
              {status || "Finalizing…"}
            </p>
          )}

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() =>
                document.getElementById("reels-tips")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition hover:border-white/20 hover:text-white/80"
              aria-label="Scroll to tips"
            >
              <ChevronDownIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/80">
              <span>
                <span className="font-semibold text-white">{reels.length}</span>{" "}
                highlight{reels.length === 1 ? "" : "s"}
              </span>
              <span className="hidden text-white/25 sm:inline" aria-hidden>
                |
              </span>
              <span>
                <span className="font-semibold text-white">{totalPlays}</span>{" "}
                total plays
              </span>
              <span className="hidden text-white/25 sm:inline" aria-hidden>
                |
              </span>
              <span>
                <span className="font-semibold text-white">{totalScoutSaves}</span>{" "}
                scout saves
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <label className="relative inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white/85">
                <SortIcon className="h-4 w-4 text-white/45" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="cursor-pointer appearance-none bg-transparent pr-6 text-sm font-medium outline-none"
                >
                  <option value="recent">Most recent</option>
                  <option value="oldest">Oldest</option>
                  <option value="interest">Most scout interest</option>
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              </label>

              <div className="flex rounded-xl border border-white/10 p-0.5">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  className={`rounded-lg p-2 transition ${view === "grid" ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]" : "text-white/45 hover:text-white/75"}`}
                  aria-label="Grid view"
                >
                  <GridIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  className={`rounded-lg p-2 transition ${view === "list" ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]" : "text-white/45 hover:text-white/75"}`}
                  aria-label="List view"
                >
                  <ListIcon className="h-5 w-5" />
                </button>
              </div>

              <CreditPurchasePill
                credits={credits}
                subscribed={subscribed}
                stripeReady={stripeReady}
              />

              <button
                type="button"
                disabled={busy || !subscribed || credits < 1}
                onClick={openFilePicker}
                className="btn-ghost inline-flex items-center gap-2 border-[var(--color-accent)]/50 py-2 text-sm text-[var(--color-accent)] hover:border-[var(--color-accent)]/70 hover:bg-[var(--color-accent)]/10"
              >
                <CloudUploadIcon className="h-4 w-4" />
                Upload new
              </button>
            </div>
          </div>

          {(err || finalizeErr) && (
            <p className="text-sm text-red-300">{err || finalizeErr}</p>
          )}
          {(status || busy) && (
            <p className="text-sm text-white/60">{status || "Finalizing…"}</p>
          )}

          {view === "grid" ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedReels.map((reel) => (
                <li key={reel.id}>
                  <ReelCard
                    reel={reel}
                    isTop={reel.id === topReelId}
                    videoUrl={reel.signed_video_url}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-3">
              {sortedReels.map((reel) => (
                <li key={reel.id}>
                  <ReelListRow
                    reel={reel}
                    isTop={reel.id === topReelId}
                    videoUrl={reel.signed_video_url}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CreditPurchasePill({
  credits,
  subscribed,
  stripeReady,
}: {
  credits: number;
  subscribed: boolean;
  stripeReady: boolean;
}) {
  const inner = (
    <>
      <LightningIcon className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
      <span className="text-white/70 transition group-hover:text-white">
        You have{" "}
        <span className="font-semibold text-[var(--color-accent)]">
          {credits} upload credit{credits === 1 ? "" : "s"}
        </span>{" "}
        ready to go
      </span>
    </>
  );

  const interactive =
    "group inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-left text-sm shadow-sm transition hover:border-[var(--color-accent)]/55 hover:bg-[var(--color-accent)]/12 hover:shadow-[0_0_28px_-6px_rgba(62,224,122,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";

  if (!stripeReady) {
    return (
      <span
        className="inline-flex max-w-full cursor-not-allowed items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm text-white/40 opacity-80"
        title="Stripe is not configured for checkout yet."
      >
        {inner}
      </span>
    );
  }

  if (!subscribed) {
    return (
      <Link
        to="/dashboard/subscription"
        className={interactive}
        aria-label="Open subscription to buy upload credits"
      >
        {inner}
      </Link>
    );
  }

  return (
    <Form method="post" action="/api/checkout/upload" className="inline">
      <button
        type="submit"
        className={`${interactive} cursor-pointer`}
        aria-label="Buy upload credit with Stripe"
      >
        {inner}
      </button>
    </Form>
  );
}

function TipsSection({ className = "" }: { className?: string }) {
  return (
    <div id="reels-tips" className={className}>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
        <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Tips for a strong first reel
        </p>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        <li className="rounded-xl border border-white/10 bg-black/20 p-4 text-left">
          <ClockIcon className="h-6 w-6 text-[var(--color-accent)]" />
          <h3 className="mt-3 font-display text-sm font-semibold text-white">
            Lead with the moment
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-white/50">
            Scouts decide in 8 seconds. Open with your best play.
          </p>
        </li>
        <li className="rounded-xl border border-white/10 bg-black/20 p-4 text-left">
          <EyeIcon className="h-6 w-6 text-[var(--color-accent)]" />
          <h3 className="mt-3 font-display text-sm font-semibold text-white">
            Stay visible
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-white/50">
            Wear a contrasting jersey or add a circle marker on yourself.
          </p>
        </li>
        <li className="rounded-xl border border-white/10 bg-black/20 p-4 text-left">
          <TargetIcon className="h-6 w-6 text-[var(--color-accent)]" />
          <h3 className="mt-3 font-display text-sm font-semibold text-white">
            Mix the moments
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-white/50">
            Goals, defensive stops, vision plays — show your full game.
          </p>
        </li>
      </ul>
    </div>
  );
}

function ReelCard({
  reel,
  isTop,
  videoUrl,
}: {
  reel: ReelWithMeta;
  isTop: boolean;
  videoUrl: string | null;
}) {
  const age =
    reel.age_at_upload != null ? `age ${reel.age_at_upload}` : null;
  const meta = [
    formatShortDate(reel.uploaded_at),
    age,
    formatRelative(reel.uploaded_at),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-sm transition hover:border-white/15">
      <div className="relative aspect-video bg-[var(--color-pitch-800)]">
        {videoUrl ? (
          <video
            src={videoUrl}
            className="h-full w-full object-cover opacity-80"
            muted
            playsInline
            preload="metadata"
          />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 to-transparent">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/40">
            <PlayIcon className="ml-0.5 h-7 w-7" />
          </span>
        </div>
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
          {formatDuration(reel.duration_seconds)}
        </span>
        {isTop ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-pitch-950)]">
            <TrophyIcon className="h-3 w-3" />
            Top reel
          </span>
        ) : null}
        <details className="absolute right-2 top-2 group">
          <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg bg-black/50 text-white/80 backdrop-blur-sm transition hover:bg-black/65 [&::-webkit-details-marker]:hidden">
            <DotsIcon className="h-5 w-5" />
          </summary>
          <div className="absolute right-0 z-10 mt-1 min-w-[140px] rounded-lg border border-white/10 bg-[var(--color-pitch-900)] py-1 text-sm shadow-xl">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-white/45"
              disabled
            >
              Rename (soon)
            </button>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-white/45"
              disabled
            >
              Delete (soon)
            </button>
          </div>
        </details>
      </div>
      <div className="p-4">
        <h3 className="font-display font-semibold leading-snug text-white line-clamp-2">
          {reel.title?.trim() || "Untitled highlight"}
        </h3>
        <p className="mt-1 text-xs text-white/45">{meta}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-white/55">
          <span className="inline-flex items-center gap-1">
            <PlayIcon className="h-3.5 w-3.5 text-white/40" />
            {reel.play_count} plays
          </span>
          <span className="inline-flex items-center gap-1 text-pink-400">
            <BookmarkIcon className="h-3.5 w-3.5" />
            {reel.scout_saves} saves
          </span>
        </div>
      </div>
    </article>
  );
}

function ReelListRow({
  reel,
  isTop,
  videoUrl,
}: {
  reel: ReelWithMeta;
  isTop: boolean;
  videoUrl: string | null;
}) {
  const age =
    reel.age_at_upload != null ? `age ${reel.age_at_upload}` : null;
  const meta = [
    formatShortDate(reel.uploaded_at),
    age,
    formatRelative(reel.uploaded_at),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl bg-[var(--color-pitch-800)] sm:h-28 sm:w-44">
        {videoUrl ? (
          <video
            src={videoUrl}
            className="h-full w-full object-cover opacity-80"
            muted
            playsInline
            preload="metadata"
          />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
          <PlayIcon className="h-8 w-8 text-[var(--color-accent)]" />
        </div>
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
          {formatDuration(reel.duration_seconds)}
        </span>
        {isTop ? (
          <span className="absolute left-1 top-1 rounded bg-[var(--color-accent)] px-1 py-0.5 text-[8px] font-bold uppercase text-[var(--color-pitch-950)]">
            Top
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display font-semibold text-white line-clamp-2">
          {reel.title?.trim() || "Untitled highlight"}
        </h3>
        <p className="mt-1 text-xs text-white/45">{meta}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/55">
          <span className="inline-flex items-center gap-1">
            <PlayIcon className="h-3.5 w-3.5 text-white/40" />
            {reel.play_count} plays
          </span>
          <span className="inline-flex items-center gap-1 text-pink-400">
            <BookmarkIcon className="h-3.5 w-3.5" />
            {reel.scout_saves} saves
          </span>
        </div>
      </div>
      <details className="relative shrink-0 self-start group">
        <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-white/55 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
          <DotsIcon className="h-5 w-5" />
        </summary>
        <div className="absolute right-0 z-10 mt-1 min-w-[140px] rounded-lg border border-white/10 bg-[var(--color-pitch-900)] py-1 text-sm shadow-xl">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-white/45"
            disabled
          >
            Rename (soon)
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-white/45"
            disabled
          >
            Delete (soon)
          </button>
        </div>
      </details>
    </article>
  );
}

function VideoCameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m15 10 4-2v8l-4-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloudUploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 18a4 4 0 0 1-1.7-7.6A5 5 0 0 1 16.3 8 4 4 0 0 1 17 18H7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 11v6M9 14l3-3 3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SortIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4v16M7 4l2.5 2.5M7 4 4.5 6.5M17 20V4m0 16-2.5-2.5M17 20l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6h13M8 12h13M8 18h13M4 6h.5M4 12h.5M4 18h.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8v2a4 4 0 0 1-8 0V4Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6 6H4a2 2 0 0 0 2 3m12-3h2a2 2 0 0 1-2 3M9 18h6M12 15v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="6" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="18" r="1.75" />
    </svg>
  );
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 4h12v16l-6-4-6 4V4Z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 7v6l4 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
