import { cache } from "react";

import { mockContests } from "@/lib/mock-contests";
import { deriveOrganizerType } from "@/lib/contest-signals";
import { getSupabaseClient } from "@/lib/supabase";
import {
  getCategoryMeta,
  type Contest,
  type ContestAnalysis,
  type ContestBadge,
  type ContestFilters,
  type ContestJudgingCriterion,
  type ContestOrganizerType,
  type ContestStage,
  type ContestTrustMetadata,
} from "@/types/contest";
import { getContestPopularityScore, getDaysUntil } from "@/lib/utils";

type ContestRow = {
  id: string;
  slug: string;
  title: string;
  organizer: string;
  organizer_type: ContestOrganizerType | null;
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
  submission_items: string[] | null;
  judging_criteria: unknown;
  stage_schedule: unknown;
  past_winners: string | null;
  tools_allowed: string[] | null;
  dataset_provided: boolean;
  dataset_summary: string | null;
  ai_categories: Contest["aiCategories"] | null;
  tags: string[] | null;
  view_count: number | null;
  apply_count: number | null;
  status: Contest["status"];
  updated_at: string | null;
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

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeDisplayText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/([^\n])•\s*/g, "$1\n• ")
    .replace(/^•\s*/g, "• ")
    .replace(/\s+\*\s*/g, "\n* ")
    .replace(/(\d+\.)\s*/g, "\n$1 ")
    .replace(/(\d+\))\s*/g, "\n$1 ")
    .replace(/([.!?])\s*-\s*/g, "$1\n- ")
    .replace(/([^\n])(구글폼 링크:)/g, "$1\n$2")
    .replace(/([^\n])(https?:\/\/)/g, "$1\n$2")
    .replace(/(\[[^\]]+\])/g, "\n$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeLineArray(values: string[] | null | undefined) {
  if (!values?.length) {
    return [];
  }

  return values
    .flatMap((value) =>
      normalizeDisplayText(value)
        .split(/\n+/)
        .map((item) => item.replace(/^[-•]\s*/, "").trim())
        .filter(Boolean),
    )
    .slice(0, 12);
}

function normalizeJudgingLabel(label: string) {
  return normalizeDisplayText(label)
    .split(/\n+/)[0]
    ?.replace(/^[-•]\s*/, "")
    .replace(/\s*등\s*\d+가지.*$/, "")
    .replace(/\s+\d+%$/, "")
    .trim();
}

function parseWeightFromLabel(label: string) {
  const match = label.match(/(\d{1,3})\s*%/);
  return match ? Number(match[1]) : null;
}

function normalizeJudgingCriteriaValue(value: unknown): ContestJudgingCriterion[] {
  return parseJsonArray(value)
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const row = item as {
        label?: unknown;
        weight?: unknown;
        description?: unknown;
      };

      if (typeof row.label !== "string" || row.label.trim().length === 0) {
        return [];
      }

      const normalizedLabel = normalizeJudgingLabel(row.label);

      if (!normalizedLabel) {
        return [];
      }

      return [
        {
          label: normalizedLabel,
          weight: typeof row.weight === "number" ? row.weight : parseWeightFromLabel(row.label),
          description: typeof row.description === "string" ? normalizeDisplayText(row.description) || null : null,
        } satisfies ContestJudgingCriterion,
      ];
    })
    .slice(0, 8);
}

function normalizeStageScheduleValue(value: unknown): ContestStage[] {
  return parseJsonArray(value)
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const row = item as {
        label?: unknown;
        date?: unknown;
        note?: unknown;
      };

      if (typeof row.label !== "string" || row.label.trim().length === 0) {
        return [];
      }

      return [
        {
          label: row.label.trim(),
          date: typeof row.date === "string" ? row.date.trim() || null : null,
          note: typeof row.note === "string" ? row.note.trim() || null : null,
        } satisfies ContestStage,
      ];
    })
    .slice(0, 8);
}

