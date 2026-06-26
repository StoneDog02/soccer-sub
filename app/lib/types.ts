export type ProfileRole = "player" | "scout";

export type DatabaseProfile = {
  id: string;
  role: ProfileRole;
  username: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  sport: string | null;
  primary_position: string | null;
  goals: string | null;
  school_name: string | null;
  graduation_year: number | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  physical_stats: string | null;
  stripe_customer_id: string | null;
  subscription_status: "none" | "active" | "past_due" | "canceled";
  upload_credits: number;
};

export type HighlightRow = {
  id: string;
  user_id: string;
  storage_path: string;
  title: string | null;
  duration_seconds: number;
  player_name: string | null;
  age_at_upload: number | null;
  mime_type: string | null;
  byte_size: number | null;
  uploaded_at: string;
};

export type ScoutEvaluationRow = {
  id: string;
  highlight_id: string;
  scout_id: string;
  overall_score: number | null;
  technical_score: number | null;
  physical_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
