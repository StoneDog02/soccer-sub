-- Signup questionnaire + public username (unique, case-insensitive)

alter table public.profiles
  add column if not exists username text,
  add column if not exists sport text,
  add column if not exists primary_position text,
  add column if not exists goals text;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null and length(trim(username)) > 0;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob date;
  v_username text;
begin
  v_username := nullif(lower(trim(new.raw_user_meta_data->>'username')), '');

  if new.raw_user_meta_data->>'date_of_birth' is not null
     and trim(new.raw_user_meta_data->>'date_of_birth') <> '' then
    v_dob := (trim(new.raw_user_meta_data->>'date_of_birth'))::date;
  else
    v_dob := null;
  end if;

  insert into public.profiles (
    id,
    full_name,
    date_of_birth,
    username,
    sport,
    primary_position,
    goals
  )
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    v_dob,
    v_username,
    nullif(trim(coalesce(new.raw_user_meta_data->>'sport', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'primary_position', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'goals', '')), '')
  );

  return new;
end;
$$;
