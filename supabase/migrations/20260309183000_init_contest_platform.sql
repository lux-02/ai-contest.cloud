create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.contest_status as enum ('draft', 'published', 'archived');
create type public.contest_participation_mode as enum ('online', 'offline', 'hybrid');
create type public.contest_difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.contest_badge as enum (
  'deadline_urgent',
  'high_prize',
  'student_friendly',
  'global',
  'trending_ai',
  'developer_friendly',
  'beginner_friendly'
);
create type public.contest_analysis_status as enum ('pending', 'completed', 'failed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.contests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  organizer text not null,
  short_description text,
  description text not null,
  url text not null,
  source text not null default 'manual',
  source_url text,
  start_date date,
  deadline date,
  event_date date,
  participation_mode public.contest_participation_mode not null default 'online',
  location text,
  eligibility_text text,
  eligibility_segments text[] not null default '{}',
  difficulty public.contest_difficulty not null default 'intermediate',
  team_allowed boolean not null default true,
  min_team_size integer not null default 1,
  max_team_size integer not null default 4,
  language text not null default 'English',
  global_participation boolean not null default false,
  prize_pool_krw numeric(14, 0),
  prize_summary text,
  submission_format text,
  tools_allowed text[] not null default '{}',
  dataset_provided boolean not null default false,
  dataset_summary text,
  ai_categories text[] not null default '{}',
  tags text[] not null default '{}',
  judging_criteria text,
  status public.contest_status not null default 'draft',
  scraped_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contests_team_size_check check (min_team_size > 0 and max_team_size >= min_team_size)
);

create table public.contest_badges (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  badge public.contest_badge not null,
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (contest_id, badge)
);

create table public.contest_ai_analysis (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null unique references public.contests(id) on delete cascade,
  summary text,
  recommend_reason text,
  win_strategy text,
  difficulty_analysis text,
  judging_focus text,
  prompt_version text not null default 'contest-v1',
  model_name text,
  analysis_status public.contest_analysis_status not null default 'pending',
  raw_response jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index contests_status_deadline_idx on public.contests (status, deadline);
create index contests_title_trgm_idx on public.contests using gin (title gin_trgm_ops);
create index contests_ai_categories_idx on public.contests using gin (ai_categories);
create index contests_tags_idx on public.contests using gin (tags);
create index contests_eligibility_segments_idx on public.contests using gin (eligibility_segments);
create index contest_badges_badge_idx on public.contest_badges (badge);

create trigger contests_set_updated_at
before update on public.contests
for each row
execute function public.set_updated_at();

create trigger contest_ai_analysis_set_updated_at
before update on public.contest_ai_analysis
for each row
execute function public.set_updated_at();

create or replace function public.refresh_contest_badges(target_contest_id uuid)
returns void
language plpgsql
as $$
declare
  current_contest public.contests%rowtype;
  trend_tags text[] := array['llm', 'agent', 'generative ai', 'multimodal'];
begin
  select * into current_contest
  from public.contests
  where id = target_contest_id;

  if not found then
    return;
  end if;

  delete from public.contest_badges where contest_id = target_contest_id;

  if current_contest.deadline is not null
    and current_contest.deadline >= current_date
    and current_contest.deadline <= current_date + 7 then
    insert into public.contest_badges (contest_id, badge, reason)
    values (target_contest_id, 'deadline_urgent', 'Deadline is within 7 days');
  end if;

  if current_contest.prize_pool_krw is not null and current_contest.prize_pool_krw >= 15000000 then
    insert into public.contest_badges (contest_id, badge, reason)
    values (target_contest_id, 'high_prize', 'Prize pool is at least 15,000,000 KRW');
  end if;

  if coalesce(current_contest.eligibility_text, '') ilike '%student%'
    or exists (
      select 1
      from unnest(current_contest.eligibility_segments) as eligibility_segment
      where eligibility_segment ilike '%student%'
    ) then
    insert into public.contest_badges (contest_id, badge, reason)
    values (target_contest_id, 'student_friendly', 'Eligibility mentions students');
  end if;

  if current_contest.global_participation or lower(current_contest.language) = 'english' then
    insert into public.contest_badges (contest_id, badge, reason)
    values (target_contest_id, 'global', 'Contest can be joined globally');
  end if;

  if exists (
    select 1
    from unnest(current_contest.tags) as tag
    where lower(tag) = any (trend_tags)
  ) then
    insert into public.contest_badges (contest_id, badge, reason)
    values (target_contest_id, 'trending_ai', 'Contest is aligned with current AI trend tags');
  end if;

  if coalesce(current_contest.submission_format, '') ilike '%demo%'
    or exists (
      select 1
      from unnest(current_contest.tags) as tag
      where lower(tag) in ('devpost', 'kaggle', 'hackathon', 'agent', 'rag')
    ) then
    insert into public.contest_badges (contest_id, badge, reason)
    values (target_contest_id, 'developer_friendly', 'Submission is product or code oriented');
  end if;

  if current_contest.difficulty = 'beginner' then
    insert into public.contest_badges (contest_id, badge, reason)
    values (target_contest_id, 'beginner_friendly', 'Contest difficulty is beginner');
  end if;
end;
$$;

create or replace function public.refresh_contest_badges_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_contest_badges(new.id);
  return new;
end;
$$;

create trigger refresh_badges_after_contest_upsert
after insert or update of deadline, prize_pool_krw, eligibility_text, eligibility_segments, language, global_participation, tags, submission_format, difficulty
on public.contests
for each row
execute function public.refresh_contest_badges_trigger();

alter table public.contests enable row level security;
alter table public.contest_badges enable row level security;
alter table public.contest_ai_analysis enable row level security;

create policy "Published contests are readable"
on public.contests
for select
using (status = 'published');

create policy "Badges for published contests are readable"
on public.contest_badges
for select
using (
  exists (
    select 1
    from public.contests
    where contests.id = contest_badges.contest_id
      and contests.status = 'published'
  )
);

create policy "Analysis for published contests are readable"
on public.contest_ai_analysis
for select
using (
  exists (
    select 1
    from public.contests
    where contests.id = contest_ai_analysis.contest_id
      and contests.status = 'published'
  )
);
