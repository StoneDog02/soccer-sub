import { data, Link, useLoaderData, useSearchParams } from "react-router";
import { useMemo } from "react";
import type { Route } from "./+types/performance";
import { ActivityOverTimeChart } from "~/components/activity-over-time-chart";
import { requirePlayer } from "~/lib/auth.server";
import type { HighlightRow } from "~/lib/types";

type RangeKey = "7d" | "30d" | "90d" | "all";

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requirePlayer(request);

  const { data: highlights } = await supabase
    .from("highlights")
    .select("id, title, uploaded_at")
    .eq("user_id", user.id)
    .order("uploaded_at", { ascending: false })
    .limit(12);

  const reels = (highlights ?? []) as Pick<
    HighlightRow,
    "id" | "title" | "uploaded_at"
  >[];

  return data({ reels, hasReels: reels.length > 0 }, { headers });
}

/** Placeholder analytics until events are stored — swap for real aggregates. */
const DEMO_METRICS = {
  profileViews: { value: 87, deltaPct: 34 },
  scoutViews: { value: 23, deltaPct: 12 },
  reelPlays: { value: 412, deltaPct: 28 },
  saves: { value: 3, deltaAbs: 1 },
};

const DEMO_ACTIVITY = {
  labels: ["Apr 9", "Apr 12", "Apr 15", "Apr 18", "Apr 21", "Apr 24", "Apr 27", "Apr 30", "May 3", "May 6", "May 9"],
  profileViews: [12, 14, 11, 18, 15, 22, 19, 24, 21, 26, 23],
  reelPlays: [28, 35, 42, 38, 55, 48, 62, 58, 71, 65, 72],
  saves: [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
};

const DEMO_WATCH_PCTS = [92, 78, 54, 48, 1];

const DEMO_WATCHERS = [
  { rank: 1, initials: "D1", color: "bg-emerald-500", label: "D1 Soccer programs", scouts: 4, views: 11 },
  { rank: 2, initials: "PC", color: "bg-sky-500", label: "Prep / club academies", scouts: 3, views: 8 },
  { rank: 3, initials: "JC", color: "bg-violet-500", label: "JuCo & NAIA", scouts: 2, views: 5 },
  { rank: 4, initials: "CL", color: "bg-amber-500", label: "Club / ID camps", scouts: 2, views: 3 },
];

const RECOMMENDATIONS = [
  {
    icon: "bulb" as const,
    title: "Your tournament reels are crushing it",
    body: "Game-day footage averages 85% watch-through vs 35% for scrimmage clips. Lean into real-game film for your next upload.",
    cta: "Upload one",
    to: "/dashboard/uploads",
  },
  {
    icon: "chart" as const,
    title: "Add stats to get 2.4x more scout views",
    body: "Profiles with goals, assists, and measurables listed get viewed far more often. Takes 2 minutes.",
    cta: "Add stats",
    to: "/dashboard/settings",
  },
  {
    icon: "scissors" as const,
    title: "Trim 'Preseason scrimmage clips'",
    body: "Watch-through drops at 0:08. Re-cut with your strongest play first — most viewers don't make it past 10 seconds.",
    cta: "Re-upload",
    to: "/dashboard/uploads",
  },
];

export default function PerformancePage() {
  const { reels, hasReels } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const range = (params.get("range") as RangeKey) || "30d";
  const validRange: RangeKey = ["7d", "30d", "90d", "all"].includes(range)
    ? range
    : "30d";

  const setRange = (r: RangeKey) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("range", r);
      return next;
    });
  };

  const watchRows = useMemo(() => {
    if (!hasReels) return [];
    return reels.map((r, i) => ({
      id: r.id,
      title: r.title?.trim() || "Untitled highlight",
      pct: DEMO_WATCH_PCTS[i % DEMO_WATCH_PCTS.length]!,
    }));
  }, [hasReels, reels]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Performance
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/55 sm:text-base">
            How your profile and reels are doing with scouts.
          </p>
        </div>
        <TimeRangeControl value={validRange} onChange={setRange} />
      </header>

      <MetricsRow hasReels={hasReels} />

      <ActivitySection hasReels={hasReels} />

      <div className="grid gap-5 lg:grid-cols-2">
        <WatchThroughCard hasReels={hasReels} rows={watchRows} />
        <WhosWatchingCard hasReels={hasReels} />
      </div>

      <RecommendedSection hasReels={hasReels} />
    </div>
  );
}

