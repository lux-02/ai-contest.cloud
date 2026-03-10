import { cache } from "react";

import { mockContests } from "@/lib/mock-contests";
import { getSupabaseClient } from "@/lib/supabase";
import { getCategoryMeta, type Contest, type ContestAnalysis, type ContestBadge, type ContestFilters } from "@/types/contest";

type ContestRow = {
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
  participation_mode: Contest["participationMode"];
  location: string | null;
  eligibility_text: string | null;
  eligibility_segments: string[] | null;
  difficulty: Contest["difficulty"];
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
  ai_categories: Contest["aiCategories"] | null;
  tags: string[] | null;
  status: Contest["status"];
  contest_badges: { badge: ContestBadge; reason: string | null }[] | null;
  contest_ai_analysis:
    | {
        summary: string | null;
        recommend_reason: string | null;
        win_strategy: string | null;
        difficulty_analysis: string | null;
        judging_focus: string | null;
        prompt_version: string | null;
        model_name: string | null;
        analysis_status: ContestAnalysis["analysisStatus"];
      }
    | {
        summary: string | null;
        recommend_reason: string | null;
        win_strategy: string | null;
        difficulty_analysis: string | null;
        judging_focus: string | null;
        prompt_version: string | null;
        model_name: string | null;
        analysis_status: ContestAnalysis["analysisStatus"];
      }[]
    | null;
};

function normalizeAnalysis(row: ContestRow): ContestAnalysis {
  const rawAnalysis = Array.isArray(row.contest_ai_analysis)
    ? row.contest_ai_analysis[0]
    : row.contest_ai_analysis;

  return {
    summary: rawAnalysis?.summary ?? row.short_description ?? "",
    recommendReason: rawAnalysis?.recommend_reason ?? "",
    winStrategy: rawAnalysis?.win_strategy ?? "",
    difficultyAnalysis: rawAnalysis?.difficulty_analysis ?? "",
    judgingFocus: rawAnalysis?.judging_focus ?? "",
    promptVersion: rawAnalysis?.prompt_version ?? undefined,
    modelName: rawAnalysis?.model_name ?? undefined,
    analysisStatus: rawAnalysis?.analysis_status ?? "pending",
  };
}

function mapContestRow(row: ContestRow): Contest {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    organizer: row.organizer,
    shortDescription: row.short_description ?? row.description.slice(0, 140),
    description: row.description,
    url: row.url,
    sourceUrl: row.source_url ?? undefined,
    posterImageUrl: row.poster_image_url ?? undefined,
    applyUrl: row.apply_url ?? undefined,
    startDate: row.start_date ?? undefined,
    deadline: row.deadline ?? undefined,
    eventDate: row.event_date ?? undefined,
    participationMode: row.participation_mode,
    location: row.location ?? undefined,
    eligibilityText: row.eligibility_text ?? "",
    eligibilitySegments: row.eligibility_segments ?? [],
    difficulty: row.difficulty,
    teamAllowed: row.team_allowed,
    minTeamSize: row.min_team_size,
    maxTeamSize: row.max_team_size,
    language: row.language,
    globalParticipation: row.global_participation,
    prizePoolKrw: row.prize_pool_krw ?? undefined,
    prizeSummary: row.prize_summary ?? undefined,
    submissionFormat: row.submission_format ?? undefined,
    toolsAllowed: row.tools_allowed ?? [],
    datasetProvided: row.dataset_provided,
    datasetSummary: row.dataset_summary ?? undefined,
    aiCategories: row.ai_categories ?? [],
    tags: row.tags ?? [],
    badges: row.contest_badges?.map((badge) => badge.badge) ?? [],
    status: row.status,
    analysis: normalizeAnalysis(row),
  };
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function buildContestSearchIndex(contest: Contest) {
  return [
    contest.title,
    contest.organizer,
    contest.shortDescription,
    contest.description,
    contest.eligibilityText,
    contest.prizeSummary,
    contest.submissionFormat,
    contest.analysis.summary,
    contest.analysis.recommendReason,
    contest.analysis.winStrategy,
    ...contest.tags,
    ...contest.toolsAllowed,
    ...contest.aiCategories.map((category) => getCategoryMeta(category).label),
  ]
    .filter(Boolean)
    .join(" \n");
}

function applyFilters(contests: Contest[], filters: ContestFilters) {
  const normalizedQuery = filters.query ? normalizeSearchText(filters.query) : "";
  const compactQuery = normalizedQuery ? compactSearchText(normalizedQuery) : "";

  return contests.filter((contest) => {
    if (normalizedQuery) {
      const searchIndex = buildContestSearchIndex(contest);
      const normalizedIndex = normalizeSearchText(searchIndex);
      const compactIndex = compactSearchText(searchIndex);

      if (!normalizedIndex.includes(normalizedQuery) && !compactIndex.includes(compactQuery)) {
        return false;
      }
    }

    if (filters.category && !contest.aiCategories.includes(filters.category)) {
      return false;
    }

    if (filters.badge && !contest.badges.includes(filters.badge)) {
      return false;
    }

    if (filters.difficulty && contest.difficulty !== filters.difficulty) {
      return false;
    }

    return true;
  });
}

const fetchContestDataset = cache(async () => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return mockContests;
  }

  try {
    const { data, error } = await supabase
      .from("contests")
      .select(
        `
          id,
          slug,
          title,
          organizer,
          short_description,
          description,
          url,
          source_url,
          poster_image_url,
          apply_url,
          start_date,
          deadline,
          event_date,
          participation_mode,
          location,
          eligibility_text,
          eligibility_segments,
          difficulty,
          team_allowed,
          min_team_size,
          max_team_size,
          language,
          global_participation,
          prize_pool_krw,
          prize_summary,
          submission_format,
          tools_allowed,
          dataset_provided,
          dataset_summary,
          ai_categories,
          tags,
          status,
          contest_badges (badge, reason),
          contest_ai_analysis (
            summary,
            recommend_reason,
            win_strategy,
            difficulty_analysis,
            judging_focus,
            prompt_version,
            model_name,
            analysis_status
          )
        `,
      )
      .eq("status", "published")
      .order("deadline", { ascending: true, nullsFirst: false });

    if (error) {
      console.warn(`[supabase] Falling back to mock contests: ${error.message}`);
      return mockContests;
    }

    return ((data ?? []) as ContestRow[]).map(mapContestRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[supabase] Falling back to mock contests: ${message}`);
    return mockContests;
  }
});

export async function getContests(filters: ContestFilters = {}) {
  const contests = await fetchContestDataset();
  return applyFilters(contests, filters);
}

export async function getContestBySlug(slug: string) {
  const contests = await fetchContestDataset();
  return contests.find((contest) => contest.slug === slug) ?? null;
}

export async function getFeaturedContestSections() {
  const contests = await fetchContestDataset();

  const byBadge = (badge: ContestBadge) => contests.filter((contest) => contest.badges.includes(badge)).slice(0, 3);

  return {
    urgent: byBadge("deadline_urgent"),
    highPrize: byBadge("high_prize"),
    studentFriendly: byBadge("student_friendly"),
  };
}

export async function getContestStats() {
  const contests = await fetchContestDataset();

  return {
    contestCount: contests.length,
    badgeCount: 7,
    categoryCount: 8,
  };
}
