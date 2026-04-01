-- User footprint: clinics visited (QR/direct) + link clients rows to auth user for "My" page.
-- Run after 010_user_profiles.sql.

alter table public.clients
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create index if not exists clients_auth_user_id_idx on public.clients (auth_user_id)
  where auth_user_id is not null;

comment on column public.clients.auth_user_id is 'Set when the consumer is logged in; used to list sessions/treatments on My page.';

create table if not exists public.user_clinic_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  visit_count int not null default 1,
  entry_via_qr boolean not null default false,
  unique (user_id, clinic_id)
);

create index if not exists user_clinic_visits_user_idx on public.user_clinic_visits (user_id, last_visited_at desc);

comment on table public.user_clinic_visits is 'Logged-in consumer visits per clinic; updated from POST /api/me/visit.';

alter table public.user_clinic_visits enable row level security;

create policy "Users read own clinic visits"
  on public.user_clinic_visits for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users read own client rows for activity"
  on public.clients for select
  to authenticated
  using (auth.uid() = auth_user_id);
