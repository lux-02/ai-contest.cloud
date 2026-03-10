import "server-only";

import type { PoolClient, QueryResultRow } from "pg";

import {
  buildMatrixSummary,
  calculateContestIdeationProgress,
  clampMatrixWeights,
  enrichMatrixRows,
  getDefaultMatrixWeights,
  getRecommendedMatrixPreset,
} from "@/lib/contest-ideation";
import { getDbPool } from "@/lib/server/db";
import { getStoredStrategyReport, getStoredStrategySources } from "@/lib/server/contest-strategy-report-store";
import { canUseRemoteContestIdeationService, generateContestIdeationWithRemoteService } from "@/lib/server/contest-ideation-service";
import type {
  Contest,
  ContestDecisionMatrixPreset,
  ContestDecisionMatrixScore,
  ContestDecisionMatrixWeights,
  ContestHowHypothesis,
  ContestIdeaCandidate,
  ContestIdeationSession,
  ContestIdeationStage,
  ContestIdeationStatus,
  ContestTeamHandoff,
  ContestWhyOption,
} from "@/types/contest";

type SessionRow = QueryResultRow & {
  id: string;
  contest_id: string;
  user_id: string;
  status: ContestIdeationStatus;
  current_stage: ContestIdeationStage;
  strategy_reviewed_at: string | null;
  selected_why: string | null;
  selected_how: string | null;
  why_edited_text: string | null;
  how_edited_text: string | null;
  user_idea_seed: string | null;
  selected_idea_id: string | null;
  selected_matrix_preset: ContestDecisionMatrixPreset | null;
  matrix_weights_json: unknown;
  progress_json: unknown;
  updated_at: string | null;
};

type CandidateRow = QueryResultRow & {
  id: string;
  session_id: string;
  stage: "why" | "how" | "what";
  title: string;
  body: string;
  pros_json: unknown;
  cons_json: unknown;
  fit_reason: string | null;
  extra_json: unknown;
  source: "ai" | "user";
  vote_state: "liked" | "skipped" | "neutral";
  is_selected: boolean;
  matrix_scores_json: unknown;
  display_order: number;
};

type UpsertSessionInput = {
  status?: ContestIdeationStatus;
  currentStage?: ContestIdeationStage;
  strategyReviewedAt?: string | null;
  selectedWhy?: string | null;
  selectedHow?: string | null;
  whyEditedText?: string | null;
  howEditedText?: string | null;
  userIdeaSeed?: string | null;
  selectedIdeaId?: string | null;
  selectedMatrixPreset?: ContestDecisionMatrixPreset | null;
  matrixWeights?: ContestDecisionMatrixWeights;
  teamProgress?: number;
};

type InsertCandidateInput = {
  id?: string;
  stage: "why" | "how" | "what";
  title: string;
  body: string;
  pros?: string[];
  cons?: string[];
  fitReason?: string | null;
  extra?: Record<string, unknown>;
  source?: "ai" | "user";
  voteState?: "liked" | "skipped" | "neutral";
  isSelected?: boolean;
  matrixScores?: ContestDecisionMatrixScore | null;
  displayOrder?: number;
};

function parseStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as T;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {}
  }

  return fallback;
}

function parseWeights(value: unknown, fallbackPreset: ContestDecisionMatrixPreset) {
  const parsed = parseObject<Record<string, unknown>>(value, {});
  const defaults = getDefaultMatrixWeights(fallbackPreset);

  return {
    impact: Number(parsed.impact ?? defaults.impact),
    feasibility: Number(parsed.feasibility ?? defaults.feasibility),
    alignment: Number(parsed.alignment ?? defaults.alignment),
    speed: Number(parsed.speed ?? defaults.speed),
  } satisfies ContestDecisionMatrixWeights;
}

function parseProgress(value: unknown) {
  return parseObject<Record<string, unknown>>(value, {
    strategy: 0,
    ideation: 0,
    team: 0,
  });
}

