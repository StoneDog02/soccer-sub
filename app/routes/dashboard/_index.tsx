import { useState, type ReactNode } from "react";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/_index";
import { data } from "react-router";
import { ageFromDateOfBirth } from "~/lib/age";
import { requirePlayer } from "~/lib/auth.server";
import {
  formatPositionSportLine,
  initialsForPlayerDisplay,
  resolvePlayerDisplayName,
} from "~/lib/display-name";
import { buildOnboardingChecklist } from "~/lib/onboarding-checklist";
import { resolveDateOfBirthForAge } from "~/lib/profile-questionnaire";
import type { DatabaseProfile, HighlightRow } from "~/lib/types";

export async function loader({ request }: Route.LoaderArgs) {
  const { user, profile, supabase, headers } = await requirePlayer(request);

  const { data: highlights } = await supabase
    .from("highlights")
    .select("id, title, uploaded_at, duration_seconds")
    .eq("user_id", user.id)
    .order("uploaded_at", { ascending: false })
    .limit(12);

  const { count: reelCount } = await supabase
    .from("highlights")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return data(
    {
      profile,
      authMetaFullName: user.user_metadata?.full_name ?? null,
      authUserMetadata: user.user_metadata ?? null,
      reelCount: reelCount ?? 0,
      highlights: (highlights ?? []) as Pick<
        HighlightRow,
        "id" | "title" | "uploaded_at" | "duration_seconds"
      >[],
      // TODO: count from `highlight_saves` or similar when scouts can save reels
      savedByScoutsTotal: 0,
      savedByScoutsThisWeek: 0,
    },
    { headers },
  );
}

