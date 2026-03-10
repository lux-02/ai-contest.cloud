alter table public.contests
add column if not exists prize_pool_krw numeric(14, 0);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contests'
      and column_name = 'prize_pool_usd'
  ) then
    execute $sql$
      update public.contests
      set prize_pool_krw = round(prize_pool_usd * 1450)
      where prize_pool_krw is null
        and prize_pool_usd is not null
    $sql$;
  end if;
end;
$$;

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

drop trigger if exists refresh_badges_after_contest_upsert on public.contests;

create trigger refresh_badges_after_contest_upsert
after insert or update of deadline, prize_pool_krw, eligibility_text, eligibility_segments, language, global_participation, tags, submission_format, difficulty
on public.contests
for each row
execute function public.refresh_contest_badges_trigger();
