create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_users enable row level security;

grant select on public.admin_users to authenticated;

drop policy if exists "Admin users can read themselves" on public.admin_users;
create policy "Admin users can read themselves"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Contest poster objects are insertable" on storage.objects;
drop policy if exists "Contest poster objects are insertable by admins" on storage.objects;

create policy "Contest poster objects are insertable by admins"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'contest-posters'
  and (storage.foldername(name))[1] = 'posters'
  and lower(storage.extension(name)) = any (array['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'])
  and exists (
    select 1
    from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);