function parseMatrixScores(value: unknown) {
  const parsed = parseObject<Record<string, unknown>>(value, {});

  if (Object.keys(parsed).length === 0) {
    return undefined;
  }

  return {
    impact: Number(parsed.impact ?? 0),
    feasibility: Number(parsed.feasibility ?? 0),
    alignment: Number(parsed.alignment ?? 0),
    speed: Number(parsed.speed ?? 0),
    total: Number(parsed.total ?? 0),
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  } satisfies ContestDecisionMatrixScore;
}

function mapWhyOptions(rows: CandidateRow[]) {
  return rows
    .filter((row) => row.stage === "why")
    .sort((left, right) => left.display_order - right.display_order)
    .map(
      (row) =>
        ({
          id: row.id,
          title: row.title,
          body: row.body,
          source: row.source,
          isSelected: row.is_selected,
          displayOrder: row.display_order,
        }) satisfies ContestWhyOption,
    );
}

function mapHowHypotheses(rows: CandidateRow[]) {
  return rows
    .filter((row) => row.stage === "how")
    .sort((left, right) => left.display_order - right.display_order)
    .map((row) => {
      const extra = parseObject<Record<string, unknown>>(row.extra_json, {});

      return {
        id: row.id,
        title: row.title,
        body: row.body,
        impactTarget: typeof extra.impactTarget === "string" ? extra.impactTarget : "",
        judgeAppeal: typeof extra.judgeAppeal === "string" ? extra.judgeAppeal : "",
        measurableOutcome: typeof extra.measurableOutcome === "string" ? extra.measurableOutcome : "",
        source: row.source,
        isSelected: row.is_selected,
        displayOrder: row.display_order,
      } satisfies ContestHowHypothesis;
    });
}

function mapIdeaCandidates(rows: CandidateRow[]) {
  return rows
    .filter((row) => row.stage === "what")
    .sort((left, right) => left.display_order - right.display_order)
    .map(
      (row) =>
        ({
          id: row.id,
          title: row.title,
          description: row.body,
          pros: parseStringArray(row.pros_json),
          cons: parseStringArray(row.cons_json),
          fitReason: row.fit_reason ?? "",
          source: row.source,
          voteState: row.vote_state,
          isSelected: row.is_selected,
          matrixScores: parseMatrixScores(row.matrix_scores_json),
          displayOrder: row.display_order,
        }) satisfies ContestIdeaCandidate,
    );
}

function buildSessionSnapshot(contest: Contest, row: SessionRow, candidateRows: CandidateRow[]): ContestIdeationSession {
  const recommendedPreset = getRecommendedMatrixPreset(contest);
  const matrixWeights = clampMatrixWeights(recommendedPreset, parseWeights(row.matrix_weights_json, recommendedPreset));
  const whyOptions = mapWhyOptions(candidateRows);
  const howHypotheses = mapHowHypotheses(candidateRows);
  const ideaCandidates = mapIdeaCandidates(candidateRows);
  const storedProgress = parseProgress(row.progress_json);
  const progress = calculateContestIdeationProgress(
    row.status,
    row.current_stage,
    row.strategy_reviewed_at,
    Number(storedProgress.team ?? 0),
  );
  const matrixRows = enrichMatrixRows(ideaCandidates, matrixWeights);

  return {
    id: row.id,
    contestId: row.contest_id,
    userId: row.user_id,
    status: row.status,
    currentStage: row.current_stage,
    strategyReviewedAt: row.strategy_reviewed_at,
    selectedWhy: row.selected_why,
    selectedHow: row.selected_how,
    whyEditedText: row.why_edited_text,
    howEditedText: row.how_edited_text,
    userIdeaSeed: row.user_idea_seed,
    selectedIdeaId: row.selected_idea_id,
    selectedMatrixPreset: row.selected_matrix_preset,
    recommendedMatrixPreset: recommendedPreset,
    matrixWeights,
    progress,
    whyOptions,
    selectedWhyId: whyOptions.find((option) => option.isSelected)?.id ?? null,
    howHypotheses,
    selectedHowId: howHypotheses.find((hypothesis) => hypothesis.isSelected)?.id ?? null,
    ideaCandidates,
    matrixRows,
    topRecommendations: matrixRows.slice(0, 3),
    matrixSummary: buildMatrixSummary({
      id: row.id,
      contestId: row.contest_id,
      userId: row.user_id,
      status: row.status,
      currentStage: row.current_stage,
      strategyReviewedAt: row.strategy_reviewed_at,
      selectedWhy: row.selected_why,
      selectedHow: row.selected_how,
      whyEditedText: row.why_edited_text,
      howEditedText: row.how_edited_text,
      userIdeaSeed: row.user_idea_seed,
      selectedIdeaId: row.selected_idea_id,
      selectedMatrixPreset: row.selected_matrix_preset,
      recommendedMatrixPreset: recommendedPreset,
      matrixWeights,
      progress,
      whyOptions,
      selectedWhyId: whyOptions.find((option) => option.isSelected)?.id ?? null,
      howHypotheses,
      selectedHowId: howHypotheses.find((hypothesis) => hypothesis.isSelected)?.id ?? null,
      ideaCandidates,
      matrixRows,
      topRecommendations: matrixRows.slice(0, 3),
      updatedAt: row.updated_at,
    }),
    updatedAt: row.updated_at,
  };
}

