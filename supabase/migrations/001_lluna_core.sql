-- Lluna: clients, pending reports, menu store, settings
-- Run in Supabase SQL Editor if you do not use CLI migrations.

create extension if not exists "pgcrypto";

create table if not exists public.pending_reports (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  report_data jsonb not null default '{}'::jsonb,
  report_summary text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pending_reports_created_idx on public.pending_reports (created_at desc);
create index if not exists pending_reports_status_idx on public.pending_reports (status);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  name text,
  phone text,
  email text,
  report_data jsonb not null default '{}'::jsonb,
  report_summary text,
  total_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_updated_idx on public.clients (updated_at desc);

create table if not exists public.clinic_menu_store (
  id int primary key default 1,
  menu_json jsonb not null,
  updated_at timestamptz not null default now(),
  constraint clinic_menu_store_singleton check (id = 1)
);

create table if not exists public.clinic_settings (
  id int primary key default 1,
  refer_bonus_usd numeric not null default 20,
  updated_at timestamptz not null default now(),
  constraint clinic_settings_singleton check (id = 1)
);

insert into public.clinic_settings (id, refer_bonus_usd)
values (1, 20)
on conflict (id) do nothing;

alter table public.pending_reports enable row level security;
alter table public.clients enable row level security;
alter table public.clinic_menu_store enable row level security;
alter table public.clinic_settings enable row level security;

-- Service role bypasses RLS; anon/authenticated need no access if you only use Next API + service key.
