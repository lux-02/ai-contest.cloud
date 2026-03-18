create table if not exists public.contest_workspace_member_views (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  ideation_session_id uuid not null references public.contest_ideation_sessions(id) on delete cascade,
  viewer_user_id uuid not null references auth.users(id) on delete cascade,
  last_viewed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (ideation_session_id, viewer_user_id)
);

create index if not exists contest_workspace_member_views_viewer_idx
  on public.contest_workspace_member_views (viewer_user_id, last_viewed_at desc);

create index if not exists contest_workspace_member_views_session_idx
  on public.contest_workspace_member_views (ideation_session_id, last_viewed_at desc);

drop trigger if exists contest_workspace_member_views_set_updated_at on public.contest_workspace_member_views;
create trigger contest_workspace_member_views_set_updated_at
before update on public.contest_workspace_member_views
for each row
execute function public.set_updated_at();

alter table public.contest_workspace_member_views enable row level security;

grant select, insert, update on public.contest_workspace_member_views to authenticated;

drop policy if exists "Users can view their own workspace view state" on public.contest_workspace_member_views;
create policy "Users can view their own workspace view state"
on public.contest_workspace_member_views
for select
to authenticated
using (auth.uid() = viewer_user_id);

drop policy if exists "Users can insert their own workspace view state" on public.contest_workspace_member_views;
create policy "Users can insert their own workspace view state"
on public.contest_workspace_member_views
for insert
to authenticated
with check (auth.uid() = viewer_user_id);

drop policy if exists "Users can update their own workspace view state" on public.contest_workspace_member_views;
create policy "Users can update their own workspace view state"
on public.contest_workspace_member_views
for update
to authenticated
using (auth.uid() = viewer_user_id)
with check (auth.uid() = viewer_user_id);
