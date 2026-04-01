-- Client app "Clinic menu" screen: tagline, rotating activities, testimonials.
-- Run after 007_multi_tenant.sql.

alter table public.clinic_settings
  add column if not exists tagline text,
  add column if not exists public_activities jsonb not null default '[]'::jsonb,
  add column if not exists public_testimonials jsonb not null default '[]'::jsonb;

comment on column public.clinic_settings.tagline is 'Subtitle under clinic name on consumer Clinic menu (e.g. pricing positioning).';
comment on column public.clinic_settings.public_activities is 'JSON array: {title, description, badge?, type?} for CURRENT ACTIVITIES carousel.';
comment on column public.clinic_settings.public_testimonials is 'JSON array: {name, role, testimonial} for TRUSTED BY section.';
