import type { User } from "@supabase/supabase-js";
import type { DatabaseProfile } from "~/lib/types";
import { ageFromDateOfBirth } from "./age";

/** Normalize signup / metadata date strings to YYYY-MM-DD for Postgres `date`. */
export function normalizeDateOfBirthInput(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
    }
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const dt = new Date(t);
    const y = dt.getUTCFullYear();
    const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const da = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }

  return null;
}

function stringFromMeta(record: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = record[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Reads questionnaire fields from Supabase `user_metadata` (signup `options.data`).
 */
export function questionnaireFromMetadata(
  meta: User["user_metadata"] | null | undefined,
): {
  full_name: string;
  date_of_birth: string;
  sport: string;
  primary_position: string;
} {
  if (!meta || typeof meta !== "object") {
    return {
      full_name: "",
      date_of_birth: "",
      sport: "",
      primary_position: "",
    };
  }
  const r = meta as Record<string, unknown>;
  return {
    full_name: stringFromMeta(r, ["full_name", "fullName", "name"]),
    date_of_birth: stringFromMeta(r, [
      "date_of_birth",
      "dateOfBirth",
      "birthdate",
      "birthday",
      "dob",
    ]),
    sport: stringFromMeta(r, ["sport"]),
    primary_position: stringFromMeta(r, [
      "primary_position",
      "primaryPosition",
    ]),
  };
}

export function questionnaireFromUserMetadata(
  user: User | null | undefined,
) {
  return questionnaireFromMetadata(user?.user_metadata);
}

/**
 * Prefer `profiles.date_of_birth`, then JWT `user_metadata` (signup), so age can show even if the profile row never synced.
 */
export function resolveDateOfBirthForAge(
  profile: DatabaseProfile | null,
  userMetadata: User["user_metadata"] | null | undefined,
): string | null {
  const rowRaw =
    profile?.date_of_birth != null ? String(profile.date_of_birth).trim() : "";
  const rowNorm = rowRaw ? normalizeDateOfBirthInput(rowRaw) : null;
  if (rowNorm && ageFromDateOfBirth(rowNorm) != null) {
    return rowNorm;
  }

  const q = questionnaireFromMetadata(userMetadata);
  const metaNorm = q.date_of_birth
    ? normalizeDateOfBirthInput(q.date_of_birth)
    : null;
  if (metaNorm && ageFromDateOfBirth(metaNorm) != null) {
    return metaNorm;
  }

  return null;
}
