-- Align `pending_reports` with app code (`/api/new-report`, `/api/clients`, `/api/final-solution`).
-- Run after `001_lume_core.sql` in SQL Editor or via Supabase CLI.

-- Columns used by inserts/selects but missing from 001
alter table public.pending_reports
  add column if not exists client_name text,
  add column if not exists phone text,
  add column if not exists email text;

-- `final-solution` may write status into `status_text` if `status` update fails
alter table public.pending_reports
  add column if not exists status_text text;

-- `new-report` updates the latest still-open row for a session_id, else inserts (see route).
-- Drop unique(session_id) so after consultant final_plan_submitted a new submit can INSERT again.
alter table public.pending_reports drop constraint if exists pending_reports_session_id_key;

create index if not exists pending_reports_session_id_idx on public.pending_reports (session_id);
