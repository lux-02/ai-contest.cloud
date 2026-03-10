import "server-only";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type PoolClient, type QueryResultRow } from "pg";

import {
  contestCategoryOptions,
  organizerTypeOptions,
  type ContestAnalysisStatus,
  type ContestCategory,
  type ContestDifficulty,
  type ContestJudgingCriterion,
  type ContestMode,
  type ContestOrganizerType,
  type ContestStage,
  type ContestStatus,
} from "@/types/contest";
import {
  generateContestAnalysis,
  type ContestDraft,
  type GeneratedAnalysis,
} from "@/lib/server/contest-analysis";
import { assertAdminAction } from "@/lib/server/admin-auth";
import { getDbPool } from "@/lib/server/db";
import { triggerGitHubContentRefresh } from "@/lib/server/github-content-refresh";

export type CreateContestState = {
  status: "idle" | "success" | "error";
  message?: string;
  issues?: string[];
  createdSlug?: string;
  analysisStatus?: ContestAnalysisStatus;
};

export type AdminContestRow = {
  id: string;
  slug: string;
  title: string;
  organizer: string;
  deadline: string | null;
  status: ContestStatus;
  analysis_status: ContestAnalysisStatus | null;
  created_at: string;
};

export type AdminContestRecord = ContestDraft & {
  id: string;
  createdAt: string;
  updatedAt: string;
  analysisStatus: ContestAnalysisStatus;
};

type StoredAnalysisRow = QueryResultRow & {
  summary: string | null;
  recommend_reason: string | null;
  win_strategy: string | null;
  difficulty_analysis: string | null;
  judging_focus: string | null;
  prompt_version: string;
  model_name: string | null;
  analysis_status: ContestAnalysisStatus;
  raw_response: unknown;
};

type AdminContestRecordRow = QueryResultRow & {
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
  submission_items: string[] | null;
  judging_criteria: ContestJudgingCriterion[] | null;
  stage_schedule: ContestStage[] | null;
  past_winners: string | null;
  tools_allowed: string[] | null;
  dataset_provided: boolean;
  dataset_summary: string | null;
  ai_categories: ContestCategory[] | null;
  tags: string[] | null;
  status: ContestStatus;
  created_at: string;
  updated_at: string;
  analysis_status: ContestAnalysisStatus | null;
};

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

function parseString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalString(value: FormDataEntryValue | null) {
  const parsed = parseString(value);
  return parsed.length > 0 ? parsed : null;
}

