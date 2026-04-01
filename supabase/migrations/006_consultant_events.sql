  -- Realtime: consultant pushes → consumer app reacts (report / Google review prompt).
-- Run in SQL Editor after 001_lume_core.sql.

create table if not exists public.consultant_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  target_screen text not null default 'report',
  payload jsonb not null default '{}'::jsonb
);

create index if not exists consultant_events_created_idx on public.consultant_events (created_at desc);
create index if not exists consultant_events_target_idx on public.consultant_events (target_screen);

alter table public.consultant_events enable row level security;

drop policy if exists "consultant_events_select_all" on public.consultant_events;
create policy "consultant_events_select_all"
  on public.consultant_events for select
  using (true);

-- Enable Realtime (ignore error if already member)
do $$
begin
  alter publication supabase_realtime add table public.consultant_events;
exception
  when duplicate_object then null;
end $$;
