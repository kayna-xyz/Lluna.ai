-- Multi-tenant: clinics + clinic_id on business tables.
-- Run after 001, 002, 005, 006 (or at least after 001 + 002).

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists clinics_slug_idx on public.clinics (slug);

insert into public.clinics (slug, name)
values ('default', 'Default clinic')
on conflict (slug) do nothing;

alter table public.clinics enable row level security;

-- ── clinic_menu_store: singleton id → PK(clinic_id) ──
alter table public.clinic_menu_store
  add column if not exists clinic_id uuid references public.clinics (id);

update public.clinic_menu_store
set clinic_id = (select id from public.clinics where slug = 'default' limit 1)
where clinic_id is null;

alter table public.clinic_menu_store drop constraint if exists clinic_menu_store_singleton;
alter table public.clinic_menu_store drop constraint if exists clinic_menu_store_pkey;

alter table public.clinic_menu_store drop column if exists id;

alter table public.clinic_menu_store alter column clinic_id set not null;

alter table public.clinic_menu_store add primary key (clinic_id);

-- ── clinic_settings: same pattern ──
alter table public.clinic_settings
  add column if not exists clinic_id uuid references public.clinics (id);

update public.clinic_settings
set clinic_id = (select id from public.clinics where slug = 'default' limit 1)
where clinic_id is null;

alter table public.clinic_settings drop constraint if exists clinic_settings_singleton;
alter table public.clinic_settings drop constraint if exists clinic_settings_pkey;

alter table public.clinic_settings drop column if exists id;

alter table public.clinic_settings alter column clinic_id set not null;

alter table public.clinic_settings add primary key (clinic_id);

insert into public.clinic_settings (clinic_id, refer_bonus_usd)
select c.id, 20
from public.clinics c
where c.slug = 'default'
  and not exists (select 1 from public.clinic_settings s where s.clinic_id = c.id);

-- ── clients ──
alter table public.clients
  add column if not exists clinic_id uuid references public.clinics (id);

update public.clients
set clinic_id = (select id from public.clinics where slug = 'default' limit 1)
where clinic_id is null;

alter table public.clients alter column clinic_id set not null;

alter table public.clients drop constraint if exists clients_session_id_key;

create unique index if not exists clients_clinic_session_uidx on public.clients (clinic_id, session_id);

create index if not exists clients_clinic_updated_idx on public.clients (clinic_id, updated_at desc);

-- ── pending_reports ──
alter table public.pending_reports
  add column if not exists clinic_id uuid references public.clinics (id);

update public.pending_reports
set clinic_id = (select id from public.clinics where slug = 'default' limit 1)
where clinic_id is null;

alter table public.pending_reports alter column clinic_id set not null;

create index if not exists pending_reports_clinic_session_idx on public.pending_reports (clinic_id, session_id);
create index if not exists pending_reports_clinic_created_idx on public.pending_reports (clinic_id, created_at desc);

-- ── consultant_events ──
alter table public.consultant_events
  add column if not exists clinic_id uuid references public.clinics (id);

update public.consultant_events
set clinic_id = (select id from public.clinics where slug = 'default' limit 1)
where clinic_id is null;

alter table public.consultant_events alter column clinic_id set not null;

create index if not exists consultant_events_clinic_created_idx on public.consultant_events (clinic_id, created_at desc);