function parseCommaList(value: FormDataEntryValue | null) {
  const parsed = parseString(value);

  if (!parsed) {
    return [];
  }

  return parsed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCategories(formData: FormData) {
  const categories = formData.getAll("aiCategories").filter((value): value is string => typeof value === "string");
  return categories.filter((category): category is ContestCategory =>
    contestCategoryOptions.some((option) => option.id === category),
  );
}

function parseOrganizerType(value: FormDataEntryValue | null) {
  const parsed = parseString(value);
  return organizerTypeOptions.some((option) => option.id === parsed) ? (parsed as ContestOrganizerType) : null;
}

function parseTextareaList(value: FormDataEntryValue | null) {
  return parseString(value)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseStageSchedule(value: FormDataEntryValue | null) {
  return parseTextareaList(value).map((line) => {
    const [label, date, note] = line.split("|").map((item) => item.trim());
    return {
      label,
      date: date || null,
      note: note || null,
    } satisfies ContestStage;
  });
}

function parseJudgingCriteria(value: FormDataEntryValue | null) {
  return parseTextareaList(value)
    .map((line) => {
      const [label, weight, description] = line.split("|").map((item) => item.trim());
      return {
        label,
        weight: weight ? Number(weight) : null,
        description: description || null,
      } satisfies ContestJudgingCriterion;
    })
    .filter((criterion) => criterion.label);
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function buildContestDraft(formData: FormData, fallbackSlug?: string): { draft?: ContestDraft; issues: string[] } {
  const title = parseString(formData.get("title"));
  const organizer = parseString(formData.get("organizer"));
  const organizerType = parseOrganizerType(formData.get("organizerType"));
  const description = parseString(formData.get("description"));
  const url = parseString(formData.get("url"));
  const shortDescription = parseOptionalString(formData.get("shortDescription"));
  const sourceUrl = parseOptionalString(formData.get("sourceUrl"));
  const posterImageUrl = parseOptionalString(formData.get("posterImageUrl"));
  const applyUrl = parseOptionalString(formData.get("applyUrl"));
  const startDate = parseOptionalString(formData.get("startDate"));
  const deadline = parseOptionalString(formData.get("deadline"));
  const eventDate = parseOptionalString(formData.get("eventDate"));
  const participationMode = (parseString(formData.get("participationMode")) || "online") as ContestMode;
  const location = parseOptionalString(formData.get("location"));
  const eligibilityText = parseString(formData.get("eligibilityText"));
  const eligibilitySegments = parseCommaList(formData.get("eligibilitySegments"));
  const difficulty = (parseString(formData.get("difficulty")) || "intermediate") as ContestDifficulty;
  const teamAllowed = parseBoolean(formData.get("teamAllowed"));
  const minTeamSize = Number.parseInt(parseString(formData.get("minTeamSize")) || "1", 10);
  const maxTeamSize = Number.parseInt(parseString(formData.get("maxTeamSize")) || "4", 10);
  const language = parseString(formData.get("language")) || "Korean";
  const globalParticipation = parseBoolean(formData.get("globalParticipation"));
  const prizePoolValue = parseString(formData.get("prizePoolKrw"));
  const prizePoolKrw = prizePoolValue ? Number.parseFloat(prizePoolValue) : null;
  const prizeSummary = parseOptionalString(formData.get("prizeSummary"));
  const submissionFormat = parseOptionalString(formData.get("submissionFormat"));
  const submissionItems = parseTextareaList(formData.get("submissionItems"));
  const judgingCriteria = parseJudgingCriteria(formData.get("judgingCriteria"));
  const stageSchedule = parseStageSchedule(formData.get("stageSchedule"));
  const pastWinners = parseOptionalString(formData.get("pastWinners"));
  const toolsAllowed = parseCommaList(formData.get("toolsAllowed"));
  const datasetProvided = parseBoolean(formData.get("datasetProvided"));
  const datasetSummary = parseOptionalString(formData.get("datasetSummary"));
  const aiCategories = parseCategories(formData);
  const tags = parseCommaList(formData.get("tags"));
  const status = (parseString(formData.get("status")) || "published") as ContestStatus;

  const issues: string[] = [];

  if (!title) {
    issues.push("대회명은 필수입니다.");
  }

  if (!organizer) {
    issues.push("주최 기관은 필수입니다.");
  }

  if (!description) {
    issues.push("대회 설명은 필수입니다.");
  }

  if (!url) {
    issues.push("원문 링크는 필수입니다.");
  }

  if (!deadline) {
    issues.push("마감일은 필수입니다.");
  }

  if (posterImageUrl && !/^https?:\/\//.test(posterImageUrl)) {
    issues.push("공고 이미지 URL은 http 또는 https로 시작해야 합니다.");
  }

  if (applyUrl && !/^https?:\/\//.test(applyUrl)) {
    issues.push("신청 링크는 http 또는 https로 시작해야 합니다.");
  }

  if (!Number.isFinite(minTeamSize) || minTeamSize < 1) {
    issues.push("최소 팀 인원은 1 이상이어야 합니다.");
  }

  if (!Number.isFinite(maxTeamSize) || maxTeamSize < minTeamSize) {
    issues.push("최대 팀 인원은 최소 팀 인원보다 크거나 같아야 합니다.");
  }

  if (prizePoolValue && !Number.isFinite(prizePoolKrw)) {
    issues.push("상금은 숫자로 입력해 주세요.");
  }

  if (aiCategories.length === 0) {
    issues.push("AI 카테고리는 최소 1개 선택해 주세요.");
  }

  if (issues.length > 0) {
    return { issues };
  }

  return {
    issues,
    draft: {
      slug: (fallbackSlug ?? slugify(title)) || `contest-${randomUUID().slice(0, 8)}`,
      title,
      organizer,
      organizerType,
      shortDescription,
      description,
      url,
      sourceUrl,
      posterImageUrl,
      applyUrl,
      startDate,
      deadline,
      eventDate,
      participationMode,
      location,
      eligibilityText,
      eligibilitySegments,
      difficulty,
      teamAllowed,
      minTeamSize,
      maxTeamSize,
      language,
      globalParticipation,
      prizePoolKrw,
      prizeSummary,
      submissionFormat,
      submissionItems,
      judgingCriteria,
      stageSchedule,
      pastWinners,
      toolsAllowed,
      datasetProvided,
      datasetSummary,
      aiCategories,
      tags,
      status,
    },
  };
}

function mapStoredAnalysis(row: StoredAnalysisRow | undefined, draft: ContestDraft): GeneratedAnalysis {
  if (!row) {
    return {
      summary: draft.shortDescription ?? "분석 대기 중",
      recommendReason: "",
      winStrategy: "",
      difficultyAnalysis: "",
      judgingFocus: "",
      promptVersion: "contest-v1",
      modelName: null,
      analysisStatus: "pending",
      rawResponse: null,
    };
  }

  return {
    summary: row.summary ?? draft.shortDescription ?? "",
    recommendReason: row.recommend_reason ?? "",
    winStrategy: row.win_strategy ?? "",
    difficultyAnalysis: row.difficulty_analysis ?? "",
    judgingFocus: row.judging_focus ?? "",
    promptVersion: row.prompt_version,
    modelName: row.model_name,
    analysisStatus: row.analysis_status,
    rawResponse: row.raw_response,
  };
}

function mapAdminContestRecord(row: AdminContestRecordRow): AdminContestRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    organizer: row.organizer,
    organizerType: row.organizer_type,
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
    submissionItems: row.submission_items ?? [],
    judgingCriteria: row.judging_criteria ?? [],
    stageSchedule: row.stage_schedule ?? [],
    pastWinners: row.past_winners,
    toolsAllowed: row.tools_allowed ?? [],
    datasetProvided: row.dataset_provided,
    datasetSummary: row.dataset_summary,
    aiCategories: row.ai_categories ?? [],
    tags: row.tags ?? [],
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    analysisStatus: row.analysis_status ?? "pending",
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: string }).code === "string" &&
    (error as { code: string }).code === "23505"
  );
}

