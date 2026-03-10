alter table public.contest_strategy_sources
add column if not exists search_query text,
add column if not exists ranking_score numeric(6, 4),
add column if not exists citation_score numeric(6, 4),
add column if not exists selected_for_citation boolean not null default false;

create index if not exists contest_strategy_sources_citation_idx
  on public.contest_strategy_sources (report_id, selected_for_citation, citation_score desc);