export default function DashboardOverview() {
  const {
    profile,
    authMetaFullName,
    authUserMetadata,
    highlights,
    reelCount,
    savedByScoutsTotal,
    savedByScoutsThisWeek,
  } = useLoaderData<typeof loader>();

  const name = resolvePlayerDisplayName(profile, authMetaFullName);
  const initials = initialsForPlayerDisplay(name);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUrl = profile?.avatar_url?.trim() ? profile.avatar_url.trim() : null;
  const showAvatar = Boolean(avatarUrl && !avatarFailed);
  const age = ageFromDateOfBirth(
    resolveDateOfBirthForAge(profile, authUserMetadata),
  );
  const positionLine = formatPositionSportLine(
    profile?.primary_position,
    profile?.sport,
  );
  const schoolLabel = profile?.school_name?.trim() || null;
  const locationLabel = formatLocation(
    profile?.city?.trim() || null,
    profile?.state?.trim() || null,
  );
  const sub = profile?.subscription_status ?? "none";
  const credits = profile?.upload_credits ?? 0;

  const checklist = buildOnboardingChecklist(profile, reelCount);
  const completedCount = checklist.filter((c) => c.done).length;
  const profilePct = Math.round((completedCount / checklist.length) * 100);
  const remaining = checklist.filter((c) => !c.done).length;

  return (
    <div className="space-y-8">
      {/* Profile summary */}
      <section className="glass-panel relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/8 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent)] text-xl font-bold text-[var(--color-pitch-950)] ring-4 ring-[var(--color-accent)]/25 sm:h-24 sm:w-24 sm:text-2xl">
              {showAvatar ? (
                <img
                  src={avatarUrl!}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {name}
              </h1>
              <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <li
                  className={`flex items-center gap-1.5 ${positionLine ? "text-[var(--color-muted)]" : "text-white/40"}`}
                >
                  <TargetIcon
                    className={`h-4 w-4 shrink-0 ${positionLine ? "text-[var(--color-accent)]/80" : ""}`}
                  />
                  {positionLine ?? "Position not set yet"}
                </li>
                <li
                  className={`flex items-center gap-1.5 ${age != null ? "text-[var(--color-muted)]" : "text-white/40"}`}
                >
                  <CalendarIcon
                    className={`h-4 w-4 shrink-0 ${age != null ? "text-[var(--color-accent)]/80" : ""}`}
                  />
                  {age != null ? `${age} yrs` : "Age not set yet"}
                </li>
                <li
                  className={`flex items-center gap-1.5 ${schoolLabel ? "text-[var(--color-muted)]" : "text-white/40"}`}
                >
                  <SchoolIcon
                    className={`h-4 w-4 shrink-0 ${schoolLabel ? "text-[var(--color-accent)]/80" : ""}`}
                  />
                  {schoolLabel ?? "School not set"}
                </li>
                <li
                  className={`flex items-center gap-1.5 ${locationLabel ? "text-[var(--color-muted)]" : "text-white/40"}`}
                >
                  <PinIcon
                    className={`h-4 w-4 shrink-0 ${locationLabel ? "text-[var(--color-accent)]/80" : ""}`}
                  />
                  {locationLabel ?? "Location not set"}
                </li>
              </ul>
              <div className="mt-5 max-w-md">
                <div className="flex items-baseline justify-between gap-2 text-xs text-white/50">
                  <span>Profile {profilePct}% complete</span>
                  <span>{remaining > 0 ? `${remaining} to go` : "Complete"}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-[width]"
                    style={{ width: `${profilePct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <button
              type="button"
              title="Preview how scouts see you (coming soon)"
              className="btn-ghost inline-flex items-center justify-center gap-2 py-2.5 text-sm opacity-70"
              disabled
            >
              <EyeIcon className="h-4 w-4" />
              View as scout
            </button>
            <Link
              to="/dashboard/settings"
              className="btn-ghost inline-flex items-center justify-center gap-2 py-2.5 text-sm"
            >
              <PencilIcon className="h-4 w-4" />
              Edit profile
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Profile views"
          value="—"
          hint="Analytics not wired yet"
        />
        <MetricCard
          label="Scout views"
          value="—"
          hint="Analytics not wired yet"
        />
        <MetricCard
          label="Reel plays"
          value="—"
          hint="Plays per reel TBD"
        />
        <SavedByScoutsKpi
          total={savedByScoutsTotal}
          thisWeek={savedByScoutsThisWeek}
        />
      </section>

      {/* Upload + membership */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel relative p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-white">
              Add a highlight
            </h2>
            <Link
              to="/dashboard/uploads"
              className="shrink-0 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              Upload tips →
            </Link>
          </div>
          <Link
            to="/dashboard/uploads"
            className="mt-5 flex min-h-[11rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-[var(--color-pitch-800)]/40 px-4 py-10 text-center transition hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-pitch-800)]/60"
          >
            <CloudUploadIcon className="h-10 w-10 text-[var(--color-accent)]/90" />
            <p className="mt-3 text-sm font-medium text-white">
              Drop a clip or click to choose
            </p>
            <p className="mt-1 text-xs text-white/45">
              MP4, MOV · max 60 seconds · uses 1 credit
            </p>
          </Link>
        </div>

        <div className="glass-panel p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-white">
              Membership
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                sub === "active"
                  ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                  : "bg-white/10 text-white/60"
              }`}
            >
              {sub === "active" ? "Active" : sub.replace("_", " ")}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/50">
            Renewal date and price sync from Stripe once billing metadata is
            stored.{" "}
            <Link
              to="/dashboard/subscription"
              className="text-[var(--color-accent)] hover:underline"
            >
              Manage plan
            </Link>
          </p>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
            <span className="text-sm text-white/55">Credits available</span>
            <span className="font-display text-2xl font-semibold text-white">
              {credits}
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              to="/dashboard/uploads"
              className="btn-primary flex-1 text-center text-sm"
            >
              + Buy more credits
            </Link>
          </div>
        </div>
      </section>

      {/* Activity + checklist */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel p-6 sm:p-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-white">
              Recent activity
            </h2>
            <span className="text-xs text-white/35">Feed TBD</span>
          </div>
          <ul className="mt-4 space-y-4 text-sm">
            <li className="flex gap-3 text-white/45">
              <span className="mt-0.5 shrink-0 text-[var(--color-muted)]">
                <EyeIcon className="h-4 w-4" />
              </span>
              <span>
                Profile views, messages, and milestones will show here once
                events are logged.
              </span>
            </li>
          </ul>
        </div>

        <div className="glass-panel p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold text-white">
            Get scouted faster
          </h2>
          <ul className="mt-5 space-y-1">
            {checklist.map((item) => (
              <li key={item.id}>
                <Link
                  to={
                    item.id === "reel1"
                      ? "/dashboard/uploads"
                      : `/dashboard/settings#${item.id}`
                  }
                  className="group -mx-1 flex items-start gap-3 rounded-xl px-1 py-2 text-sm transition hover:bg-white/[0.06]"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      item.done
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                        : "border-white/20 bg-transparent text-transparent"
                    }`}
                    aria-hidden
                  >
                    {item.done ? "✓" : ""}
                  </span>
                  <span
                    className={
                      item.done
                        ? "text-white/40 line-through group-hover:text-white/55"
                        : "text-white/85 group-hover:text-white"
                    }
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reels strip */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-white">
            Your reels
          </h2>
          <Link
            to="/dashboard/uploads"
            className="text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            Manage all →
          </Link>
        </div>
        {highlights.length === 0 ? (
          <div className="glass-panel px-6 py-12 text-center text-sm text-white/50">
            No reels yet. Upload a clip to populate this row (thumbnails use
            signed URLs next).
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.slice(0, 3).map((h) => (
              <li key={h.id}>
                <Link
                  to="/dashboard/uploads"
                  className="group block overflow-hidden rounded-2xl border border-white/10 bg-[var(--color-pitch-800)]/80 transition hover:border-[var(--color-accent)]/35"
                >
                  <div className="relative flex aspect-video items-center justify-center bg-gradient-to-b from-[var(--color-pitch-800)] to-[#0a160e]">
                    <PlayTriangleIcon className="h-12 w-12 text-[var(--color-accent)]/90 transition group-hover:scale-105" />
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-0.5 text-xs font-medium text-white/90 tabular-nums">
                      {formatDuration(h.duration_seconds)}
                    </span>
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="line-clamp-2 font-medium text-white">
                      {h.title?.trim() || "Untitled reel"}
                    </p>
                    <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                      <span>{formatShortDate(h.uploaded_at)}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <EyeIcon className="h-3.5 w-3.5" />
                        —
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatLocation(city: string | null, state: string | null) {
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  return null;
}

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: ReactNode;
}) {
  return (
    <div className="glass-panel p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-white/45">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-white">
        {value}
      </p>
      <div className="mt-1 text-xs text-white/40">{hint}</div>
    </div>
  );
}

function SavedByScoutsKpi({ total, thisWeek }: { total: number; thisWeek: number }) {
  return (
    <div className="flex h-full min-h-[9.5rem] flex-col rounded-2xl border border-[var(--color-accent)]/50 bg-[var(--color-pitch-900)]/90 p-5 ring-1 ring-[var(--color-accent)]/15">
      <div className="flex items-center gap-2 text-[var(--color-accent)]">
        <BookmarkIcon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          Saved by scouts
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-bold tabular-nums tracking-tight text-white">
        {total}
      </p>
      <p className="mt-auto flex items-center gap-1.5 pt-3 text-sm font-medium text-[var(--color-accent)]">
        <span className="text-base leading-none" aria-hidden>
          ↑
        </span>
        <span>
          {thisWeek} this week
        </span>
      </p>
    </div>
  );
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden
    >
      <path
        d="M6 4h12v16l-6-4-6 4V4Z"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SchoolIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10 12 6l8 4-8 4-8-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 12v5l4 2 4-2v-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
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
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m15 5 4 4M3 21l8.5-1.5L20 10.5 15.5 6 4.5 17 3 21Z"
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
        d="M7 18a4 4 0 0 1 0-8 1 1 0 0 0 1-1 5 5 0 0 1 9.9 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M12 12v9m-3.5-3.5L12 21l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 8.5v7l6-3.5-6-3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
