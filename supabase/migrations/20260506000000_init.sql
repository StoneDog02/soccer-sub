-- Soccer Sub: profiles, highlights, scout evaluations, storage policies
-- Run via Supabase CLI or SQL editor after creating project.

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'player' check (role in ('player', 'scout')),
  full_name text,
  date_of_birth date,
  stripe_customer_id text,
  subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'past_due', 'canceled')),
  upload_credits int not null default 0 check (upload_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  title text,
  duration_seconds numeric not null check (duration_seconds > 0 and duration_seconds <= 60),
  player_name text,
  age_at_upload int,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  uploaded_at timestamptz not null default now()
);

create unique index highlights_storage_path_key on public.highlights (storage_path);

create table public.scout_evaluations (
  id uuid primary key default gen_random_uuid(),
  highlight_id uuid not null references public.highlights (id) on delete cascade,
  scout_id uuid not null references public.profiles (id) on delete cascade,
  overall_score int check (overall_score is null or (overall_score >= 1 and overall_score <= 10)),
  technical_score int check (technical_score is null or (technical_score >= 1 and technical_score <= 10)),
  physical_score int check (physical_score is null or (physical_score >= 1 and physical_score <= 10)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (highlight_id, scout_id)
);

create index highlights_user_id_idx on public.highlights (user_id);
create index scout_evaluations_highlight_idx on public.scout_evaluations (highlight_id);
create index scout_evaluations_scout_idx on public.scout_evaluations (scout_id);

alter table public.profiles enable row level security;
alter table public.highlights enable row level security;
alter table public.scout_evaluations enable row level security;

-- Profiles: users manage own row
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Scouts can read player profiles for highlights context (name / age)
create policy "profiles_select_scout_players" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles s
      where s.id = auth.uid() and s.role = 'scout'
    )
    and role = 'player'
  );

-- Highlights: owners full access
create policy "highlights_select_own" on public.highlights
  for select using (auth.uid() = user_id);

create policy "highlights_insert_own" on public.highlights
  for insert with check (auth.uid() = user_id);

create policy "highlights_delete_own" on public.highlights
  for delete using (auth.uid() = user_id);

-- Scouts read all highlights
create policy "highlights_select_scout" on public.highlights
  for select using (
    exists (
      select 1 from public.profiles s
      where s.id = auth.uid() and s.role = 'scout'
    )
  );

-- Evaluations (scouts can read all evaluations; players see those on their clips)
create policy "eval_select_scout" on public.scout_evaluations
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'scout')
  );

create policy "eval_select_player_on_own_highlight" on public.scout_evaluations
  for select using (
    exists (
      select 1 from public.highlights h
      where h.id = highlight_id and h.user_id = auth.uid()
    )
  );

create policy "eval_insert_scout" on public.scout_evaluations
  for insert with check (
    auth.uid() = scout_id
    and exists (select 1 from public.profiles p where p.id = scout_id and p.role = 'scout')
  );

create policy "eval_update_scout_own" on public.scout_evaluations
  for update using (auth.uid() = scout_id);

create policy "eval_delete_scout_own" on public.scout_evaluations
  for delete using (auth.uid() = scout_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage: bucket (create in dashboard or SQL)
insert into storage.buckets (id, name, public)
values ('highlights', 'highlights', false)
on conflict (id) do nothing;

-- Path must be {user_id}/...
create policy "highlights_storage_read_own_or_scout"
on storage.objects for select
using (
  bucket_id = 'highlights'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'scout')
  )
);

create policy "highlights_storage_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'highlights'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "highlights_storage_update_own"
on storage.objects for update
using (
  bucket_id = 'highlights'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "highlights_storage_delete_own"
on storage.objects for delete
using (
  bucket_id = 'highlights'
  and (storage.foldername(name))[1] = auth.uid()::text
);
