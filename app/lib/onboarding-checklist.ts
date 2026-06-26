import type { DatabaseProfile } from "~/lib/types";

export type ChecklistItemId =
  | "photo"
  | "pos"
  | "reel1"
  | "school"
  | "location"
  | "stats";

export type ChecklistItem = {
  id: ChecklistItemId;
  label: string;
  done: boolean;
};

function labelForThreeReelsGoal(reelCount: number): string {
  if (reelCount >= 3) return "Upload 3 reels";
  if (reelCount === 2) return "Add 1 more reel";
  if (reelCount === 1) return "Add 2 more reels";
  return "Upload 3 reels";
}

export function buildOnboardingChecklist(
  profile: DatabaseProfile | null,
  reelCount: number,
): ChecklistItem[] {
  const hasPhoto = Boolean(profile?.avatar_url?.trim());
  const positionSport = Boolean(
    profile?.primary_position?.trim() && profile?.sport?.trim(),
  );
  const schoolDone = Boolean(
    profile?.school_name?.trim() &&
      profile?.graduation_year != null &&
      profile.graduation_year >= 1990 &&
      profile.graduation_year <= 2040,
  );
  const locationSet = Boolean(
    profile?.city?.trim() || profile?.state?.trim(),
  );
  const statsDone = Boolean(profile?.physical_stats?.trim());
  const reelsGoalDone = reelCount >= 3;

  return [
    { id: "photo", label: "Add a profile photo", done: hasPhoto },
    { id: "pos", label: "Set position & sport", done: positionSport },
    {
      id: "reel1",
      label: labelForThreeReelsGoal(reelCount),
      done: reelsGoalDone,
    },
    { id: "school", label: "Add school & graduation year", done: schoolDone },
    { id: "location", label: "Add city & state", done: locationSet },
    { id: "stats", label: "Add stats & measurables", done: statsDone },
  ];
}
