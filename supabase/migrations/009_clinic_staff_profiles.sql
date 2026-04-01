-- Clinic staff: email signup metadata (phone, address) stored in clinic_staff_profiles.
-- Trigger runs on auth.users insert when user_metadata.registration_type = 'clinic_staff'.
-- Run after 007_multi_tenant.sql (needs public.clinics for optional clinic_id FK).

create table if not exists public.clinic_staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  phone text,
  address text,
  clinic_id uuid references public.clinics (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_staff_profiles_clinic_id_idx on public.clinic_staff_profiles (clinic_id);

comment on table public.clinic_staff_profiles is 'Advisor/clinic staff profile; email signup via registration_type=clinic_staff in user metadata.';

alter table public.clinic_staff_profiles enable row level security;

create policy "Staff read own profile"
  on public.clinic_staff_profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Staff update own profile"
  on public.clinic_staff_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Inserts from application trigger (security definer); no direct client insert policy needed.

create or replace function public.handle_clinic_staff_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'registration_type', '') = 'clinic_staff' then
    insert into public.clinic_staff_profiles (user_id, email, phone, address)
    values (
      new.id,
      new.email,
      nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), ''),
      nullif(trim(coalesce(new.raw_user_meta_data->>'address', '')), '')
    );
  end if;
  return new;
end;
$$;

-- Requires sufficient privileges (Supabase SQL Editor / migration runner).
drop trigger if exists on_clinic_staff_user_created on auth.users;
create trigger on_clinic_staff_user_created
  after insert on auth.users
  for each row execute procedure public.handle_clinic_staff_signup();
