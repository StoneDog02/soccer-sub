import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Form, Link, NavLink } from "react-router";
import type { User } from "@supabase/supabase-js";
import {
  initialsForPlayerDisplay,
  resolvePlayerDisplayName,
} from "~/lib/display-name";
import type { DatabaseProfile } from "~/lib/types";

const playerDashboardTabs = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/uploads", label: "My Reels", end: false },
  { to: "/dashboard/performance", label: "Performance", end: false },
  { to: "/dashboard/messages", label: "Messages", end: false },
] as const;

export function SiteHeader({
  user,
  profile,
}: {
  user: User | null;
  profile: DatabaseProfile | null;
}) {
  // Only show player dashboard tabs when we know this is a player (null profile ≠ player).
  const showPlayerNav = Boolean(user && profile?.role === "player");

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[var(--color-pitch-950)]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:h-[4.25rem] sm:gap-6 sm:px-6">
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-2.5"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/20 text-base ring-1 ring-[var(--color-accent)]/35"
            aria-hidden
          >
            <PitchGlyph className="h-5 w-5 text-[var(--color-accent)]" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-white">
            Pitch<span className="text-gradient">Ledger</span>
          </span>
        </Link>

        {showPlayerNav ? (
          <nav
            className="flex min-w-0 flex-1 justify-center px-1"
            aria-label="Dashboard"
          >
            <ul className="flex max-w-full items-center justify-center gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] px-2 sm:gap-8 sm:px-4 md:gap-10 [&::-webkit-scrollbar]:hidden">
              {playerDashboardTabs.map((t) => (
                <li key={t.to} className="shrink-0">
                  <NavLink
                    to={t.to}
                    end={t.end}
                    className={({ isActive }) =>
                      [
                        "block whitespace-nowrap py-2 text-xs font-medium transition sm:text-sm",
                        isActive
                          ? "text-[var(--color-accent)]"
                          : "text-white/55 hover:text-white/90",
                      ].join(" ")
                    }
                  >
                    {t.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <div className="min-w-0 flex-1" aria-hidden />
        )}

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {user && profile?.role === "scout" && (
            <NavLink
              to="/scout"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`
              }
            >
              Scout
            </NavLink>
          )}
          {user ? (
            <PlayerHeaderActions
              user={user}
              profile={profile}
              showNotifications={showPlayerNav}
            />
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white sm:block"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="btn-primary !py-2 !text-xs sm:!text-sm"
              >
                Join
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function PlayerHeaderActions({
  user,
  profile,
  showNotifications,
}: {
  user: User;
  profile: DatabaseProfile | null;
  showNotifications: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const drawerId = useId();
  const titleId = `${drawerId}-title`;

  const displayName = resolvePlayerDisplayName(
    profile,
    user.user_metadata?.full_name,
  );
  const initials = initialsForPlayerDisplay(displayName);
  const primaryLabel =
    displayName !== "Your profile" ? displayName : user.email ?? "Account";
  const avatarUrl = profile?.avatar_url?.trim() ? profile.avatar_url.trim() : null;
  const showAvatar = Boolean(avatarUrl && !avatarFailed);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <>
      {showNotifications && (
        <button
          type="button"
          className="relative rounded-lg p-2 text-white/50 transition hover:bg-white/5 hover:text-white/85"
          aria-label="Notifications"
        >
          <BellIcon className="h-5 w-5" />
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-pitch-950)]"
            aria-hidden
          />
        </button>
      )}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-[var(--color-pitch-950)] ring-2 ring-[var(--color-pitch-950)] transition hover:ring-[var(--color-accent)]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        aria-expanded={drawerOpen}
        aria-controls={drawerId}
        aria-label="Open account menu"
        title={primaryLabel}
      >
        {showAvatar ? (
          <img
            src={avatarUrl!}
            alt=""
            className="h-full w-full rounded-full object-cover"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          initials
        )}
      </button>

      {drawerOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[200]">
              <button
                type="button"
                className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
                aria-label="Close account menu"
                onClick={() => setDrawerOpen(false)}
              />
              <aside
                id={drawerId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-white/10 bg-[var(--color-pitch-900)] shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <h2
                    id={titleId}
                    className="font-display text-lg font-semibold tracking-tight text-white"
                  >
                    Account
                  </h2>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent)] text-base font-bold text-[var(--color-pitch-950)]">
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
                      <p className="truncate font-medium text-white">{primaryLabel}</p>
                      {user.email && displayName !== "Your profile" ? (
                        <p className="mt-0.5 truncate text-sm text-white/45">
                          {user.email}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-white/40">
                      Signed in as
                    </p>
                    <p className="mt-1 break-all text-sm text-white/80">{user.email}</p>
                  </div>
                  <Link
                    to="/dashboard/settings"
                    onClick={() => setDrawerOpen(false)}
                    className="btn-ghost flex w-full justify-center border-white/15 py-3 text-sm text-white/90"
                  >
                    Profile settings
                  </Link>
                  <Form action="/logout" method="post" className="mt-auto">
                    <button
                      type="submit"
                      className="btn-ghost w-full justify-center border-white/15 py-3 text-white/90"
                    >
                      Sign out
                    </button>
                  </Form>
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function PitchGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 3v18M3 12h18M7 7l10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.45"
      />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a5 5 0 0 0-5 5v3.09L5.2 16.5h13.6L17 11.09V8a5 5 0 0 0-5-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 18a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
