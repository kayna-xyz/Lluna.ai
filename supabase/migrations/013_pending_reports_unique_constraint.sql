-- Fix: pending_reports needs a unique index on (clinic_id, session_id)
-- so that upsert with onConflict: 'clinic_id,session_id' works correctly.
-- Migration 007 only created a regular index; this upgrades it to unique.

drop index if exists public.pending_reports_clinic_session_idx;

create unique index if not exists pending_reports_clinic_session_uidx
  on public.pending_reports (clinic_id, session_id);
