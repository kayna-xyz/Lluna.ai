-- Clinic dashboard "Info" + branding: persist on clinic_settings (URLs), not only consultant_events.
-- Public bucket for logo / MD team photos (service role uploads from Next API).

alter table public.clinic_settings
  add column if not exists info_clinic_name text,
  add column if not exists info_phone text,
  add column if not exists info_email text,
  add column if not exists info_work_time text,
  add column if not exists info_google_review_link text,
  add column if not exists logo_url text,
  add column if not exists public_md_team jsonb not null default '[]'::jsonb,
  add column if not exists clinic_info_revision int not null default 0;

comment on column public.clinic_settings.clinic_info_revision is 'Incremented when clinic saves Info tab; when >0, GET /api/clinic-info reads only clinic_settings (no consultant_events fallback).';
comment on column public.clinic_settings.info_clinic_name is 'Display name for consumer app / materials.';
comment on column public.clinic_settings.logo_url is 'Public Storage URL for clinic logo.';
comment on column public.clinic_settings.public_md_team is 'JSON array: {id, name, about, experience, photo_url} for MD / team section.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinic-branding',
  'clinic-branding',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "clinic_branding_public_read" on storage.objects;
create policy "clinic_branding_public_read"
  on storage.objects for select
  using (bucket_id = 'clinic-branding');
