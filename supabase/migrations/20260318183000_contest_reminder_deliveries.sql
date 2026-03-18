create table if not exists public.contest_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  reminder_days_before integer not null check (reminder_days_before between 1 and 30),
  attempted_at timestamptz not null default timezone('utc', now()),
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists contest_reminder_deliveries_user_idx
  on public.contest_reminder_deliveries (user_id, attempted_at desc);

create index if not exists contest_reminder_deliveries_contest_idx
  on public.contest_reminder_deliveries (contest_id, attempted_at desc);

alter table public.contest_reminder_deliveries enable row level security;
