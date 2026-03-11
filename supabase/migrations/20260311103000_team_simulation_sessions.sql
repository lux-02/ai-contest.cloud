do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'team_session_status'
  ) then
    create type public.team_session_status as enum ('draft', 'active', 'completed', 'archived');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'team_member_status'
  ) then
    create type public.team_member_status as enum ('online', 'working', 'resting');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'team_message_author_type'
  ) then
    create type public.team_message_author_type as enum ('user', 'ai', 'system');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'team_message_kind'
  ) then
    create type public.team_message_kind as enum ('chat', 'summary', 'task_update', 'artifact_update');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'team_task_status'
  ) then
    create type public.team_task_status as enum ('todo', 'in_progress', 'done');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'team_task_priority'
  ) then
    create type public.team_task_priority as enum ('low', 'medium', 'high');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'team_artifact_type'
  ) then
    create type public.team_artifact_type as enum ('brief', 'pitch', 'checklist', 'prototype-note', 'judging-note');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'team_artifact_status'
  ) then
    create type public.team_artifact_status as enum ('draft', 'ready');
  end if;
end
$$;

create table if not exists public.team_sessions (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  ideation_session_id uuid not null references public.contest_ideation_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.team_session_status not null default 'draft',
  team_name text not null,
  team_intro text not null,
  readiness_score integer not null default 25,
  current_focus text,
  kickoff_choice text,
  kickoff_options_json jsonb not null default '[]'::jsonb,
  claimed_role_ids_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_sessions_ideation_unique unique (ideation_session_id),
  constraint team_sessions_readiness_score_check check (readiness_score >= 0 and readiness_score <= 100)
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_session_id uuid not null references public.team_sessions(id) on delete cascade,
  member_key text not null,
  name text not null,
  role text not null,
  english_role text,
  personality text not null,
  main_contribution text not null,
  skills_json jsonb not null default '[]'::jsonb,
  intro_line text not null,
  status public.team_member_status not null default 'online',
  avatar_seed text not null,
  is_user_claimed boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.team_messages (
  id uuid primary key default gen_random_uuid(),
  team_session_id uuid not null references public.team_sessions(id) on delete cascade,
  author_type public.team_message_author_type not null,
  member_id uuid references public.team_members(id) on delete set null,
  body text not null,
  message_kind public.team_message_kind not null default 'chat',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  team_session_id uuid not null references public.team_sessions(id) on delete cascade,
  title text not null,
  description text not null default '',
  status public.team_task_status not null default 'todo',
  priority public.team_task_priority not null default 'medium',
  assignee_member_id uuid references public.team_members(id) on delete set null,
  origin text not null default 'chat',
  readiness_delta integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.team_artifacts (
  id uuid primary key default gen_random_uuid(),
  team_session_id uuid not null references public.team_sessions(id) on delete cascade,
  artifact_type public.team_artifact_type not null,
  title text not null,
  summary text not null default '',
  body text not null default '',
  status public.team_artifact_status not null default 'draft',
  source_task_id uuid references public.team_tasks(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.team_score_events (
  id uuid primary key default gen_random_uuid(),
  team_session_id uuid not null references public.team_sessions(id) on delete cascade,
  label text not null,
  delta integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists team_sessions_user_idx
  on public.team_sessions (user_id, updated_at desc);

create index if not exists team_members_session_active_idx
  on public.team_members (team_session_id, is_active, sort_order);

create index if not exists team_messages_session_idx
  on public.team_messages (team_session_id, created_at asc);

create index if not exists team_tasks_session_idx
  on public.team_tasks (team_session_id, status, priority);

create index if not exists team_artifacts_session_idx
  on public.team_artifacts (team_session_id, status, created_at desc);

create index if not exists team_score_events_session_idx
  on public.team_score_events (team_session_id, created_at desc);

drop trigger if exists team_sessions_set_updated_at on public.team_sessions;
create trigger team_sessions_set_updated_at
before update on public.team_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
before update on public.team_members
for each row
execute function public.set_updated_at();

drop trigger if exists team_tasks_set_updated_at on public.team_tasks;
create trigger team_tasks_set_updated_at
before update on public.team_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists team_artifacts_set_updated_at on public.team_artifacts;
create trigger team_artifacts_set_updated_at
before update on public.team_artifacts
for each row
execute function public.set_updated_at();

alter table public.team_sessions enable row level security;
alter table public.team_members enable row level security;
alter table public.team_messages enable row level security;
alter table public.team_tasks enable row level security;
alter table public.team_artifacts enable row level security;
alter table public.team_score_events enable row level security;

grant select, insert, update, delete on public.team_sessions to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.team_messages to authenticated;
grant select, insert, update, delete on public.team_tasks to authenticated;
grant select, insert, update, delete on public.team_artifacts to authenticated;
grant select, insert, update, delete on public.team_score_events to authenticated;

drop policy if exists "Users can manage their own team sessions" on public.team_sessions;
create policy "Users can manage their own team sessions"
on public.team_sessions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own team members" on public.team_members;
create policy "Users can manage their own team members"
on public.team_members
for all
to authenticated
using (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_members.team_session_id
      and team_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_members.team_session_id
      and team_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage their own team messages" on public.team_messages;
create policy "Users can manage their own team messages"
on public.team_messages
for all
to authenticated
using (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_messages.team_session_id
      and team_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_messages.team_session_id
      and team_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage their own team tasks" on public.team_tasks;
create policy "Users can manage their own team tasks"
on public.team_tasks
for all
to authenticated
using (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_tasks.team_session_id
      and team_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_tasks.team_session_id
      and team_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage their own team artifacts" on public.team_artifacts;
create policy "Users can manage their own team artifacts"
on public.team_artifacts
for all
to authenticated
using (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_artifacts.team_session_id
      and team_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_artifacts.team_session_id
      and team_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage their own team score events" on public.team_score_events;
create policy "Users can manage their own team score events"
on public.team_score_events
for all
to authenticated
using (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_score_events.team_session_id
      and team_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.team_sessions
    where team_sessions.id = team_score_events.team_session_id
      and team_sessions.user_id = auth.uid()
  )
);
