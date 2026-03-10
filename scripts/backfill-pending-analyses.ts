import { Client } from "pg";

import type { ContestCategory, ContestDifficulty, ContestMode, ContestStatus } from "../types/contest";
import { generateContestAnalysis, type ContestDraft } from "../lib/server/contest-analysis";

type PendingContestRow = {
  id: string;
  slug: string;
  title: string;
  organizer: string;
  short_description: string | null;
  description: string;
  url: string;
  source_url: string | null;
  poster_image_url: string | null;
  apply_url: string | null;
  start_date: string | null;
  deadline: string | null;
  event_date: string | null;
  participation_mode: ContestMode;
  location: string | null;
  eligibility_text: string | null;
  eligibility_segments: string[] | null;
  difficulty: ContestDifficulty;
  team_allowed: boolean;
  min_team_size: number;
  max_team_size: number;
  language: string;
  global_participation: boolean;
  prize_pool_krw: number | null;
  prize_summary: string | null;
  submission_format: string | null;
  tools_allowed: string[] | null;
  dataset_provided: boolean;
  dataset_summary: string | null;
  ai_categories: ContestCategory[] | null;
  tags: string[] | null;
  status: ContestStatus;
};

function toContestDraft(row: PendingContestRow): ContestDraft {
  return {
    slug: row.slug,
    title: row.title,
    organizer: row.organizer,
    shortDescription: row.short_description,
    description: row.description,
    url: row.url,
    sourceUrl: row.source_url,
    posterImageUrl: row.poster_image_url,
    applyUrl: row.apply_url,
    startDate: row.start_date,
    deadline: row.deadline,
    eventDate: row.event_date,
    participationMode: row.participation_mode,
    location: row.location,
    eligibilityText: row.eligibility_text ?? "",
    eligibilitySegments: row.eligibility_segments ?? [],
    difficulty: row.difficulty,
    teamAllowed: row.team_allowed,
    minTeamSize: row.min_team_size,
    maxTeamSize: row.max_team_size,
    language: row.language,
    globalParticipation: row.global_participation,
    prizePoolKrw: row.prize_pool_krw,
    prizeSummary: row.prize_summary,
    submissionFormat: row.submission_format,
    toolsAllowed: row.tools_allowed ?? [],
    datasetProvided: row.dataset_provided,
    datasetSummary: row.dataset_summary,
    aiCategories: row.ai_categories ?? [],
    tags: row.tags ?? [],
    status: row.status,
  };
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL or DATABASE_URL is required.");
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();

  try {
    const pendingResult = await client.query<PendingContestRow>(
      `
        select
          contests.id,
          contests.slug,
          contests.title,
          contests.organizer,
          contests.short_description,
          contests.description,
          contests.url,
          contests.source_url,
          contests.poster_image_url,
          contests.apply_url,
          contests.start_date,
          contests.deadline,
          contests.event_date,
          contests.participation_mode,
          contests.location,
          contests.eligibility_text,
          contests.eligibility_segments,
          contests.difficulty,
          contests.team_allowed,
          contests.min_team_size,
          contests.max_team_size,
          contests.language,
          contests.global_participation,
          contests.prize_pool_krw,
          contests.prize_summary,
          contests.submission_format,
          contests.tools_allowed,
          contests.dataset_provided,
          contests.dataset_summary,
          contests.ai_categories,
          contests.tags,
          contests.status
        from public.contests
        inner join public.contest_ai_analysis
          on contest_ai_analysis.contest_id = contests.id
        where contest_ai_analysis.analysis_status = 'pending'
        order by contests.created_at asc
      `,
    );

    if (pendingResult.rows.length === 0) {
      console.log("No pending analyses found.");
      return;
    }

    let completed = 0;
    let failed = 0;

    for (const row of pendingResult.rows) {
      const draft = toContestDraft(row);
      const analysis = await generateContestAnalysis(draft);

      await client.query(
        `
          update public.contest_ai_analysis
          set
            summary = $2,
            recommend_reason = $3,
            win_strategy = $4,
            difficulty_analysis = $5,
            judging_focus = $6,
            prompt_version = $7,
            model_name = $8,
            analysis_status = $9,
            raw_response = $10::jsonb
          where contest_id = $1
        `,
        [
          row.id,
          analysis.summary,
          analysis.recommendReason,
          analysis.winStrategy,
          analysis.difficultyAnalysis,
          analysis.judgingFocus,
          analysis.promptVersion,
          analysis.modelName,
          analysis.analysisStatus,
          JSON.stringify(analysis.rawResponse),
        ],
      );

      if (analysis.analysisStatus === "completed") {
        completed += 1;
      } else {
        failed += 1;
      }

      console.log(`${row.slug}: ${analysis.analysisStatus}`);
    }

    console.log(`Backfill complete. completed=${completed}, failed=${failed}`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
