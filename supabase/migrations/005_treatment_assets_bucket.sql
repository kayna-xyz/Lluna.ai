-- Public read bucket for treatment images. Next.js API uses service_role and bypasses RLS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'treatment-assets',
  'treatment-assets',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "treatment_assets_public_read" on storage.objects;
create policy "treatment_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'treatment-assets');
