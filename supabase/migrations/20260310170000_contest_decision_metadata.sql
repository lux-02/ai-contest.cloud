alter table public.contests
add column if not exists organizer_type text,
add column if not exists submission_items text[] not null default '{}'::text[],
add column if not exists judging_criteria jsonb not null default '[]'::jsonb,
add column if not exists stage_schedule jsonb not null default '[]'::jsonb,
add column if not exists past_winners text,
add column if not exists view_count integer not null default 0,
add column if not exists apply_count integer not null default 0;