async function getSessionRow(client: PoolClient, contestId: string, userId: string) {
  const sessionResult = await client.query<SessionRow>(
    `
      select *
      from public.contest_ideation_sessions
      where contest_id = $1
        and user_id = $2
      limit 1
    `,
    [contestId, userId],
  );

  return sessionResult.rows[0] ?? null;
}

async function getCandidateRows(client: PoolClient, sessionId: string) {
  const candidateResult = await client.query<CandidateRow>(
    `
      select *
      from public.contest_ideation_candidates
      where session_id = $1
      order by stage asc, display_order asc, created_at asc
    `,
    [sessionId],
  );

  return candidateResult.rows;
}

async function safeRollback(client: PoolClient) {
  try {
    await safeRollback(client);
  } catch {}
}

function serializeProgress(row: SessionRow | null, values: UpsertSessionInput) {
  const status = values.status ?? row?.status ?? "draft";
  const currentStage = values.currentStage ?? row?.current_stage ?? "strategy";
  const strategyReviewedAt =
    values.strategyReviewedAt !== undefined ? values.strategyReviewedAt : row?.strategy_reviewed_at ?? null;
  const previousProgress = parseProgress(row?.progress_json);
  const teamProgress = values.teamProgress ?? Number(previousProgress.team ?? 0);

  return JSON.stringify(calculateContestIdeationProgress(status, currentStage, strategyReviewedAt, teamProgress));
}

async function upsertSessionRow(
  client: PoolClient,
  contest: Contest,
  userId: string,
  values: UpsertSessionInput,
) {
  const existing = await getSessionRow(client, contest.id, userId);
  const recommendedPreset = getRecommendedMatrixPreset(contest);
  const matrixWeights = values.matrixWeights ?? parseWeights(existing?.matrix_weights_json, recommendedPreset);
  const status = values.status ?? existing?.status ?? "draft";
  const currentStage = values.currentStage ?? existing?.current_stage ?? "strategy";
  const strategyReviewedAt =
    values.strategyReviewedAt !== undefined ? values.strategyReviewedAt : existing?.strategy_reviewed_at ?? null;

  const result = await client.query<SessionRow>(
    `
      insert into public.contest_ideation_sessions (
        contest_id,
        user_id,
        status,
        current_stage,
        strategy_reviewed_at,
        selected_why,
        selected_how,
        why_edited_text,
        how_edited_text,
        user_idea_seed,
        selected_idea_id,
        selected_matrix_preset,
        matrix_weights_json,
        progress_json
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
      on conflict (user_id, contest_id) do update
      set
        status = excluded.status,
        current_stage = excluded.current_stage,
        strategy_reviewed_at = excluded.strategy_reviewed_at,
        selected_why = excluded.selected_why,
        selected_how = excluded.selected_how,
        why_edited_text = excluded.why_edited_text,
        how_edited_text = excluded.how_edited_text,
        user_idea_seed = excluded.user_idea_seed,
        selected_idea_id = excluded.selected_idea_id,
        selected_matrix_preset = excluded.selected_matrix_preset,
        matrix_weights_json = excluded.matrix_weights_json,
        progress_json = excluded.progress_json
      returning *
    `,
    [
      contest.id,
      userId,
      status,
      currentStage,
      strategyReviewedAt,
      values.selectedWhy !== undefined ? values.selectedWhy : existing?.selected_why ?? null,
      values.selectedHow !== undefined ? values.selectedHow : existing?.selected_how ?? null,
      values.whyEditedText !== undefined ? values.whyEditedText : existing?.why_edited_text ?? null,
      values.howEditedText !== undefined ? values.howEditedText : existing?.how_edited_text ?? null,
      values.userIdeaSeed !== undefined ? values.userIdeaSeed : existing?.user_idea_seed ?? null,
      values.selectedIdeaId !== undefined ? values.selectedIdeaId : existing?.selected_idea_id ?? null,
      values.selectedMatrixPreset !== undefined
        ? values.selectedMatrixPreset
        : existing?.selected_matrix_preset ?? recommendedPreset,
      JSON.stringify(matrixWeights),
      serializeProgress(existing, {
        ...values,
        status,
        currentStage,
        strategyReviewedAt,
        matrixWeights,
      }),
    ],
  );

  return result.rows[0];
}

