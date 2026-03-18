create table if not exists public.contest_workspace_members (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  ideation_session_id uuid not null references public.contest_ideation_sessions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('member', 'reviewer')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (ideation_session_id, member_user_id)
);

create index if not exists contest_workspace_members_owner_idx
  on public.contest_workspace_members (owner_user_id, created_at desc);

create index if not exists contest_workspace_members_member_idx
  on public.contest_workspace_members (member_user_id, created_at desc);

drop trigger if exists contest_workspace_members_set_updated_at on public.contest_workspace_members;
create trigger contest_workspace_members_set_updated_at
before update on public.contest_workspace_members
for each row
execute function public.set_updated_at();

alter table public.contest_workspace_members enable row level security;

grant select on public.contest_workspace_members to authenticated;

drop policy if exists "Users can view workspace memberships they belong to" on public.contest_workspace_members;
create policy "Users can view workspace memberships they belong to"
on public.contest_workspace_members
for select
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = member_user_id);

create table if not exists public.contest_workspace_invites (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  ideation_session_id uuid not null references public.contest_ideation_sessions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  role text not null check (role in ('member', 'reviewer')),
  invite_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists contest_workspace_invites_pending_email_idx
  on public.contest_workspace_invites (ideation_session_id, invitee_email)
  where status = 'pending';

create index if not exists contest_workspace_invites_owner_idx
  on public.contest_workspace_invites (owner_user_id, created_at desc);

create index if not exists contest_workspace_invites_token_idx
  on public.contest_workspace_invites (invite_token);

drop trigger if exists contest_workspace_invites_set_updated_at on public.contest_workspace_invites;
create trigger contest_workspace_invites_set_updated_at
before update on public.contest_workspace_invites
for each row
execute function public.set_updated_at();

alter table public.contest_workspace_invites enable row level security;

grant select on public.contest_workspace_invites to authenticated;

drop policy if exists "Users can view workspace invites they own or accepted" on public.contest_workspace_invites;
create policy "Users can view workspace invites they own or accepted"
on public.contest_workspace_invites
for select
to authenticated
using (auth.uid() = owner_user_id or auth.uid() = accepted_by_user_id);