function TimeRangeControl({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  const options: { key: RangeKey; label: string }[] = [
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "all", label: "All" },
  ];
  return (
    <div
      className="inline-flex rounded-xl border border-white/10 bg-black/30 p-0.5"
      role="group"
      aria-label="Time range"
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition sm:px-4 sm:text-sm ${
            value === o.key
              ? "bg-[var(--color-pitch-800)] text-[var(--color-accent)] shadow-sm"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MetricsRow({ hasReels }: { hasReels: boolean }) {
  const cards = [
    {
      label: "Profile views",
      icon: <EyeIcon className="h-4 w-4 text-[var(--color-accent)]" />,
      value: hasReels ? DEMO_METRICS.profileViews.value : null,
      trend:
        hasReels ? (
          <span className="text-[var(--color-accent)]">
            ↑ {DEMO_METRICS.profileViews.deltaPct}% vs prev
          </span>
        ) : null,
    },
    {
      label: "Scout views",
      icon: <PersonSearchIcon className="h-4 w-4 text-[var(--color-accent)]" />,
      value: hasReels ? DEMO_METRICS.scoutViews.value : null,
      trend:
        hasReels ? (
          <span className="text-[var(--color-accent)]">
            ↑ {DEMO_METRICS.scoutViews.deltaPct}% vs prev
          </span>
        ) : null,
    },
    {
      label: "Reel plays",
      icon: <PlayIcon className="h-4 w-4 text-[var(--color-accent)]" />,
      value: hasReels ? DEMO_METRICS.reelPlays.value : null,
      trend:
        hasReels ? (
          <span className="text-[var(--color-accent)]">
            ↑ {DEMO_METRICS.reelPlays.deltaPct}% vs prev
          </span>
        ) : null,
    },
    {
      label: "Saves",
      icon: <BookmarkIcon className="h-4 w-4 text-[var(--color-accent)]" />,
      value: hasReels ? DEMO_METRICS.saves.value : null,
      trend:
        hasReels ? (
          <span className="text-[var(--color-accent)]">
            ↑ {DEMO_METRICS.saves.deltaAbs} vs prev
          </span>
        ) : null,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5 sm:py-5"
        >
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/45">
            {c.icon}
            {c.label}
          </div>
          <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-white">
            {c.value == null ? "—" : c.value}
          </p>
          {c.trend ? (
            <p className="mt-1 text-xs text-white/50">{c.trend}</p>
          ) : (
            <p className="mt-1 text-xs text-white/35">&nbsp;</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ActivitySection({ hasReels }: { hasReels: boolean }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-semibold text-white">
          Activity over time
        </h2>
        {hasReels ? (
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-white/70">
              <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
              Profile views
            </span>
            <span className="inline-flex items-center gap-1.5 text-white/70">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              Reel plays
            </span>
            <span className="inline-flex items-center gap-1.5 text-white/70">
              <span className="h-2 w-2 rounded-full bg-pink-400" />
              Saves
            </span>
          </div>
        ) : (
          <p className="text-xs text-white/45">Available after first scout view</p>
        )}
      </div>

      <div className="mt-6">
        {hasReels ? (
          <ActivityOverTimeChart
            labels={DEMO_ACTIVITY.labels}
            profileViews={DEMO_ACTIVITY.profileViews}
            reelPlays={DEMO_ACTIVITY.reelPlays}
            saves={DEMO_ACTIVITY.saves}
          />
        ) : (
          <div className="relative flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 px-6 py-12">
            <div
              className="pointer-events-none absolute inset-6 opacity-[0.07]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, white 0, white 1px, transparent 1px, transparent 80px)",
              }}
            />
            <TrendLineEmptyGlyph className="relative" />
            <p className="relative mt-4 font-display text-base font-semibold text-white">
              Your trend line lives here
            </p>
            <p className="relative mt-2 max-w-sm text-center text-sm text-white/45">
              Once scouts start viewing your profile and reels, you&apos;ll see
              daily activity plotted over your selected range.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function barTone(pct: number) {
  if (pct >= 70) return "bg-[var(--color-accent)]";
  if (pct >= 40) return "bg-amber-400/90";
  return "bg-red-400/90";
}

function WatchThroughCard({
  hasReels,
  rows,
}: {
  hasReels: boolean;
  rows: { id: string; title: string; pct: number }[];
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-white">
          Watch-through by reel
        </h2>
        {hasReels ? (
          <button
            type="button"
            className="text-xs font-medium text-[var(--color-accent)] transition hover:text-[var(--color-accent-dim)]"
          >
            What&apos;s this? →
          </button>
        ) : (
          <span className="text-xs text-white/45">Needs at least 1 reel</span>
        )}
      </div>

      <div className="mt-5 flex-1">
        {hasReels ? (
          <ul className="max-h-[320px] space-y-4 overflow-y-auto pr-1">
            {rows.map((row) => (
              <li key={row.id} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/35 text-[var(--color-accent)]">
                  <PlayIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {row.title}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${barTone(row.pct)}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold tabular-nums text-white/80">
                      {row.pct}%
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="relative flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-white/8 bg-black/15 px-4 py-10">
            <div className="pointer-events-none absolute inset-x-8 bottom-10 space-y-2 opacity-[0.12]">
              <div className="h-2 rounded-full bg-white/30" />
              <div className="h-2 rounded-full bg-white/25" />
              <div className="h-2 w-[80%] rounded-full bg-white/20" />
            </div>
            <ClockPlayIcon className="relative h-12 w-12 text-[var(--color-accent)]" />
            <p className="relative mt-4 text-center font-display text-base font-semibold text-white">
              See how far scouts watch
            </p>
            <p className="relative mt-2 max-w-xs text-center text-sm text-white/45">
              Each reel will show its watch-through — green is great, red means
              re-cut the opening.
            </p>
            <button
              type="button"
              className="relative mt-6 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40"
              aria-label="Scroll list"
            >
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function WhosWatchingCard({ hasReels }: { hasReels: boolean }) {
  return (
    <section className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-white">
          Who&apos;s watching
        </h2>
        {hasReels ? (
          <Link
            to="/dashboard/messages"
            className="text-xs font-medium text-[var(--color-accent)] transition hover:text-[var(--color-accent-dim)]"
          >
            All viewers →
          </Link>
        ) : (
          <span className="text-xs text-white/45">Awaiting scout activity</span>
        )}
      </div>

      <div className="mt-5 flex-1">
        {hasReels ? (
          <ol className="space-y-3">
            {DEMO_WATCHERS.map((w) => (
              <li
                key={w.rank}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5"
              >
                <span className="w-5 text-xs font-semibold text-white/35">
                  {w.rank}
                </span>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${w.color}`}
                >
                  {w.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {w.label}
                  </p>
                  <p className="text-xs text-white/45">
                    {w.scouts} scout{w.scouts === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-white/80">
                  {w.views} views
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-white/8 bg-black/15 px-4 py-10">
            <PersonSearchLargeIcon className="h-12 w-12 text-[var(--color-accent)]" />
            <p className="mt-4 text-center font-display text-base font-semibold text-white">
              Scout interest will show up here
            </p>
            <p className="mt-2 max-w-xs text-center text-sm text-white/45">
              You&apos;ll see which program tiers are watching you most — D1,
              JuCo, club, and more.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function RecommendedSection({ hasReels }: { hasReels: boolean }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--color-pitch-900)]/50 p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold text-white">
        Recommended for you
      </h2>

      {hasReels ? (
        <ul className="mt-5 space-y-3">
          {RECOMMENDATIONS.map((rec) => (
            <li
              key={rec.title}
              className="flex flex-col gap-4 rounded-xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:gap-5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/25">
                <RecIcon kind={rec.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-white sm:text-base">
                  {rec.title}
                </p>
                <p className="mt-1 text-sm text-white/50">{rec.body}</p>
              </div>
              <Link
                to={rec.to}
                className="shrink-0 text-sm font-semibold text-[var(--color-accent)] transition hover:text-[var(--color-accent-dim)] sm:ml-auto"
              >
                {rec.cta} →
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-xl border border-[var(--color-accent)]/20 bg-black/30 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/25">
              <RocketIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-white sm:text-base">
                Upload your first reel to start the engine
              </p>
              <p className="mt-1 text-sm text-white/50">
                Once you have at least one highlight live, this panel will start
                surfacing data-driven tips — what&apos;s working, what to re-cut,
                and what to upload next.
              </p>
            </div>
            <Link
              to="/dashboard/uploads"
              className="btn-ghost inline-flex shrink-0 items-center justify-center gap-2 border-white/20 py-2.5 text-sm font-semibold text-white sm:px-5"
            >
              <CloudUploadIcon className="h-4 w-4 text-[var(--color-accent)]" />
              Upload reel
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function RecIcon({ kind }: { kind: "bulb" | "chart" | "scissors" }) {
  if (kind === "bulb") return <BulbIcon className="h-5 w-5" />;
  if (kind === "chart") return <BarChartIcon className="h-5 w-5" />;
  return <ScissorsIcon className="h-5 w-5" />;
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

function PersonSearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 20a6 6 0 0 1 12 0M17 17l4 4"
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

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 4h12v16l-6-4-6 4V4Z" />
    </svg>
  );
}

/** Empty “Activity over time” — line graph in a soft squircle (matches product mock). */
function TrendLineEmptyGlyph({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-2xl bg-[var(--color-pitch-800)] ring-1 ring-white/[0.08] ${className}`}
      role="img"
      aria-label="Line chart"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        aria-hidden
      >
        <path
          d="M4 18.25h16"
          stroke="var(--color-accent)"
          strokeOpacity={0.45}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M4.5 15.5 7.5 12.5 10.5 14.5 13.5 9.5 16.5 11 19.5 6.5"
          stroke="var(--color-accent)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function ClockPlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 7v6l4 2M9 3h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PersonSearchLargeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4.5 21a7.5 7.5 0 0 1 15 0M16 16l5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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
      />
    </svg>
  );
}

function BulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18h6M10 22h4M12 3a5 5 0 0 0-2 9.7V14h4v-1.3A5 5 0 0 0 12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20V10M10 20V4M16 20v-6M22 20V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m15 9-4 6m0-6 4 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3s4 4 4 9-2 8-2 8H10s-2-3-2-8 4-9 4-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 20h4M8 14h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
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
      />
    </svg>
  );
}
