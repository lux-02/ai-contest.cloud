insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'contest-posters',
  'contest-posters',
  true,
  5242880,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Contest poster objects are readable"
on storage.objects
for select
to public
using (bucket_id = 'contest-posters');

create policy "Contest poster objects are insertable"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'contest-posters'
  and (storage.foldername(name))[1] = 'posters'
  and lower(storage.extension(name)) = any (array['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'])
);
