-- Player profile: school and location for dashboard / discovery

alter table public.profiles
  add column if not exists school_name text,
  add column if not exists city text,
  add column if not exists state text;

comment on column public.profiles.school_name is 'School or club team label shown on player profile';
comment on column public.profiles.city is 'City for location line (e.g. Salt Lake City)';
comment on column public.profiles.state is 'Region / state code (e.g. UT)';
