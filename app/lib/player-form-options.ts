/** Shared sport / position options for signup and profile settings. */

export const PLAYER_SPORTS = [
  { value: "soccer", label: "Soccer (outdoor)" },
  { value: "futsal", label: "Futsal" },
  { value: "beach", label: "Beach soccer" },
  { value: "indoor", label: "Indoor soccer" },
  { value: "other", label: "Other" },
] as const;

export const PLAYER_POSITIONS = [
  { value: "", label: "Prefer not to say" },
  { value: "goalkeeper", label: "Goalkeeper" },
  { value: "defender", label: "Defender" },
  { value: "midfielder", label: "Midfielder" },
  { value: "forward", label: "Forward" },
  { value: "versatile", label: "Versatile / multiple" },
] as const;
