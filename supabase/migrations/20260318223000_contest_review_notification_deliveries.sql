create table if not exists public.contest_review_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.contest_workspace_reviews(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  provider text not null,
  provider_message_id text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists contest_review_notification_deliveries_review_idx
  on public.contest_review_notification_deliveries (review_id, created_at desc);

create index if not exists contest_review_notification_deliveries_owner_idx
  on public.contest_review_notification_deliveries (owner_user_id, created_at desc);

alter table public.contest_review_notification_deliveries enable row level security;

grant select on public.contest_review_notification_deliveries to authenticated;

drop policy if exists "Users can view their own review notification deliveries" on public.contest_review_notification_deliveries;
create policy "Users can view their own review notification deliveries"
on public.contest_review_notification_deliveries
for select
to authenticated
using (auth.uid() = owner_user_id);
