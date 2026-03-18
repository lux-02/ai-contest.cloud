create table if not exists public.contest_workspace_share_links (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  ideation_session_id uuid not null references public.contest_ideation_sessions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  share_token text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists contest_workspace_share_links_active_session_idx
  on public.contest_workspace_share_links (ideation_session_id)
  where revoked_at is null;

create index if not exists contest_workspace_share_links_owner_idx
  on public.contest_workspace_share_links (owner_user_id, created_at desc);

drop trigger if exists contest_workspace_share_links_set_updated_at on public.contest_workspace_share_links;
create trigger contest_workspace_share_links_set_updated_at
before update on public.contest_workspace_share_links
for each row
execute function public.set_updated_at();

alter table public.contest_workspace_share_links enable row level security;

grant select, insert, update, delete on public.contest_workspace_share_links to authenticated;

drop policy if exists "Users can manage their own workspace share links" on public.contest_workspace_share_links;
create policy "Users can manage their own workspace share links"
on public.contest_workspace_share_links
for all
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);
