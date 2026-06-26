import { redirect } from "react-router";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ageFromDateOfBirth } from "./age";
import {
  normalizeDateOfBirthInput,
  questionnaireFromUserMetadata,
} from "./profile-questionnaire";
import { createSupabase } from "./supabase.server";
import type { DatabaseProfile } from "./types";

const PROFILE_SELECT =
  "id, role, username, full_name, date_of_birth, sport, primary_position, goals, school_name, graduation_year, city, state, avatar_url, physical_stats, stripe_customer_id, subscription_status, upload_credits" as const;

/** After signup questionnaire migration, before school + settings columns. */
const PROFILE_SELECT_LEGACY =
  "id, role, username, full_name, date_of_birth, sport, primary_position, goals, school_name, city, state, stripe_customer_id, subscription_status, upload_credits" as const;

/** Original `init` table only — works when later migrations were never applied. */
const PROFILE_SELECT_MINIMAL =
  "id, role, full_name, date_of_birth, stripe_customer_id, subscription_status, upload_credits" as const;

function padProfileToFullShape(
  row: Record<string, unknown>,
  extras: Partial<DatabaseProfile> = {},
): DatabaseProfile {
  return {
    id: String(row.id),
    role: row.role as DatabaseProfile["role"],
    username: (row.username as string | null | undefined) ?? null,
    full_name: (row.full_name as string | null | undefined) ?? null,
    date_of_birth: (row.date_of_birth as string | null | undefined) ?? null,
    sport: (row.sport as string | null | undefined) ?? null,
    primary_position: (row.primary_position as string | null | undefined) ?? null,
    goals: (row.goals as string | null | undefined) ?? null,
    school_name: (row.school_name as string | null | undefined) ?? null,
    graduation_year:
      (row.graduation_year as number | null | undefined) ?? null,
    city: (row.city as string | null | undefined) ?? null,
    state: (row.state as string | null | undefined) ?? null,
    avatar_url: (row.avatar_url as string | null | undefined) ?? null,
    physical_stats: (row.physical_stats as string | null | undefined) ?? null,
    stripe_customer_id:
      (row.stripe_customer_id as string | null | undefined) ?? null,
    subscription_status: row.subscription_status as DatabaseProfile["subscription_status"],
    upload_credits: Number(row.upload_credits ?? 0),
    ...extras,
  };
}

function isNoMatchingRowError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "PGRST116" ||
    /0 rows|single JSON object|Results contain 0 rows/i.test(msg)
  );
}

type ProfileRowQuery = {
  data: Record<string, unknown> | null;
  error: { code?: string; message?: string } | null;
};

async function selectProfileRow(
  supabase: SupabaseClient,
  userId: string,
  columns: string,
): Promise<ProfileRowQuery> {
  const result = await supabase
    .from("profiles")
    .select(columns)
    .eq("id", userId)
    .single();
  return result as ProfileRowQuery;
}

/**
 * Auth users should always have a `profiles` row (see `handle_new_user` trigger in
 * migrations). Remote projects sometimes skip that migration—insert is allowed by
 * RLS (`profiles_insert_own`) so we can recover on first request.
 */
async function ensureProfileRowForUser(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  const meta = user.user_metadata ?? {};
  const rawName = meta.full_name;
  const full_name =
    typeof rawName === "string" && rawName.trim().length > 0
      ? rawName.trim()
      : null;

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    full_name,
  });

  if (error && error.code !== "23505") {
    console.warn("[auth] profiles insert (self-heal):", error.message);
  }
}

async function fetchUserProfileRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<DatabaseProfile | null> {
  const primary = await selectProfileRow(supabase, userId, PROFILE_SELECT);
  if (primary.data && "id" in primary.data) {
    return primary.data as unknown as DatabaseProfile;
  }
  if (isNoMatchingRowError(primary.error ?? null)) {
    return null;
  }

  const legacy = await selectProfileRow(
    supabase,
    userId,
    PROFILE_SELECT_LEGACY,
  );
  if (legacy.data && "id" in legacy.data) {
    return padProfileToFullShape(legacy.data, {
      graduation_year: null,
      avatar_url: null,
      physical_stats: null,
    });
  }
  if (isNoMatchingRowError(legacy.error ?? null)) {
    return null;
  }

  const minimal = await selectProfileRow(
    supabase,
    userId,
    PROFILE_SELECT_MINIMAL,
  );
  if (!minimal.data || !("id" in minimal.data)) {
    return null;
  }

  return padProfileToFullShape(minimal.data, {
    username: null,
    sport: null,
    primary_position: null,
    goals: null,
    school_name: null,
    graduation_year: null,
    city: null,
    state: null,
    avatar_url: null,
    physical_stats: null,
  });
}