function mapContestRow(row: ContestRow): Contest {
  const analysis = normalizeAnalysis(row);
  const judgingCriteria = normalizeJudgingCriteriaValue(row.judging_criteria);
  const stageSchedule = normalizeStageScheduleValue(row.stage_schedule);
  const normalizedSubmissionItems = normalizeLineArray(row.submission_items);
  const derivedOrganizerType = deriveOrganizerType(
    row.organizer,
    row.title,
    row.short_description ?? row.description,
    row.url,
    row.source_url ?? undefined,
  );
  const organizerType =
    row.organizer_type && row.organizer_type !== "community" ? row.organizer_type : derivedOrganizerType;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    organizer: row.organizer,
    organizerType,
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
    eligibilityText: row.eligibility_text ? normalizeDisplayText(row.eligibility_text) : "",
    eligibilitySegments: row.eligibility_segments ?? [],
    difficulty: row.difficulty,
    teamAllowed: row.team_allowed,
    minTeamSize: row.min_team_size,
    maxTeamSize: row.max_team_size,
    language: row.language,
    globalParticipation: row.global_participation,
    prizePoolKrw: row.prize_pool_krw ?? undefined,
    prizeSummary: row.prize_summary ? normalizeDisplayText(row.prize_summary) : undefined,
    submissionFormat: row.submission_format ? normalizeDisplayText(row.submission_format) : undefined,
    submissionItems:
      normalizedSubmissionItems.length > 0
        ? normalizedSubmissionItems
        : buildFallbackSubmissionItems(row.submission_format),
    judgingCriteria:
      judgingCriteria.length > 0 ? judgingCriteria : buildFallbackJudgingCriteria(analysis.judgingFocus),
    stageSchedule:
      stageSchedule.length > 0
        ? stageSchedule
        : buildFallbackStageSchedule(row.start_date, row.deadline, row.event_date),
    pastWinners: row.past_winners ? normalizeDisplayText(row.past_winners) : undefined,
    toolsAllowed: normalizeLineArray(row.tools_allowed),
    datasetProvided: row.dataset_provided,
    datasetSummary: row.dataset_summary ?? undefined,
    aiCategories: row.ai_categories ?? [],
    tags: row.tags ?? [],
    badges: row.contest_badges?.map((badge) => badge.badge) ?? [],
    viewCount: row.view_count ?? 0,
    applyCount: row.apply_count ?? 0,
    status: row.status,
    analysis,
  };
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function buildFallbackStageSchedule(startDate?: string | null, deadline?: string | null, eventDate?: string | null) {
  return [
    startDate ? ({ label: "접수 시작", date: startDate, note: null } satisfies ContestStage) : null,
    deadline ? ({ label: "서류 마감", date: deadline, note: null } satisfies ContestStage) : null,
    eventDate ? ({ label: "발표 / 본선", date: eventDate, note: null } satisfies ContestStage) : null,
  ].flatMap((stage) => (stage ? [stage] : []));
}

