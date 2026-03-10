do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'contest_tracking_status'
  ) then
    create type public.contest_tracking_status as enum ('saved', 'planning', 'applied');
  end if;
end
$$;

create table if not exists public.contest_user_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contest_id uuid not null references public.contests(id) on delete cascade,
  status public.contest_tracking_status,
  reminder_enabled boolean not null default false,
  reminder_days_before integer not null default 3,
  last_reminder_sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contest_user_tracking_user_contest_key unique (user_id, contest_id),
  constraint contest_user_tracking_reminder_days_check check (reminder_days_before between 1 and 30)
);

create index if not exists contest_user_tracking_user_idx
  on public.contest_user_tracking (user_id, updated_at desc);

create index if not exists contest_user_tracking_contest_idx
  on public.contest_user_tracking (contest_id);

drop trigger if exists contest_user_tracking_set_updated_at on public.contest_user_tracking;

create trigger contest_user_tracking_set_updated_at
before update on public.contest_user_tracking
for each row
execute function public.set_updated_at();

alter table public.contest_user_tracking enable row level security;

grant select, insert, update, delete on public.contest_user_tracking to authenticated;

drop policy if exists "Users can read their own contest tracking" on public.contest_user_tracking;
create policy "Users can read their own contest tracking"
on public.contest_user_tracking
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own contest tracking" on public.contest_user_tracking;
create policy "Users can insert their own contest tracking"
on public.contest_user_tracking
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own contest tracking" on public.contest_user_tracking;
create policy "Users can update their own contest tracking"
on public.contest_user_tracking
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own contest tracking" on public.contest_user_tracking;
create policy "Users can delete their own contest tracking"
on public.contest_user_tracking
for delete
to authenticated
using (auth.uid() = user_id);