async function mergeProfileRowWithAuthQuestionnaire(
  supabase: SupabaseClient,
  user: User,
  profile: DatabaseProfile,
): Promise<DatabaseProfile> {
  const q = questionnaireFromUserMetadata(user);
  const updates: Record<string, string> = {};

  if (!profile.full_name?.trim() && q.full_name) {
    updates.full_name = q.full_name;
  }

  const rowDobRaw =
    profile.date_of_birth != null ? String(profile.date_of_birth).trim() : "";
  const rowDobNorm = rowDobRaw
    ? normalizeDateOfBirthInput(rowDobRaw)
    : null;
  const metaDobNorm = q.date_of_birth
    ? normalizeDateOfBirthInput(q.date_of_birth)
    : null;
  const rowAge = ageFromDateOfBirth(rowDobNorm ?? rowDobRaw);

  if (metaDobNorm && (!rowDobRaw || rowAge == null)) {
    updates.date_of_birth = metaDobNorm;
  } else if (rowDobNorm && rowDobNorm !== rowDobRaw) {
    updates.date_of_birth = rowDobNorm;
  }

  if (!profile.sport?.trim() && q.sport) {
    updates.sport = q.sport;
  }

  if (!profile.primary_position?.trim() && q.primary_position) {
    updates.primary_position = q.primary_position;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);
    if (!error) {
      return { ...profile, ...updates } as DatabaseProfile;
    }
  }

  return profile;
}

/** After sign-in or email confirmation: persist signup questionnaire from JWT metadata into `profiles`. */
export async function syncQuestionnaireFromAuthToProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  const profile = await fetchUserProfileRow(supabase, user.id);
  if (!profile) return;
  await mergeProfileRowWithAuthQuestionnaire(supabase, user, profile);
}

export async function getSessionUser(request: Request) {
  const { supabase, headers } = createSupabase(request);

  // Hydrate session from cookies first (SSR client uses lazy init). PostgREST
  // sends `Authorization: Bearer <access_token>` from this session for RLS.
  const {
    data: { session: cookieSession },
  } = await supabase.auth.getSession();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, supabase, headers };
  }

  const expMs = cookieSession?.expires_at
    ? cookieSession.expires_at * 1000
    : null;
  if (expMs != null && expMs < Date.now() + 15_000) {
    const { error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      console.warn("[auth] refreshSession:", refreshErr.message);
    }
  }

  let profile = await fetchUserProfileRow(supabase, user.id);

  if (user && !profile) {
    await ensureProfileRowForUser(supabase, user);
    profile = await fetchUserProfileRow(supabase, user.id);
  }

  /**
   * If explicit column lists fail (e.g. app expects a column the DB doesn’t have yet),
   * PostgREST rejects the whole select. `select('*')` only returns columns that exist,
   * so this path can still load the row.
   */
  if (user && !profile) {
    const wide = (await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()) as ProfileRowQuery;
    if (wide.data && "id" in wide.data) {
      profile = padProfileToFullShape(wide.data);
    }
  }

  if (user && profile) {
    profile = await mergeProfileRowWithAuthQuestionnaire(
      supabase,
      user,
      profile,
    );
  }

  return {
    user,
    profile,
    supabase,
    headers,
  };
}

export async function requireUser(
  request: Request,
  redirectTo: string = "/login",
) {
  const ctx = await getSessionUser(request);
  if (!ctx.user) {
    throw redirect(redirectTo);
  }
  return ctx;
}

export async function requirePlayer(request: Request) {
  const ctx = await requireUser(request);
  if (ctx.profile?.role === "scout") {
    throw redirect("/scout");
  }
  return ctx;
}

export async function requireScout(request: Request) {
  const ctx = await requireUser(request);
  if (ctx.profile?.role !== "scout") {
    throw redirect("/dashboard");
  }
  return ctx;
}