function buildFallbackSubmissionItems(submissionFormat?: string | null) {
  if (!submissionFormat) {
    return [];
  }

  return normalizeDisplayText(submissionFormat)
    .split(/\n|·/)
    .map((item) => item.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function buildFallbackJudgingCriteria(judgingFocus?: string | null) {
  if (!judgingFocus) {
    return [];
  }

  const items = judgingFocus
    .split(/,|\n/)
    .map((item) => normalizeJudgingLabel(item))
    .filter(Boolean)
    .slice(0, 5);

  if (items.length === 0) {
    return [];
  }

  const evenWeight = Math.floor(100 / items.length);

  return items.map((item, index) => ({
    label: item,
    weight: parseWeightFromLabel(item) ?? (index === items.length - 1 ? 100 - evenWeight * index : evenWeight),
    description: null,
  }));
}

function getContestAgeInDays(updatedAt: string, fetchedAt: string) {
  const updatedTime = new Date(updatedAt).getTime();
  const fetchedTime = new Date(fetchedAt).getTime();

  if (!Number.isFinite(updatedTime) || !Number.isFinite(fetchedTime)) {
    return null;
  }

  const diffDays = Math.floor((fetchedTime - updatedTime) / 86_400_000);
  return Math.max(diffDays, 0);
}

function buildContestTrustMetadata(
  contest: Contest,
  input: {
    sourceKind: ContestTrustMetadata["source"]["kind"];
    fetchedAt: string;
    updatedAt?: string | null;
    sourceUrl?: string | null;
  },
): ContestTrustMetadata {
  const source =
    input.sourceKind === "mock"
      ? {
          kind: "mock" as const,
          label: "개발용 mock 데이터",
          url: input.sourceUrl ?? contest.sourceUrl ?? contest.url,
        }
      : {
          kind: "database" as const,
          label: "Supabase contests table",
          url: input.sourceUrl ?? contest.sourceUrl ?? contest.url,
        };

  const freshness =
    source.kind === "mock"
      ? ({
          status: "unknown",
          label: "개발용 샘플 데이터",
          ageInDays: null,
          warning: "개발 환경 전용 mock 데이터라 최신성 판단을 보장할 수 없습니다.",
        } satisfies ContestTrustMetadata["freshness"])
      : (() => {
          if (!input.updatedAt) {
            return {
              status: "unknown",
              label: "업데이트 시점 미상",
              ageInDays: null,
              warning: "DB 행의 updated_at 값을 읽지 못했습니다.",
            } satisfies ContestTrustMetadata["freshness"];
          }

          const ageInDays = getContestAgeInDays(input.updatedAt, input.fetchedAt);

          if (ageInDays === null) {
            return {
              status: "unknown",
              label: "업데이트 시점 파싱 실패",
              ageInDays: null,
              warning: "업데이트 시점을 해석하지 못했습니다.",
            } satisfies ContestTrustMetadata["freshness"];
          }

          if (ageInDays <= 14) {
            return {
              status: "fresh",
              label: ageInDays === 0 ? "오늘 업데이트" : `${ageInDays}일 전 업데이트`,
              ageInDays,
              warning: null,
            } satisfies ContestTrustMetadata["freshness"];
          }

          return {
            status: "stale",
            label: `${ageInDays}일 전 업데이트`,
            ageInDays,
            warning: `마지막 업데이트가 ${ageInDays}일 전입니다.`,
          } satisfies ContestTrustMetadata["freshness"];
        })();

  const completenessWarnings = [
    !contest.sourceUrl ? "수집 출처 링크가 아직 연결되지 않았습니다." : null,
    !contest.applyUrl ? "신청 링크가 아직 정리되지 않았습니다." : null,
    !contest.submissionFormat && (contest.submissionItems?.length ?? 0) === 0
      ? "제출 형식 정보가 아직 충분하지 않습니다."
      : null,
    (contest.judgingCriteria?.length ?? 0) === 0 ? "심사 기준이 아직 구조화되지 않았습니다." : null,
    (contest.stageSchedule?.length ?? 0) === 0 &&
    !contest.startDate &&
    !contest.deadline &&
    !contest.eventDate
      ? "일정 정보가 아직 충분하지 않습니다."
      : null,
    contest.prizeSummary && !contest.prizePoolKrw
      ? "상금 요약은 있으나 정규화 금액이 없어 상금 비교 정확도가 낮을 수 있습니다."
      : null,
    contest.analysis.analysisStatus !== "completed"
      ? `AI 분석 상태가 ${contest.analysis.analysisStatus}입니다.`
      : null,
  ].filter((warning): warning is string => Boolean(warning));

  const completeness = {
    status:
      completenessWarnings.length === 0
        ? "complete"
        : completenessWarnings.length <= 2
          ? "partial"
          : "sparse",
    warnings: completenessWarnings,
  } satisfies ContestTrustMetadata["completeness"];

  const warnings = [...(freshness.warning ? [freshness.warning] : []), ...completenessWarnings];

  return {
    source,
    update: {
      fetchedAt: input.fetchedAt,
      updatedAt: input.updatedAt ?? null,
    },
    freshness,
    completeness,
    warnings,
  };
}

function attachContestTrustMetadata(
  contest: Contest,
  input: {
    sourceKind: ContestTrustMetadata["source"]["kind"];
    fetchedAt: string;
    updatedAt?: string | null;
    sourceUrl?: string | null;
  },
): Contest {
  return {
    ...contest,
    provenance: buildContestTrustMetadata(contest, input),
  };
}

function buildMockContestDataset(fetchedAt: string) {
  return mockContests.map((contest) =>
    attachContestTrustMetadata(contest, {
      sourceKind: "mock",
      fetchedAt,
      updatedAt: null,
      sourceUrl: contest.sourceUrl ?? contest.url,
    }),
  );
}

function buildContestSearchIndex(contest: Contest) {
  return [
    contest.title,
    contest.organizer,
    contest.organizerType,
    contest.shortDescription,
    contest.description,
    contest.eligibilityText,
    contest.prizeSummary,
    contest.submissionFormat,
    contest.pastWinners,
    contest.analysis.summary,
    contest.analysis.recommendReason,
    contest.analysis.winStrategy,
    ...contest.tags,
    ...contest.toolsAllowed,
    ...contest.aiCategories.map((category) => getCategoryMeta(category).label),
    ...(contest.submissionItems ?? []),
    ...(contest.judgingCriteria ?? []).map((criterion) => criterion.label),
  ]
    .filter(Boolean)
    .join(" \n");
}

function sortContests(contests: Contest[], sort: NonNullable<ContestFilters["sort"]> = "deadline") {
  const sorted = [...contests];

  if (sort === "prize") {
    return sorted.sort((left, right) => (right.prizePoolKrw ?? 0) - (left.prizePoolKrw ?? 0));
  }

  if (sort === "popular") {
    return sorted.sort(
      (left, right) =>
        getContestPopularityScore(right.viewCount ?? 0, right.applyCount ?? 0) -
          getContestPopularityScore(left.viewCount ?? 0, left.applyCount ?? 0) ||
        (right.applyCount ?? 0) - (left.applyCount ?? 0) ||
        (right.viewCount ?? 0) - (left.viewCount ?? 0),
    );
  }

  return sorted.sort((left, right) => {
    const leftDays = getDaysUntil(left.deadline);
    const rightDays = getDaysUntil(right.deadline);

    if (leftDays === null && rightDays === null) {
      return 0;
    }

    if (leftDays === null) {
      return 1;
    }

    if (rightDays === null) {
      return -1;
    }

    return leftDays - rightDays;
  });
}

function applyFilters(contests: Contest[], filters: ContestFilters) {
  const normalizedQuery = filters.query ? normalizeSearchText(filters.query) : "";
  const compactQuery = normalizedQuery ? compactSearchText(normalizedQuery) : "";

  const filtered = contests.filter((contest) => {
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

    if (filters.organizerType && contest.organizerType !== filters.organizerType) {
      return false;
    }

    if (filters.teamType === "individual" && contest.teamAllowed) {
      return false;
    }

    if (filters.teamType === "team" && !contest.teamAllowed) {
      return false;
    }

    return true;
  });

  return sortContests(filtered, filters.sort ?? "deadline");
}

const fetchContestDataset = cache(async () => {
  const supabase = getSupabaseClient();
  const fetchedAt = new Date().toISOString();
  const isProduction = process.env.NODE_ENV === "production";

  if (!supabase) {
    if (isProduction) {
      throw new Error("[supabase] Contest dataset unavailable: Supabase client is not configured.");
    }

    console.warn("[supabase] Using development mock contests because Supabase client is not configured.");
    return buildMockContestDataset(fetchedAt);
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
          organizer_type,
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
          submission_items,
          judging_criteria,
          stage_schedule,
          past_winners,
          tools_allowed,
          dataset_provided,
          dataset_summary,
          ai_categories,
          tags,
          view_count,
          apply_count,
          status,
          updated_at,
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
      if (isProduction) {
        throw new Error(`[supabase] Contest dataset query failed: ${error.message}`);
      }

      console.warn(`[supabase] Using development mock contests after fetch error: ${error.message}`);
      return buildMockContestDataset(fetchedAt);
    }

    return ((data ?? []) as ContestRow[]).map((row) =>
      attachContestTrustMetadata(mapContestRow(row), {
        sourceKind: "database",
        fetchedAt,
        updatedAt: row.updated_at,
        sourceUrl: row.source_url,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isProduction) {
      throw new Error(`[supabase] Contest dataset unavailable: ${message}`);
    }

    console.warn(`[supabase] Using development mock contests after fetch exception: ${message}`);
    return buildMockContestDataset(fetchedAt);
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

export async function getContestById(id: string) {
  const contests = await fetchContestDataset();
  return contests.find((contest) => contest.id === id) ?? null;
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
