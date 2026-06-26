import type { DatabaseProfile } from "~/lib/types";

/** Title-case each whitespace-delimited word for normal English display. */
export function formatProperName(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      w.length === 1
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

function metaFullName(authMetaFullName: unknown): string {
  return typeof authMetaFullName === "string" ? authMetaFullName.trim() : "";
}

/**
 * Prefer `profiles.full_name`, then auth user_metadata from signup, never username/email.
 */
export function resolvePlayerDisplayName(
  profile: DatabaseProfile | null,
  authMetaFullName: unknown,
): string {
  const fromRow = profile?.full_name?.trim();
  if (fromRow) return formatProperName(fromRow);
  const fromMeta = metaFullName(authMetaFullName);
  if (fromMeta) return formatProperName(fromMeta);
  return "Your profile";
}

export function initialsForPlayerDisplay(displayName: string): string {
  if (!displayName || displayName === "Your profile") return "PL";
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

const SPORT_DISPLAY: Record<string, string> = {
  soccer: "Soccer",
  futsal: "Futsal",
  beach: "Beach soccer",
  indoor: "Indoor soccer",
  other: "Other",
};

/** Human-readable "Forward · Soccer" from signup / profile slugs; null if nothing set. */
export function formatPositionSportLine(
  primaryPosition: string | null | undefined,
  sport: string | null | undefined,
): string | null {
  const pos = primaryPosition?.trim();
  const sp = sport?.trim();
  if (!pos && !sp) return null;
  const parts: string[] = [];
  if (pos) {
    parts.push(formatProperName(pos.replace(/_/g, " ")));
  }
  if (sp) {
    parts.push(SPORT_DISPLAY[sp] ?? formatProperName(sp.replace(/_/g, " ")));
  }
  return parts.join(" · ");
}
