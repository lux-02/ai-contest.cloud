create table if not exists public.contest_workspace_invite_deliveries (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.contest_workspace_invites(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists contest_workspace_invite_deliveries_invite_idx
  on public.contest_workspace_invite_deliveries (invite_id, created_at desc);

create index if not exists contest_workspace_invite_deliveries_owner_idx
  on public.contest_workspace_invite_deliveries (owner_user_id, created_at desc);

alter table public.contest_workspace_invite_deliveries enable row level security;

grant select on public.contest_workspace_invite_deliveries to authenticated;

drop policy if exists "Users can view their own workspace invite deliveries" on public.contest_workspace_invite_deliveries;
create policy "Users can view their own workspace invite deliveries"
on public.contest_workspace_invite_deliveries
for select
to authenticated
using (auth.uid() = owner_user_id);