async function getStoredAnalysis(contestId: string) {
  const pool = getDbPool();
  const result = await pool.query<StoredAnalysisRow>(
    `
      select
        summary,
        recommend_reason,
        win_strategy,
        difficulty_analysis,
        judging_focus,
        prompt_version,
        model_name,
        analysis_status,
        raw_response
      from public.contest_ai_analysis
      where contest_id = $1
      limit 1
    `,
    [contestId],
  );

  return result.rows[0];
}

async function resolveAnalysisForUpdate(contestId: string, draft: ContestDraft) {
  if (process.env.OPENAI_API_KEY) {
    return generateContestAnalysis(draft);
  }

  const stored = await getStoredAnalysis(contestId);
  return mapStoredAnalysis(stored, draft);
}

async function upsertAnalysis(client: PoolClient, contestId: string, analysis: GeneratedAnalysis) {
  await client.query(
    `
      insert into public.contest_ai_analysis (
        contest_id,
        summary,
        recommend_reason,
        win_strategy,
        difficulty_analysis,
        judging_focus,
        prompt_version,
        model_name,
        analysis_status,
        raw_response
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      on conflict (contest_id) do update
      set
        summary = excluded.summary,
        recommend_reason = excluded.recommend_reason,
        win_strategy = excluded.win_strategy,
        difficulty_analysis = excluded.difficulty_analysis,
        judging_focus = excluded.judging_focus,
        prompt_version = excluded.prompt_version,
        model_name = excluded.model_name,
        analysis_status = excluded.analysis_status,
        raw_response = excluded.raw_response
    `,
    [
      contestId,
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
}

async function insertContest(draft: ContestDraft, analysis: GeneratedAnalysis, forceSlug?: string) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const resolvedSlug = forceSlug ?? draft.slug;

    const contestResult = await client.query<{ id: string }>(
      `
        insert into public.contests (
          slug,
          title,
          organizer,
          organizer_type,
          short_description,
          description,
          url,
          source,
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
          status
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, 'manual', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28::jsonb, $29::jsonb, $30, $31, $32, $33, $34, $35, $36
        )
        returning id
      `,
      [
        resolvedSlug,
        draft.title,
        draft.organizer,
        draft.organizerType,
        draft.shortDescription,
        draft.description,
        draft.url,
        draft.sourceUrl,
        draft.posterImageUrl,
        draft.applyUrl ?? draft.url,
        draft.startDate,
        draft.deadline,
        draft.eventDate,
        draft.participationMode,
        draft.location,
        draft.eligibilityText,
        draft.eligibilitySegments,
        draft.difficulty,
        draft.teamAllowed,
        draft.minTeamSize,
        draft.maxTeamSize,
        draft.language,
        draft.globalParticipation,
        draft.prizePoolKrw,
        draft.prizeSummary,
        draft.submissionFormat,
        draft.submissionItems,
        JSON.stringify(draft.judgingCriteria),
        JSON.stringify(draft.stageSchedule),
        draft.pastWinners,
        draft.toolsAllowed,
        draft.datasetProvided,
        draft.datasetSummary,
        draft.aiCategories,
        draft.tags,
        draft.status,
      ],
    );

    const contestId = contestResult.rows[0]?.id;

    if (!contestId) {
      throw new Error("Failed to create contest.");
    }

    await upsertAnalysis(client, contestId, analysis);
    await client.query("select public.refresh_contest_badges($1)", [contestId]);
    await client.query("commit");

    return resolvedSlug;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function updateContest(contestId: string, draft: ContestDraft, analysis: GeneratedAnalysis) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const result = await client.query<{ slug: string }>(
      `
        update public.contests
        set
          title = $2,
          organizer = $3,
          organizer_type = $4,
          short_description = $5,
          description = $6,
          url = $7,
          source_url = $8,
          poster_image_url = $9,
          apply_url = $10,
          start_date = $11,
          deadline = $12,
          event_date = $13,
          participation_mode = $14,
          location = $15,
          eligibility_text = $16,
          eligibility_segments = $17,
          difficulty = $18,
          team_allowed = $19,
          min_team_size = $20,
          max_team_size = $21,
          language = $22,
          global_participation = $23,
          prize_pool_krw = $24,
          prize_summary = $25,
          submission_format = $26,
          submission_items = $27,
          judging_criteria = $28::jsonb,
          stage_schedule = $29::jsonb,
          past_winners = $30,
          tools_allowed = $31,
          dataset_provided = $32,
          dataset_summary = $33,
          ai_categories = $34,
          tags = $35,
          status = $36
        where id = $1
        returning slug
      `,
      [
        contestId,
        draft.title,
        draft.organizer,
        draft.organizerType,
        draft.shortDescription,
        draft.description,
        draft.url,
        draft.sourceUrl,
        draft.posterImageUrl,
        draft.applyUrl ?? draft.url,
        draft.startDate,
        draft.deadline,
        draft.eventDate,
        draft.participationMode,
        draft.location,
        draft.eligibilityText,
        draft.eligibilitySegments,
        draft.difficulty,
        draft.teamAllowed,
        draft.minTeamSize,
        draft.maxTeamSize,
        draft.language,
        draft.globalParticipation,
        draft.prizePoolKrw,
        draft.prizeSummary,
        draft.submissionFormat,
        draft.submissionItems,
        JSON.stringify(draft.judgingCriteria),
        JSON.stringify(draft.stageSchedule),
        draft.pastWinners,
        draft.toolsAllowed,
        draft.datasetProvided,
        draft.datasetSummary,
        draft.aiCategories,
        draft.tags,
        draft.status,
      ],
    );

    const slug = result.rows[0]?.slug;

    if (!slug) {
      throw new Error("수정할 대회를 찾지 못했습니다.");
    }

    await upsertAnalysis(client, contestId, analysis);
    await client.query("select public.refresh_contest_badges($1)", [contestId]);
    await client.query("commit");

    return slug;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getContestDraftById(contestId: string) {
  const pool = getDbPool();
  const result = await pool.query<AdminContestRecordRow>(
    `
      select
        contests.id,
        contests.slug,
        contests.title,
        contests.organizer,
        contests.organizer_type,
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
        contests.submission_items,
        contests.judging_criteria,
        contests.stage_schedule,
        contests.past_winners,
        contests.tools_allowed,
        contests.dataset_provided,
        contests.dataset_summary,
        contests.ai_categories,
        contests.tags,
        contests.status,
        contests.created_at,
        contests.updated_at,
        contest_ai_analysis.analysis_status
      from public.contests
      left join public.contest_ai_analysis
        on contest_ai_analysis.contest_id = contests.id
      where contests.id = $1
      limit 1
    `,
    [contestId],
  );

  return result.rows[0] ? mapAdminContestRecord(result.rows[0]) : null;
}

function revalidateContestPaths(slug?: string) {
  revalidatePath("/");
  revalidatePath("/contests");
  revalidatePath("/admin/contests");

  if (slug) {
    revalidatePath(`/contests/${slug}`);
    revalidatePath(`/admin/contests/${slug}`);
  }
}

async function triggerContentRefreshForPublishedContest(options: {
  previousStatus?: ContestStatus;
  nextStatus?: ContestStatus;
  slug?: string;
  reason: "contest_created" | "contest_updated" | "contest_deleted";
}) {
  const shouldTrigger =
    options.previousStatus === "published" || options.nextStatus === "published";

  if (!shouldTrigger) {
    return;
  }

  await triggerGitHubContentRefresh({
    slug: options.slug,
    reason: options.reason,
  });
}

export async function createContestAction(
  _previousState: CreateContestState,
  formData: FormData,
): Promise<CreateContestState> {
  "use server";

  await assertAdminAction("/admin/contests");

  const { draft, issues } = buildContestDraft(formData);

  if (!draft) {
    return {
      status: "error",
      message: "입력값을 다시 확인해 주세요.",
      issues,
    };
  }

  try {
    const analysis = await generateContestAnalysis(draft);

    let createdSlug: string;

    try {
      createdSlug = await insertContest(draft, analysis);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      createdSlug = await insertContest(draft, analysis, `${draft.slug}-${randomUUID().slice(0, 6)}`);
    }

    revalidateContestPaths(createdSlug);
    await triggerContentRefreshForPublishedContest({
      nextStatus: draft.status,
      slug: createdSlug,
      reason: "contest_created",
    });

    return {
      status: "success",
      message:
        analysis.analysisStatus === "completed"
          ? "대회가 저장되고 GPT 분석까지 완료됐습니다."
          : "대회는 저장됐고, 분석은 대기 상태로 생성됐습니다.",
      createdSlug,
      analysisStatus: analysis.analysisStatus,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "대회 저장 중 오류가 발생했습니다.",
    };
  }
}

export async function updateContestAction(
  contestId: string,
  _previousState: CreateContestState,
  formData: FormData,
): Promise<CreateContestState> {
  "use server";

  await assertAdminAction("/admin/contests");

  const existing = await getContestDraftById(contestId);

  if (!existing) {
    return {
      status: "error",
      message: "수정할 대회를 찾지 못했습니다.",
    };
  }

  const { draft, issues } = buildContestDraft(formData, existing.slug);

  if (!draft) {
    return {
      status: "error",
      message: "입력값을 다시 확인해 주세요.",
      issues,
    };
  }

  try {
    const analysis = await resolveAnalysisForUpdate(contestId, draft);
    const updatedSlug = await updateContest(contestId, draft, analysis);

    revalidateContestPaths(updatedSlug);
    await triggerContentRefreshForPublishedContest({
      previousStatus: existing.status,
      nextStatus: draft.status,
      slug: updatedSlug,
      reason: "contest_updated",
    });

    return {
      status: "success",
      message:
        analysis.analysisStatus === "completed"
          ? "대회 정보와 GPT 분석을 함께 업데이트했습니다."
          : "대회 정보는 저장했고, 분석은 기존 상태를 유지했습니다.",
      createdSlug: updatedSlug,
      analysisStatus: analysis.analysisStatus,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "대회 수정 중 오류가 발생했습니다.",
    };
  }
}

export async function retryContestAnalysisAction(contestId: string) {
  "use server";

  await assertAdminAction("/admin/contests");

  const contest = await getContestDraftById(contestId);

  if (!contest) {
    return;
  }

  const analysis = await generateContestAnalysis(contest);
  await updateContest(contestId, contest, analysis);
  revalidateContestPaths(contest.slug);
}

export async function deleteContestAction(contestId: string) {
  "use server";

  await assertAdminAction("/admin/contests");

  const pool = getDbPool();
  const existing = await getContestDraftById(contestId);

  if (!existing) {
    redirect("/admin/contests");
  }

  await pool.query("delete from public.contests where id = $1", [contestId]);
  revalidateContestPaths(existing.slug);
  await triggerContentRefreshForPublishedContest({
    previousStatus: existing.status,
    slug: existing.slug,
    reason: "contest_deleted",
  });
  redirect("/admin/contests");
}

export async function getAdminContestRows() {
  const pool = getDbPool();
  const result = await pool.query<AdminContestRow>(
    `
      select
        contests.id,
        contests.slug,
        contests.title,
        contests.organizer,
        contests.deadline,
        contests.status,
        contest_ai_analysis.analysis_status,
        contests.created_at
      from public.contests
      left join public.contest_ai_analysis
        on contest_ai_analysis.contest_id = contests.id
      order by contests.created_at desc
      limit 20
    `,
  );

  return result.rows;
}

export async function getAdminContestBySlug(slug: string) {
  const pool = getDbPool();
  const result = await pool.query<AdminContestRecordRow>(
    `
      select
        contests.id,
        contests.slug,
        contests.title,
        contests.organizer,
        contests.organizer_type,
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
        contests.submission_items,
        contests.judging_criteria,
        contests.stage_schedule,
        contests.past_winners,
        contests.tools_allowed,
        contests.dataset_provided,
        contests.dataset_summary,
        contests.ai_categories,
        contests.tags,
        contests.status,
        contests.created_at,
        contests.updated_at,
        contest_ai_analysis.analysis_status
      from public.contests
      left join public.contest_ai_analysis
        on contest_ai_analysis.contest_id = contests.id
      where contests.slug = $1
      limit 1
    `,
    [slug],
  );

  return result.rows[0] ? mapAdminContestRecord(result.rows[0]) : null;
}

export async function getAdminStats() {
  const pool = getDbPool();
  const result = await pool.query<
    QueryResultRow & {
      total: string;
      published: string;
      drafts: string;
      pending_analysis: string;
      failed_analysis: string;
    }
  >(
    `
      select
        count(*)::text as total,
        count(*) filter (where status = 'published')::text as published,
        count(*) filter (where status = 'draft')::text as drafts,
        count(*) filter (where exists (
          select 1
          from public.contest_ai_analysis
          where contest_ai_analysis.contest_id = contests.id
            and contest_ai_analysis.analysis_status = 'pending'
        ))::text as pending_analysis,
        count(*) filter (where exists (
          select 1
          from public.contest_ai_analysis
          where contest_ai_analysis.contest_id = contests.id
            and contest_ai_analysis.analysis_status = 'failed'
        ))::text as failed_analysis
      from public.contests
    `,
  );

  return result.rows[0];
}
