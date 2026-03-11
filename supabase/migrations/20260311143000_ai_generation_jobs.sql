do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'ai_generation_job_type'
  ) then
    create type public.ai_generation_job_type as enum ('strategy_lab');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'ai_generation_job_status'
  ) then
    create type public.ai_generation_job_status as enum ('queued', 'running', 'completed', 'failed');
  end if;
end
$$;

create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  job_type public.ai_generation_job_type not null,
  status public.ai_generation_job_status not null default 'queued',
  input_hash text not null,
  input_json jsonb not null default '{}'::jsonb,
  result_json jsonb,
  error_message text,
  progress_label text,
  request_id text,
  attempt_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_generation_jobs_lookup_idx
  on public.ai_generation_jobs (contest_id, job_type, input_hash, created_at desc);

create index if not exists ai_generation_jobs_status_idx
  on public.ai_generation_jobs (job_type, status, created_at asc);

drop trigger if exists ai_generation_jobs_set_updated_at on public.ai_generation_jobs;
create trigger ai_generation_jobs_set_updated_at
before update on public.ai_generation_jobs
for each row
execute function public.set_updated_at();