async function replaceStageCandidates(client: PoolClient, sessionId: string, stage: "why" | "how" | "what", rows: InsertCandidateInput[]) {
  await client.query("delete from public.contest_ideation_candidates where session_id = $1 and stage = $2", [sessionId, stage]);

  for (const [index, row] of rows.entries()) {
    await client.query(
      `
        insert into public.contest_ideation_candidates (
          id,
          session_id,
          stage,
          title,
          body,
          pros_json,
          cons_json,
          fit_reason,
          extra_json,
          source,
          vote_state,
          is_selected,
          matrix_scores_json,
          display_order
        )
        values (
          coalesce($1::uuid, gen_random_uuid()),
          $2,
          $3,
          $4,
          $5,
          $6::jsonb,
          $7::jsonb,
          $8,
          $9::jsonb,
          $10,
          $11,
          $12,
          $13::jsonb,
          $14
        )
      `,
      [
        row.id ?? null,
        sessionId,
        stage,
        row.title,
        row.body,
        JSON.stringify(row.pros ?? []),
        JSON.stringify(row.cons ?? []),
        row.fitReason ?? null,
        JSON.stringify(row.extra ?? {}),
        row.source ?? "ai",
        row.voteState ?? "neutral",
        row.isSelected ?? false,
        row.matrixScores ? JSON.stringify(row.matrixScores) : null,
        row.displayOrder ?? index,
      ],
    );
  }
}

async function resetCandidateSelections(client: PoolClient, sessionId: string, stage: "why" | "how" | "what") {
  await client.query(
    `
      update public.contest_ideation_candidates
      set is_selected = false
      where session_id = $1
        and stage = $2
    `,
    [sessionId, stage],
  );
}

async function deleteLaterStageCandidates(client: PoolClient, sessionId: string, stages: Array<"how" | "what">) {
  await client.query(
    `
      delete from public.contest_ideation_candidates
      where session_id = $1
        and stage = any($2::public.contest_ideation_candidate_stage[])
    `,
    [sessionId, stages],
  );
}

async function updateCandidateSelected(client: PoolClient, sessionId: string, stage: "why" | "how" | "what", candidateId: string) {
  await resetCandidateSelections(client, sessionId, stage);
  await client.query(
    `
      update public.contest_ideation_candidates
      set is_selected = true
      where session_id = $1
        and stage = $2
        and id = $3
    `,
    [sessionId, stage, candidateId],
  );
}

async function updateWhatVotes(
  client: PoolClient,
  sessionId: string,
  votes: Array<{ candidateId: string; voteState: "liked" | "skipped" | "neutral" }>,
) {
  for (const vote of votes) {
    await client.query(
      `
        update public.contest_ideation_candidates
        set vote_state = $3
        where session_id = $1
          and stage = 'what'
          and id = $2
      `,
      [sessionId, vote.candidateId, vote.voteState],
    );
  }
}

