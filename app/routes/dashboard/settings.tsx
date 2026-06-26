import { useEffect, useMemo, useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/settings";
import { requirePlayer } from "~/lib/auth.server";
import { getServerEnv } from "~/lib/env.server";
import { normalizeSupabaseUrl } from "~/lib/supabase.url";
import { createBrowserSupabase } from "~/lib/supabase.client";
import { buildOnboardingChecklist } from "~/lib/onboarding-checklist";
import { PLAYER_POSITIONS, PLAYER_SPORTS } from "~/lib/player-form-options";
import type { DatabaseProfile } from "~/lib/types";

export function meta() {
  return [{ title: "Profile settings — PitchLedger" }];
}

function nullIfEmpty(s: string): string | null {
  const t = s.trim();
  return t.length ? t : null;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, profile, supabase, headers } = await requirePlayer(request);

  if (!profile) {
    const { data: idProbe, error: idProbeError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    let supabaseApiHost: string | null = null;
    try {
      const raw = getServerEnv().supabaseUrl;
      supabaseApiHost = new URL(normalizeSupabaseUrl(raw)).host;
    } catch {
      supabaseApiHost = null;
    }

    return data(
      {
        profile: null,
        reelCount: 0,
        userId: user.id,
        profileDiagnostics: {
          signedInUserId: user.id,
          canSelectOwnProfileId: Boolean(idProbe?.id),
          profilesProbeError: idProbeError
            ? { code: idProbeError.code, message: idProbeError.message }
            : null,
          supabaseApiHost,
        },
      },
      { headers },
    );
  }

  const { count } = await supabase
    .from("highlights")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return data(
    {
      profile,
      reelCount: count ?? 0,
      userId: user.id,
      profileDiagnostics: undefined,
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, profile, supabase, headers } = await requirePlayer(request);
  if (!profile) {
    return data(
      {
        error:
          "Your profile row could not be loaded. Run the latest Supabase migration (profile columns), then refresh.",
      },
      { status: 400, headers },
    );
  }

  const form = await request.formData();

  const avatar_url = nullIfEmpty(String(form.get("avatar_url") ?? ""));
  const sport = nullIfEmpty(String(form.get("sport") ?? ""));
  const primary_position = String(form.get("primary_position") ?? "").trim();
  const school_name = nullIfEmpty(String(form.get("school_name") ?? ""));
  const city = nullIfEmpty(String(form.get("city") ?? ""));
  const state = nullIfEmpty(String(form.get("state") ?? ""));
  const rawStats = String(form.get("physical_stats") ?? "").trim();
  const physical_stats = rawStats ? rawStats.slice(0, 4000) : null;

  const gy = String(form.get("graduation_year") ?? "").trim();
  let graduation_year: number | null = null;
  if (gy) {
    const n = parseInt(gy, 10);
    if (Number.isNaN(n) || n < 1990 || n > 2040) {
      return data(
        { error: "Graduation year must be between 1990 and 2040." },
        { status: 400, headers },
      );
    }
    graduation_year = n;
  }

  const nextHash = String(form.get("nextHash") ?? "").trim();
  const safeHash = /^[a-z0-9-]+$/i.test(nextHash) ? nextHash : "";

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url,
      sport,
      primary_position: primary_position.length ? primary_position : null,
      school_name,
      graduation_year,
      city,
      state,
      physical_stats,
    })
    .eq("id", user.id);

  if (error) {
    return data({ error: error.message }, { status: 400, headers });
  }

  const target = safeHash ? `/dashboard/settings#${safeHash}` : "/dashboard/settings";
  throw redirect(target, { headers });
}

