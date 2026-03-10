create table if not exists public.contest_strategy_reports (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null unique references public.contests(id) on delete cascade,
  overview text,
  recommended_direction text,
  ideas jsonb not null default '[]'::jsonb,
  research_points jsonb not null default '[]'::jsonb,
  draft_title text,
  draft_subtitle text,
  draft_sections jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  status public.contest_analysis_status not null default 'pending',
  prompt_version text not null default 'contest-strategy-lab-v2',
  model_name text,
  raw_response jsonb,
  generated_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contest_strategy_sources (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.contest_strategy_reports(id) on delete cascade,
  source_label text not null,
  source_type text not null,
  url text,
  title text,
  snippet text,
  content_text text,
  http_status integer,
  fetched_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (report_id, source_label)
);

create index if not exists contest_strategy_reports_status_idx
  on public.contest_strategy_reports (status, generated_at desc);

create index if not exists contest_strategy_sources_report_idx
  on public.contest_strategy_sources (report_id, source_label);

drop trigger if exists contest_strategy_reports_set_updated_at on public.contest_strategy_reports;

create trigger contest_strategy_reports_set_updated_at
before update on public.contest_strategy_reports
for each row
execute function public.set_updated_at();

alter table public.contest_strategy_reports enable row level security;
alter table public.contest_strategy_sources enable row level security;

create policy "Strategy reports for published contests are readable"
on public.contest_strategy_reports
for select
using (
  exists (
    select 1
    from public.contests
    where contests.id = contest_strategy_reports.contest_id
      and contests.status = 'published'
  )
);

create policy "Strategy sources for published contests are readable"
on public.contest_strategy_sources
for select
using (
  exists (
    select 1
    from public.contest_strategy_reports
    join public.contests on contests.id = contest_strategy_reports.contest_id
    where contest_strategy_reports.id = contest_strategy_sources.report_id
      and contests.status = 'published'
  )
);
