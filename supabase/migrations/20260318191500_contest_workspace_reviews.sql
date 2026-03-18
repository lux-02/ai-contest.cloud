create table if not exists public.contest_workspace_reviews (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  ideation_session_id uuid not null references public.contest_ideation_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_label text not null,
  reviewer_role text,
  focus_area text not null check (focus_area in ('strategy', 'ideation', 'team', 'submission')),
  note text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists contest_workspace_reviews_session_idx
  on public.contest_workspace_reviews (ideation_session_id, created_at desc);

create index if not exists contest_workspace_reviews_user_idx
  on public.contest_workspace_reviews (user_id, updated_at desc);

drop trigger if exists contest_workspace_reviews_set_updated_at on public.contest_workspace_reviews;
create trigger contest_workspace_reviews_set_updated_at
before update on public.contest_workspace_reviews
for each row
execute function public.set_updated_at();

alter table public.contest_workspace_reviews enable row level security;

grant select, insert, update, delete on public.contest_workspace_reviews to authenticated;

drop policy if exists "Users can manage their own workspace reviews" on public.contest_workspace_reviews;
create policy "Users can manage their own workspace reviews"
on public.contest_workspace_reviews
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
