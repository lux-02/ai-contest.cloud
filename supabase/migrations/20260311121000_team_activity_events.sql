create table if not exists public.team_activity_events (
  id uuid primary key default uuid_generate_v4(),
  sequence bigserial not null,
  team_session_id uuid not null references public.team_sessions(id) on delete cascade,
  actor_member_id uuid references public.team_members(id) on delete set null,
  actor_label text,
  actor_role text,
  title text not null,
  detail text,
  state text not null check (state in ('running', 'completed', 'failed')),
  source text not null check (source in ('system', 'ai', 'user')),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists team_activity_events_sequence_key on public.team_activity_events(sequence);
create index if not exists team_activity_events_team_session_idx on public.team_activity_events(team_session_id, sequence desc);

alter table public.team_activity_events enable row level security;

create policy "team activity events are viewable by owner"
on public.team_activity_events
for select
using (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_activity_events.team_session_id
      and auth.uid() = team_sessions.user_id
  )
);

grant select on public.team_activity_events to authenticated;
