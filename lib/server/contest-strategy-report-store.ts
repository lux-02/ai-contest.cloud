import "server-only";

import type { QueryResultRow } from "pg";

import { getDbPool } from "@/lib/server/db";
import type { ContestStrategyLabResult } from "@/types/contest";

import type { CollectedStrategySource } from "./contest-source-collector";

type StrategyReportRow = QueryResultRow & {
  id: string;
  overview: string | null;
  recommended_direction: string | null;
  ideas: unknown;
  research_points: unknown;
  draft_title: string | null;
  draft_subtitle: string | null;
  draft_sections: unknown;
  citations: unknown;
  status: ContestStrategyLabResult["status"];
  prompt_version: string | null;
  model_name: string | null;
};

type StrategySourceRow = QueryResultRow & {
  source_label: string | null;
  source_type: string;
  url: string | null;
  title: string;
  snippet: string;
  search_query: string | null;
  ranking_score: number | null;
  citation_score: number | null;
  selected_for_citation: boolean | null;
};

function parseArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function getStoredStrategyReport(contestId: string) {
  try {
    const pool = getDbPool();
    const result = await pool.query<StrategyReportRow>(
      `
        select
          id,
          overview,
          recommended_direction,
          ideas,
          research_points,
          draft_title,
          draft_subtitle,
          draft_sections,
          citations,
          status,
          prompt_version,
          model_name
        from public.contest_strategy_reports
        where contest_id = $1
        limit 1
      `,
      [contestId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      overview: row.overview ?? "",
      recommendedDirection: row.recommended_direction ?? "",
      ideas: parseArray<ContestStrategyLabResult["ideas"][number]>(row.ideas),
      researchPoints: parseArray<ContestStrategyLabResult["researchPoints"][number]>(row.research_points),
      draftTitle: row.draft_title ?? "",
      draftSubtitle: row.draft_subtitle ?? "",
      draftSections: parseArray<ContestStrategyLabResult["draftSections"][number]>(row.draft_sections),
      citations: parseArray<ContestStrategyLabResult["citations"][number]>(row.citations),
      status: row.status,
      promptVersion: row.prompt_version,
      modelName: row.model_name,
    } satisfies ContestStrategyLabResult;
  } catch {
    return null;
  }
}

export async function upsertStrategyReport(
  contestId: string,
  report: ContestStrategyLabResult,
  sources: CollectedStrategySource[],
) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const reportResult = await client.query<{ id: string }>(
      `
        insert into public.contest_strategy_reports (
          contest_id,
          overview,
          recommended_direction,
          ideas,
          research_points,
          draft_title,
          draft_subtitle,
          draft_sections,
          citations,
          status,
          prompt_version,
          model_name
        )
        values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12)
        on conflict (contest_id) do update
        set
          overview = excluded.overview,
          recommended_direction = excluded.recommended_direction,
          ideas = excluded.ideas,
          research_points = excluded.research_points,
          draft_title = excluded.draft_title,
          draft_subtitle = excluded.draft_subtitle,
          draft_sections = excluded.draft_sections,
          citations = excluded.citations,
          status = excluded.status,
          prompt_version = excluded.prompt_version,
          model_name = excluded.model_name,
          generated_at = timezone('utc', now()),
          updated_at = timezone('utc', now())
        returning id
      `,
      [
        contestId,
        report.overview,
        report.recommendedDirection,
        JSON.stringify(report.ideas),
        JSON.stringify(report.researchPoints),
        report.draftTitle,
        report.draftSubtitle,
        JSON.stringify(report.draftSections),
        JSON.stringify(report.citations),
        report.status,
        report.promptVersion ?? null,
        report.modelName ?? null,
      ],
    );

    const reportId = reportResult.rows[0]?.id;

    if (!reportId) {
      throw new Error("Could not persist strategy report.");
    }

    await client.query("delete from public.contest_strategy_sources where report_id = $1", [reportId]);

    for (const source of sources) {
      await client.query(
        `
          insert into public.contest_strategy_sources (
            report_id,
            source_label,
            source_type,
            url,
            title,
            snippet,
            content_text,
            http_status,
            search_query,
            ranking_score,
            citation_score,
            selected_for_citation
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          reportId,
          source.label,
          source.sourceType,
          source.url ?? null,
          source.title,
          source.snippet,
          source.contentText,
          source.httpStatus ?? null,
          source.searchQuery ?? null,
          source.rankingScore,
          source.citationScore,
          source.selectedForCitation,
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getStoredStrategySources(contestId: string) {
  try {
    const pool = getDbPool();
    const result = await pool.query<StrategySourceRow>(
      `
        select
          strategy_sources.source_label,
          strategy_sources.source_type,
          strategy_sources.url,
          strategy_sources.title,
          strategy_sources.snippet,
          strategy_sources.search_query,
          strategy_sources.ranking_score,
          strategy_sources.citation_score,
          strategy_sources.selected_for_citation
        from public.contest_strategy_sources as strategy_sources
        inner join public.contest_strategy_reports as reports
          on reports.id = strategy_sources.report_id
        where reports.contest_id = $1
        order by strategy_sources.selected_for_citation desc nulls last, strategy_sources.citation_score desc nulls last, strategy_sources.ranking_score desc nulls last
      `,
      [contestId],
    );

    return result.rows.map((row) => ({
      label: row.source_label ?? "",
      sourceType: row.source_type,
      url: row.url,
      title: row.title,
      snippet: row.snippet,
      searchQuery: row.search_query,
      rankingScore: row.ranking_score,
      citationScore: row.citation_score,
      selectedForCitation: row.selected_for_citation,
    }));
  } catch {
    return [];
  }
}