async function replaceUserCustomIdeas(
  client: PoolClient,
  sessionId: string,
  customIdeas: Array<{
    title: string;
    description: string;
    pros: string[];
    cons: string[];
    fitReason: string;
  }>,
) {
  await client.query(
    `
      delete from public.contest_ideation_candidates
      where session_id = $1
        and stage = 'what'
        and source = 'user'
    `,
    [sessionId],
  );

  if (customIdeas.length === 0) {
    return;
  }

  const existingResult = await client.query<{ max_order: number | null }>(
    `
      select max(display_order) as max_order
      from public.contest_ideation_candidates
      where session_id = $1
        and stage = 'what'
    `,
    [sessionId],
  );
  const startOrder = (existingResult.rows[0]?.max_order ?? -1) + 1;

  for (const [index, idea] of customIdeas.entries()) {
    await client.query(
      `
        insert into public.contest_ideation_candidates (
          session_id,
          stage,
          title,
          body,
          pros_json,
          cons_json,
          fit_reason,
          source,
          vote_state,
          display_order
        )
        values ($1, 'what', $2, $3, $4::jsonb, $5::jsonb, $6, 'user', 'liked', $7)
      `,
      [sessionId, idea.title, idea.description, JSON.stringify(idea.pros), JSON.stringify(idea.cons), idea.fitReason, startOrder + index],
    );
  }
}

function buildStrategySummary(contest: Contest, strategyReport: Awaited<ReturnType<typeof getStoredStrategyReport>> | null) {
  return [
    contest.analysis.recommendReason,
    contest.analysis.summary,
    contest.analysis.winStrategy,
    contest.analysis.difficultyAnalysis,
    strategyReport?.overview,
    strategyReport?.recommendedDirection,
    strategyReport?.draftSubtitle,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n\n");
}

function buildRemoteSessionContext(session: ContestIdeationSession | null, sourceSnippets: string[]) {
  return {
    selectedWhy: session?.selectedWhy ?? null,
    selectedHow: session?.selectedHow ?? null,
    whyEditedText: session?.whyEditedText ?? null,
    howEditedText: session?.howEditedText ?? null,
    userIdeaSeed: session?.userIdeaSeed ?? null,
    ideaCandidates: session?.ideaCandidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      description: candidate.description,
      pros: candidate.pros,
      cons: candidate.cons,
      fitReason: candidate.fitReason,
      source: candidate.source,
      voteState: candidate.voteState,
    })),
    supportingSources: sourceSnippets,
  };
}

async function generateForStep(
  contest: Contest,
  step: "why" | "how" | "what" | "matrix",
  session: ContestIdeationSession | null,
  userInput?: string | null,
  matrixWeights?: ContestDecisionMatrixWeights,
) {
  if (!canUseRemoteContestIdeationService()) {
    throw new Error("브레인스토밍용 AI 서버가 아직 연결되지 않았습니다.");
  }

  const [strategyReport, strategySources] = await Promise.all([
    getStoredStrategyReport(contest.id),
    getStoredStrategySources(contest.id),
  ]);

  return generateContestIdeationWithRemoteService({
    contest,
    strategySummary: buildStrategySummary(contest, strategyReport),
    step,
    sessionContext: buildRemoteSessionContext(
      session,
      strategySources.map((source) => `${source.title}: ${source.snippet}`),
    ),
    userInput,
    matrixWeights,
  });
}

async function readSnapshot(client: PoolClient, contest: Contest, userId: string) {
  const row = await getSessionRow(client, contest.id, userId);

  if (!row) {
    return null;
  }

  const candidates = await getCandidateRows(client, row.id);
  return buildSessionSnapshot(contest, row, candidates);
}

export async function getContestIdeationSession(contest: Contest, userId: string) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    return await readSnapshot(client, contest, userId);
  } finally {
    client.release();
  }
}

