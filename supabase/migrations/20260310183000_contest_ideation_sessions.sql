do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'contest_ideation_status'
  ) then
    create type public.contest_ideation_status as enum ('draft', 'selected', 'archived');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'contest_ideation_stage'
  ) then
    create type public.contest_ideation_stage as enum ('strategy', 'why', 'how', 'what', 'matrix', 'selected');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'contest_ideation_candidate_stage'
  ) then
    create type public.contest_ideation_candidate_stage as enum ('why', 'how', 'what');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'contest_ideation_source'
  ) then
    create type public.contest_ideation_source as enum ('ai', 'user');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'contest_ideation_vote_state'
  ) then
    create type public.contest_ideation_vote_state as enum ('liked', 'skipped', 'neutral');
  end if;
end
$$;

create table if not exists public.contest_ideation_sessions (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.contest_ideation_status not null default 'draft',
  current_stage public.contest_ideation_stage not null default 'strategy',
  strategy_reviewed_at timestamptz,
  selected_why text,
  selected_how text,
  why_edited_text text,
  how_edited_text text,
  user_idea_seed text,
  selected_idea_id uuid,
  selected_matrix_preset text,
  matrix_weights_json jsonb not null default '{"impact":35,"feasibility":25,"alignment":25,"speed":15}'::jsonb,
  progress_json jsonb not null default '{"strategy":0,"ideation":0,"team":0}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contest_ideation_sessions_user_contest_key unique (user_id, contest_id)
);

create table if not exists public.contest_ideation_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.contest_ideation_sessions(id) on delete cascade,
  stage public.contest_ideation_candidate_stage not null,
  title text not null,
  body text not null,
  pros_json jsonb not null default '[]'::jsonb,
  cons_json jsonb not null default '[]'::jsonb,
  fit_reason text,
  extra_json jsonb not null default '{}'::jsonb,
  source public.contest_ideation_source not null default 'ai',
  vote_state public.contest_ideation_vote_state not null default 'neutral',
  is_selected boolean not null default false,
  matrix_scores_json jsonb,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists contest_ideation_sessions_user_idx
  on public.contest_ideation_sessions (user_id, updated_at desc);

create index if not exists contest_ideation_sessions_contest_idx
  on public.contest_ideation_sessions (contest_id, updated_at desc);

create index if not exists contest_ideation_candidates_session_stage_idx
  on public.contest_ideation_candidates (session_id, stage, display_order);

drop trigger if exists contest_ideation_sessions_set_updated_at on public.contest_ideation_sessions;
create trigger contest_ideation_sessions_set_updated_at
before update on public.contest_ideation_sessions
for each row
execute function public.set_updated_at();

drop trigger if exists contest_ideation_candidates_set_updated_at on public.contest_ideation_candidates;
create trigger contest_ideation_candidates_set_updated_at
before update on public.contest_ideation_candidates
for each row
execute function public.set_updated_at();

alter table public.contest_ideation_sessions enable row level security;
alter table public.contest_ideation_candidates enable row level security;

grant select, insert, update, delete on public.contest_ideation_sessions to authenticated;
grant select, insert, update, delete on public.contest_ideation_candidates to authenticated;

drop policy if exists "Users can read their own ideation sessions" on public.contest_ideation_sessions;
create policy "Users can read their own ideation sessions"
on public.contest_ideation_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own ideation sessions" on public.contest_ideation_sessions;
create policy "Users can insert their own ideation sessions"
on public.contest_ideation_sessions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own ideation sessions" on public.contest_ideation_sessions;
create policy "Users can update their own ideation sessions"
on public.contest_ideation_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own ideation sessions" on public.contest_ideation_sessions;
create policy "Users can delete their own ideation sessions"
on public.contest_ideation_sessions
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own ideation candidates" on public.contest_ideation_candidates;
create policy "Users can read their own ideation candidates"
on public.contest_ideation_candidates
for select
to authenticated
using (
  exists (
    select 1
    from public.contest_ideation_sessions
    where contest_ideation_sessions.id = contest_ideation_candidates.session_id
      and contest_ideation_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert their own ideation candidates" on public.contest_ideation_candidates;
create policy "Users can insert their own ideation candidates"
on public.contest_ideation_candidates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.contest_ideation_sessions
    where contest_ideation_sessions.id = contest_ideation_candidates.session_id
      and contest_ideation_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their own ideation candidates" on public.contest_ideation_candidates;
create policy "Users can update their own ideation candidates"
on public.contest_ideation_candidates
for update
to authenticated
using (
  exists (
    select 1
    from public.contest_ideation_sessions
    where contest_ideation_sessions.id = contest_ideation_candidates.session_id
      and contest_ideation_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.contest_ideation_sessions
    where contest_ideation_sessions.id = contest_ideation_candidates.session_id
      and contest_ideation_sessions.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their own ideation candidates" on public.contest_ideation_candidates;
create policy "Users can delete their own ideation candidates"
on public.contest_ideation_candidates
for delete
to authenticated
using (
  exists (
    select 1
    from public.contest_ideation_sessions
    where contest_ideation_sessions.id = contest_ideation_candidates.session_id
      and contest_ideation_sessions.user_id = auth.uid()
  )
);
