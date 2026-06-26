-- Profile settings: photo URL, graduation year, stats text for onboarding checklist

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists graduation_year int,
  add column if not exists physical_stats text;

comment on column public.profiles.avatar_url is 'Public profile image URL (e.g. Supabase Storage or CDN)';
comment on column public.profiles.graduation_year is 'High school graduation year';
comment on column public.profiles.physical_stats is 'Free-text height, weight, pace, etc.';