export async function startContestIdeation(contest: Contest, userId: string) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    let row = await upsertSessionRow(client, contest, userId, {
      currentStage: "why",
      status: "draft",
      strategyReviewedAt: new Date().toISOString(),
      selectedIdeaId: null,
      selectedMatrixPreset: getRecommendedMatrixPreset(contest),
      matrixWeights: getDefaultMatrixWeights(getRecommendedMatrixPreset(contest)),
    });

    const existingCandidates = await getCandidateRows(client, row.id);
    const hasWhyOptions = existingCandidates.some((candidate) => candidate.stage === "why");

    if (!hasWhyOptions) {
      await client.query("commit");
      const initialSession = await getContestIdeationSession(contest, userId);
      const generated = await generateForStep(contest, "why", initialSession, null, undefined);

      await client.query("begin");
      row = await upsertSessionRow(client, contest, userId, {
        currentStage: "why",
        status: "draft",
        strategyReviewedAt: row.strategy_reviewed_at ?? new Date().toISOString(),
      });

      await replaceStageCandidates(
        client,
        row.id,
        "why",
        generated.whyOptions.map((option) => ({
          stage: "why",
          title: option.title,
          body: option.body,
          source: option.source,
          displayOrder: option.displayOrder,
        })),
      );
    }

    const snapshot = await readSnapshot(client, contest, userId);
    await client.query("commit");

    if (!snapshot) {
      throw new Error("브레인스토밍 세션을 시작하지 못했습니다.");
    }

    return snapshot;
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveContestWhy(contest: Contest, userId: string, input: { selectedCandidateId: string; editedText?: string | null }) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const existing = await readSnapshot(client, contest, userId);

    if (!existing) {
      throw new Error("브레인스토밍 세션이 없습니다.");
    }

    const selectedOption = existing.whyOptions.find((option) => option.id === input.selectedCandidateId);

    if (!selectedOption) {
      throw new Error("선택한 WHY를 찾을 수 없습니다.");
    }

    const editedText = input.editedText?.trim() || selectedOption.body;

    await updateCandidateSelected(client, existing.id, "why", input.selectedCandidateId);
    await deleteLaterStageCandidates(client, existing.id, ["how", "what"]);
    await upsertSessionRow(client, contest, userId, {
      status: "draft",
      currentStage: "how",
      selectedWhy: editedText,
      whyEditedText: input.editedText?.trim() || null,
      selectedHow: null,
      howEditedText: null,
      selectedIdeaId: null,
      teamProgress: 0,
    });
    await client.query("commit");

    const refreshed = await getContestIdeationSession(contest, userId);
    const generated = await generateForStep(contest, "how", refreshed, editedText, undefined);

    await client.query("begin");
    const row = await upsertSessionRow(client, contest, userId, {
      status: "draft",
      currentStage: "how",
      selectedWhy: editedText,
      whyEditedText: input.editedText?.trim() || null,
      selectedHow: null,
      howEditedText: null,
      selectedIdeaId: null,
      teamProgress: 0,
    });
    await replaceStageCandidates(
      client,
      row.id,
      "how",
      generated.howHypotheses.map((hypothesis) => ({
        stage: "how",
        title: hypothesis.title,
        body: hypothesis.body,
        extra: {
          impactTarget: hypothesis.impactTarget,
          judgeAppeal: hypothesis.judgeAppeal,
          measurableOutcome: hypothesis.measurableOutcome,
        },
        source: hypothesis.source,
        displayOrder: hypothesis.displayOrder,
      })),
    );

    const snapshot = await readSnapshot(client, contest, userId);
    await client.query("commit");

    if (!snapshot) {
      throw new Error("HOW 후보를 저장하지 못했습니다.");
    }

    return snapshot;
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveContestHow(contest: Contest, userId: string, input: { selectedCandidateId: string; editedText?: string | null }) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const existing = await readSnapshot(client, contest, userId);

    if (!existing) {
      throw new Error("브레인스토밍 세션이 없습니다.");
    }

    const selectedHypothesis = existing.howHypotheses.find((hypothesis) => hypothesis.id === input.selectedCandidateId);

    if (!selectedHypothesis) {
      throw new Error("선택한 HOW 가설을 찾을 수 없습니다.");
    }

    const editedText = input.editedText?.trim() || selectedHypothesis.body;

    await updateCandidateSelected(client, existing.id, "how", input.selectedCandidateId);
    await deleteLaterStageCandidates(client, existing.id, ["what"]);
    await upsertSessionRow(client, contest, userId, {
      status: "draft",
      currentStage: "what",
      selectedHow: editedText,
      howEditedText: input.editedText?.trim() || null,
      selectedIdeaId: null,
      teamProgress: 0,
    });
    await client.query("commit");

    const refreshed = await getContestIdeationSession(contest, userId);
    const generated = await generateForStep(contest, "what", refreshed, editedText, undefined);

    await client.query("begin");
    const row = await upsertSessionRow(client, contest, userId, {
      status: "draft",
      currentStage: "what",
      selectedHow: editedText,
      howEditedText: input.editedText?.trim() || null,
      selectedIdeaId: null,
      teamProgress: 0,
    });
    await replaceStageCandidates(
      client,
      row.id,
      "what",
      generated.ideaCandidates.map((idea) => ({
        stage: "what",
        title: idea.title,
        body: idea.description,
        pros: idea.pros,
        cons: idea.cons,
        fitReason: idea.fitReason,
        source: idea.source,
        voteState: idea.voteState,
        displayOrder: idea.displayOrder,
      })),
    );

    const snapshot = await readSnapshot(client, contest, userId);
    await client.query("commit");

    if (!snapshot) {
      throw new Error("WHAT 후보를 저장하지 못했습니다.");
    }

    return snapshot;
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveContestWhat(
  contest: Contest,
  userId: string,
  input: {
    votes: Array<{ candidateId: string; voteState: "liked" | "skipped" | "neutral" }>;
    customIdeas: Array<{
      title: string;
      description: string;
      pros: string[];
      cons: string[];
      fitReason: string;
    }>;
    userIdeaSeed?: string | null;
  },
) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const existing = await readSnapshot(client, contest, userId);

    if (!existing) {
      throw new Error("브레인스토밍 세션이 없습니다.");
    }

    await updateWhatVotes(client, existing.id, input.votes);
    await replaceUserCustomIdeas(client, existing.id, input.customIdeas);
    await resetCandidateSelections(client, existing.id, "what");
    await client.query(
      `
        update public.contest_ideation_candidates
        set matrix_scores_json = null
        where session_id = $1
          and stage = 'what'
      `,
      [existing.id],
    );
    await upsertSessionRow(client, contest, userId, {
      status: "draft",
      currentStage: "what",
      userIdeaSeed: input.userIdeaSeed?.trim() || existing.userIdeaSeed || null,
      selectedIdeaId: null,
      teamProgress: 0,
    });

    const snapshot = await readSnapshot(client, contest, userId);
    await client.query("commit");

    if (!snapshot) {
      throw new Error("아이디어 후보를 저장하지 못했습니다.");
    }

    return snapshot;
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveContestMatrix(
  contest: Contest,
  userId: string,
  input: {
    preset: ContestDecisionMatrixPreset;
    weights: ContestDecisionMatrixWeights;
  },
) {
  const normalizedWeights = clampMatrixWeights(input.preset, input.weights);
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const existing = await readSnapshot(client, contest, userId);

    if (!existing) {
      throw new Error("브레인스토밍 세션이 없습니다.");
    }

    const candidatesForMatrix = existing.ideaCandidates.filter((candidate) => candidate.voteState !== "skipped");
    const matrixCandidates = candidatesForMatrix.length > 0 ? candidatesForMatrix : existing.ideaCandidates;

    if (matrixCandidates.length === 0) {
      throw new Error("Decision Matrix에 넣을 아이디어가 없습니다.");
    }

    await upsertSessionRow(client, contest, userId, {
      status: "draft",
      currentStage: "matrix",
      selectedMatrixPreset: input.preset,
      matrixWeights: normalizedWeights,
      selectedIdeaId: null,
      teamProgress: 0,
    });
    await resetCandidateSelections(client, existing.id, "what");
    await client.query(
      `
        update public.contest_ideation_candidates
        set matrix_scores_json = null
        where session_id = $1
          and stage = 'what'
      `,
      [existing.id],
    );
    await client.query("commit");

    const refreshed = await getContestIdeationSession(contest, userId);
    const generated = await generateForStep(contest, "matrix", refreshed, null, normalizedWeights);

    await client.query("begin");
    await upsertSessionRow(client, contest, userId, {
      status: "draft",
      currentStage: "matrix",
      selectedMatrixPreset: input.preset,
      matrixWeights: normalizedWeights,
      selectedIdeaId: null,
      teamProgress: 0,
    });

    for (const row of generated.matrixRows) {
      await client.query(
        `
          update public.contest_ideation_candidates
          set matrix_scores_json = $3::jsonb
          where session_id = $1
            and stage = 'what'
            and id = $2
        `,
        [existing.id, row.candidateId, JSON.stringify(row.scores)],
      );
    }

    const snapshot = await readSnapshot(client, contest, userId);
    await client.query("commit");

    if (!snapshot) {
      throw new Error("Decision Matrix를 저장하지 못했습니다.");
    }

    return snapshot;
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

export async function selectContestIdea(contest: Contest, userId: string, input: { ideaId: string }) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const existing = await readSnapshot(client, contest, userId);

    if (!existing) {
      throw new Error("브레인스토밍 세션이 없습니다.");
    }

    const selectedIdea = existing.ideaCandidates.find((candidate) => candidate.id === input.ideaId);

    if (!selectedIdea) {
      throw new Error("확정할 아이디어를 찾을 수 없습니다.");
    }

    await updateCandidateSelected(client, existing.id, "what", input.ideaId);
    await upsertSessionRow(client, contest, userId, {
      status: "selected",
      currentStage: "selected",
      selectedIdeaId: input.ideaId,
      teamProgress: Number(existing.progress.team ?? 0),
    });

    const snapshot = await readSnapshot(client, contest, userId);
    await client.query("commit");

    if (!snapshot) {
      throw new Error("아이디어를 확정하지 못했습니다.");
    }

    return snapshot;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getContestTeamHandoff(contestId: string, sessionId: string, userId: string) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const sessionResult = await client.query<SessionRow>(
      `
        select *
        from public.contest_ideation_sessions
        where id = $1
          and contest_id = $2
          and user_id = $3
          and status = 'selected'
          and selected_idea_id is not null
        limit 1
      `,
      [sessionId, contestId, userId],
    );

    const row = sessionResult.rows[0];

    if (!row) {
      return null;
    }

    const candidateRows = await getCandidateRows(client, row.id);
    const contestResult = await client.query<{ id: string; title: string }>(
      `
        select id, title
        from public.contests
        where id = $1
        limit 1
      `,
      [contestId],
    );

    const contestTitle = contestResult.rows[0]?.title ?? "공모전";
    const ideaCandidates = mapIdeaCandidates(candidateRows);
    const selectedIdea = ideaCandidates.find((candidate) => candidate.id === row.selected_idea_id);
    const recommendedPreset = row.selected_matrix_preset ?? "balanced";
    const matrixRows = enrichMatrixRows(ideaCandidates, parseWeights(row.matrix_weights_json, recommendedPreset));

    if (!selectedIdea) {
      return null;
    }

    await client.query(
      `
        update public.contest_ideation_sessions
        set progress_json = $2::jsonb
        where id = $1
      `,
      [
        row.id,
        JSON.stringify(calculateContestIdeationProgress(row.status, row.current_stage, row.strategy_reviewed_at, 100)),
      ],
    );

    return {
      contestId,
      sessionId,
      why: row.selected_why ?? "",
      how: row.selected_how ?? "",
      ideaTitle: selectedIdea.title,
      ideaDescription: selectedIdea.description,
      matrixSummary:
        matrixRows.find((candidate) => candidate.id === row.selected_idea_id)?.matrixScores.reason ??
        "선택한 아이디어를 기준으로 팀 역할과 산출물을 정리하면 됩니다.",
      nextStep: "팀 역할을 나누고, 데모·기획서·제출 자료를 이번 아이디어 기준으로 분리하세요.",
    } satisfies ContestTeamHandoff;
  } finally {
    client.release();
  }
}
