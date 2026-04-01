-- Logged-in end users (Google OAuth, etc.): one row per auth.users, for analytics and CRM.
-- Run after 009_clinic_staff_profiles.sql (or any migration that touches auth triggers).

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_email_idx on public.user_profiles (lower(email));

comment on table public.user_profiles is 'Consumer / app users linked to auth.users; updated on sign-in via API or trigger.';

alter table public.user_profiles enable row level security;

create policy "Users read own profile"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own profile"
  on public.user_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own profile"
  on public.user_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Initial row when a new auth user is created (complements POST /api/auth/sync-profile on each login).
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
      nullif(trim(coalesce(new.raw_user_meta_data->>'name', '')), '')
    ),
    nullif(trim(coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')), '')
  )
  on conflict (user_id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.user_profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile on auth.users;
create trigger on_auth_user_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();