export default function ProfileSettingsPage() {
  const { profile, reelCount, profileDiagnostics, userId } = useLoaderData<
    typeof loader
  >();
  const actionData = useActionData<{ error?: string }>();
  const location = useLocation();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  const checklist = buildOnboardingChecklist(profile, reelCount);

  if (!profile) {
    return (
      <div className="glass-panel mx-auto max-w-lg space-y-4 p-8 text-center">
        <p className="text-white/80">
          The app could not build a profile object from Supabase. The dashboard
          overview can still show your name from sign-in metadata; settings
          needs a readable <code className="text-white/90">profiles</code>{" "}
          row under your session.
        </p>
        <p className="text-sm text-white/50">
          The Table Editor in the Supabase dashboard uses elevated access and{" "}
          <strong className="font-medium text-white/70">bypasses RLS</strong>.
          Your app uses the anon key and Row Level Security. If you see a row in
          the editor but{" "}
          <code className="text-white/70">profiles_select_own</code> (or your
          policies) don&apos;t allow{" "}
          <code className="text-white/70">select</code> where{" "}
          <code className="text-white/70">auth.uid() = id</code>, the API
          returns no row to the app even though the row exists.
        </p>
        {profileDiagnostics ? (
          <dl className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-left text-xs text-white/60">
            <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
              <dt className="text-white/45">Signed-in user id</dt>
              <dd className="font-mono text-white/80 break-all">
                {profileDiagnostics.signedInUserId}
              </dd>
              <dt className="text-white/45">API as seen by app</dt>
              <dd className="font-mono text-white/80 break-all">
                {profileDiagnostics.supabaseApiHost ?? "(unset)"}
              </dd>
              <dt className="text-white/45">Session can SELECT id</dt>
              <dd className="text-white/80">
                {profileDiagnostics.canSelectOwnProfileId ? "yes" : "no"}
              </dd>
              {profileDiagnostics.profilesProbeError ? (
                <>
                  <dt className="text-white/45">PostgREST error</dt>
                  <dd className="font-mono text-[#f87171] break-all">
                    {profileDiagnostics.profilesProbeError.code}{" "}
                    {profileDiagnostics.profilesProbeError.message}
                  </dd>
                </>
              ) : null}
            </div>
            <p className="mt-3 text-white/45">
              Compare the user id to the <code className="text-white/60">id</code>{" "}
              column on your row. If they differ, you&apos;re on the wrong auth
              user or wrong project in <code className="text-white/60">.env</code>
              . If they match but SELECT is &quot;no&quot; and there is no error
              above, RLS is filtering all rows (often{" "}
              <code className="text-white/60">auth.uid()</code> is null because
              the access token wasn&apos;t sent—try signing out and back in after
              a deploy).
            </p>
          </dl>
        ) : null}
        <Link
          to="/dashboard"
          className="inline-block text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          ← Back to overview
        </Link>
      </div>
    );
  }

  const p: DatabaseProfile = profile;
  const [avatarUrl, setAvatarUrl] = useState<string>(p.avatar_url ?? "");
  const [avatarUploadBusy, setAvatarUploadBusy] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);

  const supabaseBrowser = useMemo(() => {
    try {
      return createBrowserSupabase();
    } catch {
      return null;
    }
  }, []);

  async function onPickAvatar(file: File | null) {
    setAvatarUploadError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarUploadError("Please pick an image file.");
      return;
    }
    const maxBytes = 6 * 1024 * 1024;
    if (file.size > maxBytes) {
      setAvatarUploadError("Please choose an image under 6MB.");
      return;
    }
    if (!supabaseBrowser) {
      setAvatarUploadError(
        "Upload client is not configured. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.",
      );
      return;
    }

    setAvatarUploadBusy(true);
    try {
      const ext =
        file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]+/g, "") ||
        "jpg";
      const objectPath = `${userId}/avatar.${ext}`;

      const { error: uploadErr } = await supabaseBrowser.storage
        .from("avatars")
        .upload(objectPath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
        });

      if (uploadErr) {
        setAvatarUploadError(uploadErr.message);
        return;
      }

      const { data } = supabaseBrowser.storage
        .from("avatars")
        .getPublicUrl(objectPath);
      if (!data?.publicUrl) {
        setAvatarUploadError("Upload succeeded but could not resolve a public URL.");
        return;
      }

      // Bust caches when replacing the same object path.
      setAvatarUrl(`${data.publicUrl}?v=${Date.now()}`);
    } finally {
      setAvatarUploadBusy(false);
    }
  }

  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(`setting-${id}`);
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(t);
  }, [location.hash]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
            Profile settings
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Complete your profile to show up better for scouts. Progress on the
            dashboard updates as you save.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          ← Back to overview
        </Link>
      </div>

      {actionData?.error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {actionData.error}
        </p>
      ) : null}

      <Form method="post" className="space-y-6">
        <input
          type="hidden"
          name="nextHash"
          value={location.hash.replace(/^#/, "")}
          readOnly
          aria-hidden
        />

        <section
          id="setting-photo"
          className="glass-panel scroll-mt-28 space-y-4 p-6 sm:p-8"
        >
          <SectionHeading
            title="Profile photo"
            done={checklist.find((c) => c.id === "photo")?.done ?? false}
          />
          <p className="text-sm text-white/50">
            Upload a photo from your device. We store it in Supabase Storage and
            save the URL to your profile.
          </p>

          <input type="hidden" name="avatar_url" value={avatarUrl} readOnly />

          <div className="grid gap-4 sm:grid-cols-[96px_1fr] sm:items-start">
            <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile photo preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                  No photo
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-white/70">
                Upload photo
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="field mt-1 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white/80 hover:file:bg-white/15"
                  onChange={(e) => void onPickAvatar(e.currentTarget.files?.[0] ?? null)}
                  disabled={avatarUploadBusy}
                />
              </label>

              <label className="block text-sm text-white/70">
                Or paste an image URL
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.currentTarget.value)}
                  placeholder="https://…"
                  className="field mt-1"
                />
              </label>

              {avatarUploadError ? (
                <p className="text-sm text-red-200">{avatarUploadError}</p>
              ) : null}
              {avatarUploadBusy ? (
                <p className="text-sm text-white/50">Uploading…</p>
              ) : null}
            </div>
          </div>
        </section>

        <section
          id="setting-pos"
          className="glass-panel scroll-mt-28 space-y-4 p-6 sm:p-8"
        >
          <SectionHeading
            title="Position & sport"
            done={checklist.find((c) => c.id === "pos")?.done ?? false}
          />
          <label className="block text-sm text-white/70">
            Primary sport
            <select name="sport" className="field mt-1" defaultValue={p.sport ?? ""}>
              <option value="">Select…</option>
              {PLAYER_SPORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-white/70">
            Primary position
            <select
              name="primary_position"
              className="field mt-1"
              defaultValue={p.primary_position ?? ""}
            >
              {PLAYER_POSITIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section
          id="setting-school"
          className="glass-panel scroll-mt-28 space-y-4 p-6 sm:p-8"
        >
          <SectionHeading
            title="School & graduation"
            done={checklist.find((c) => c.id === "school")?.done ?? false}
          />
          <label className="block text-sm text-white/70">
            School name
            <input
              name="school_name"
              className="field mt-1"
              defaultValue={p.school_name ?? ""}
              placeholder="e.g. East High Varsity"
            />
          </label>
          <label className="block text-sm text-white/70">
            Graduation year
            <input
              name="graduation_year"
              type="number"
              min={1990}
              max={2040}
              className="field mt-1"
              defaultValue={p.graduation_year ?? ""}
              placeholder="e.g. 2027"
            />
          </label>
        </section>

        <section
          id="setting-location"
          className="glass-panel scroll-mt-28 space-y-4 p-6 sm:p-8"
        >
          <SectionHeading
            title="City & state"
            done={checklist.find((c) => c.id === "location")?.done ?? false}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-white/70">
              City
              <input
                name="city"
                className="field mt-1"
                defaultValue={p.city ?? ""}
                placeholder="Salt Lake City"
              />
            </label>
            <label className="block text-sm text-white/70">
              State / region
              <input
                name="state"
                className="field mt-1"
                defaultValue={p.state ?? ""}
                placeholder="UT"
              />
            </label>
          </div>
        </section>

        <section
          id="setting-stats"
          className="glass-panel scroll-mt-28 space-y-4 p-6 sm:p-8"
        >
          <SectionHeading
            title="Stats & measurables"
            done={checklist.find((c) => c.id === "stats")?.done ?? false}
          />
          <label className="block text-sm text-white/70">
            Height, weight, pace, vertical, etc.
            <textarea
              name="physical_stats"
              rows={5}
              maxLength={4000}
              className="field mt-1 resize-y"
              defaultValue={p.physical_stats ?? ""}
              placeholder="e.g. height, weight, 40yd time, vertical jump…"
            />
          </label>
        </section>

        <div className="sticky bottom-4 flex justify-end">
          <button type="submit" disabled={busy} className="btn-primary shadow-lg">
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </Form>
    </div>
  );
}

function SectionHeading({ title, done }: { title: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
          done
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
            : "border-white/25 text-transparent"
        }`}
        aria-hidden
      >
        {done ? "✓" : ""}
      </span>
      <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
    </div>
  );
}
