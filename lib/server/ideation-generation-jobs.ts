import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type {
  ContestDecisionMatrixPreset,
  ContestDecisionMatrixWeights,
  ContestIdeationJobKind,
  ContestIdeationJobResponse,
  ContestIdeationJobSnapshot,
  ContestIdeationSession,
} from "@/types/contest";

import { getContestBySlug } from "@/lib/queries";

import { saveContestHow, saveContestMatrix, saveContestWhat, saveContestWhy } from "./contest-ideation";
import { getDbPool } from "./db";
import { popQueueItem, pushQueueItem } from "./upstash-redis";

type IdeationJobInput =
  | {
      slug: string;
      userId: string;
      kind: "dream_to_ideas";
      selectedCandidateId: string;
      editedText?: string | null;
    }
  | {
      slug: string;
      userId: string;
      kind: "ideas_to_final";
      votes: Array<{
        candidateId: string;
        voteState: "liked" | "skipped" | "neutral";
      }>;
      customIdeas: Array<{
        title: string;
        description: string;
        pros: string[];
        cons: string[];
        fitReason: string;
      }>;
      userIdeaSeed?: string | null;
      preset: ContestDecisionMatrixPreset;
      weights: ContestDecisionMatrixWeights;
    }
  | {
      slug: string;
      userId: string;
      kind: "matrix_refresh";
      preset: ContestDecisionMatrixPreset;
      weights: ContestDecisionMatrixWeights;
    };

type IdeationJobRow = {
  id: string;
  contest_id: string;
  status: ContestIdeationJobSnapshot["status"];
  input_hash: string;
  input_json: IdeationJobInput;
  result_json: ContestIdeationSession | null;
  error_message: string | null;
  progress_label: string | null;
  request_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
};

const IDEATION_JOB_TYPE = "ideation_step";
const IDEATION_QUEUE_KEY = "ai-generation:ideation-step";
const IDEATION_JOB_TTL_SECONDS = 15 * 60;

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeIdeationJob(row: IdeationJobRow): ContestIdeationJobSnapshot {
  return {
    id: row.id,
    kind: row.input_json.kind,
    status: row.status,
    progressLabel: row.progress_label,
    errorMessage: row.error_message,
    session: row.result_json,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    startedAt: toIsoString(row.started_at),
    completedAt: toIsoString(row.completed_at),
  };
}

function buildInputHash(input: IdeationJobInput) {
  return createHash("sha256")
    .update(JSON.stringify({ version: 1, ...input }))
    .digest("hex");
}

function isReusableJob(row: IdeationJobRow, includeCompleted: boolean) {
  if (row.status === "queued" || row.status === "running") {
    return true;
  }

  if (!includeCompleted || row.status !== "completed") {
    return false;
  }

  const createdAt = new Date(row.created_at).getTime();
  return Date.now() - createdAt <= IDEATION_JOB_TTL_SECONDS * 1000;
}

export async function findReusableIdeationJob(input: IdeationJobInput, contestId?: string) {
  const pool = getDbPool();
  const result = await pool.query<IdeationJobRow>(
    `
      select
        id,
        contest_id,
        status,
        input_hash,
        input_json,
        result_json,
        error_message,
        progress_label,
        request_id,
        created_at,
        updated_at,
        started_at,
        completed_at
      from public.ai_generation_jobs
      where job_type = $1
        and input_hash = $2
        and ($3::uuid is null or contest_id = $3::uuid)
      order by created_at desc
      limit 5
    `,
    [IDEATION_JOB_TYPE, buildInputHash(input), contestId ?? null],
  );

  const row = result.rows.find((candidate) => isReusableJob(candidate, true));
  return row ? normalizeIdeationJob(row) : null;
}

export async function createIdeationJob(input: IdeationJobInput, requestId?: string | null) {
  const contest = await getContestBySlug(input.slug);

  if (!contest) {
    throw new Error("대회를 찾을 수 없습니다.");
  }

  const pool = getDbPool();
  const result = await pool.query<IdeationJobRow>(
    `
      insert into public.ai_generation_jobs (
        contest_id,
        job_type,
        status,
        input_hash,
        input_json,
        progress_label,
        request_id
      )
      values ($1, $2, 'queued', $3, $4::jsonb, $5, $6)
      returning
        id,
        contest_id,
        status,
        input_hash,
        input_json,
        result_json,
        error_message,
        progress_label,
        request_id,
        created_at,
        updated_at,
        started_at,
        completed_at
    `,
    [
      contest.id,
      IDEATION_JOB_TYPE,
      buildInputHash(input),
      JSON.stringify(input),
      input.kind === "dream_to_ideas" ? "아이디어 방향을 만들 준비를 하고 있어요" : "추천 순위를 만들 준비를 하고 있어요",
      requestId ?? randomUUID(),
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("브레인스토밍 job을 만들지 못했습니다.");
  }

  await pushQueueItem(IDEATION_QUEUE_KEY, row.id);
  return normalizeIdeationJob(row);
}

export async function getIdeationJobById(jobId: string, contestId?: string) {
  const pool = getDbPool();
  const result = await pool.query<IdeationJobRow>(
    `
      select
        id,
        contest_id,
        status,
        input_hash,
        input_json,
        result_json,
        error_message,
        progress_label,
        request_id,
        created_at,
        updated_at,
        started_at,
        completed_at
      from public.ai_generation_jobs
      where id = $1
        and job_type = $2
        and ($3::uuid is null or contest_id = $3::uuid)
      limit 1
    `,
    [jobId, IDEATION_JOB_TYPE, contestId ?? null],
  );

  const row = result.rows[0];
  return row ? normalizeIdeationJob(row) : null;
}

async function updateIdeationJob(jobId: string, values: Record<string, unknown>) {
  const pool = getDbPool();
  const entries = Object.entries(values);

  if (!entries.length) {
    return;
  }

  const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
  await pool.query(
    `
      update public.ai_generation_jobs
      set ${assignments.join(", ")}
      where id = $1
        and job_type = $${entries.length + 2}
    `,
    [jobId, ...entries.map(([, value]) => value), IDEATION_JOB_TYPE],
  );
}

async function claimIdeationJob(jobId?: string | null) {
  const pool = getDbPool();

  if (jobId) {
    const result = await pool.query<IdeationJobRow>(
      `
        update public.ai_generation_jobs
        set
          status = 'running',
          started_at = coalesce(started_at, timezone('utc', now())),
          attempt_count = attempt_count + 1,
          progress_label = '브레인스토밍을 이어서 만들고 있어요'
        where id = $1
          and job_type = $2
          and status = 'queued'
        returning
          id,
          contest_id,
          status,
          input_hash,
          input_json,
          result_json,
          error_message,
          progress_label,
          request_id,
          created_at,
          updated_at,
          started_at,
          completed_at
      `,
      [jobId, IDEATION_JOB_TYPE],
    );

    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  const fallback = await pool.query<IdeationJobRow>(
    `
      with next_job as (
        select id
        from public.ai_generation_jobs
        where job_type = $1
          and status = 'queued'
        order by created_at asc
        for update skip locked
        limit 1
      )
      update public.ai_generation_jobs
      set
        status = 'running',
        started_at = coalesce(started_at, timezone('utc', now())),
        attempt_count = attempt_count + 1,
        progress_label = '브레인스토밍을 이어서 만들고 있어요'
      where id in (select id from next_job)
      returning
        id,
        contest_id,
        status,
        input_hash,
        input_json,
        result_json,
        error_message,
        progress_label,
        request_id,
        created_at,
        updated_at,
        started_at,
        completed_at
    `,
    [IDEATION_JOB_TYPE],
  );

  return fallback.rows[0] ?? null;
}

async function completeIdeationJob(jobId: string, session: ContestIdeationSession) {
  await updateIdeationJob(jobId, {
    status: "completed",
    result_json: JSON.stringify(session),
    error_message: null,
    progress_label: "브레인스토밍 단계가 준비됐어요",
    completed_at: new Date().toISOString(),
  });
}

async function failIdeationJob(jobId: string, errorMessage: string) {
  await updateIdeationJob(jobId, {
    status: "failed",
    error_message: errorMessage,
    progress_label: "브레인스토밍 단계 생성에 실패했어요",
    completed_at: new Date().toISOString(),
  });
}

export async function updateIdeationJobProgress(jobId: string, progressLabel: string) {
  await updateIdeationJob(jobId, {
    progress_label: progressLabel,
  });
}

async function processIdeationJob(row: IdeationJobRow) {
  const input = row.input_json;
  const contest = await getContestBySlug(input.slug);

  if (!contest) {
    await failIdeationJob(row.id, "대회를 찾을 수 없습니다.");
    return false;
  }

  try {
    if (input.kind === "dream_to_ideas") {
      await updateIdeationJobProgress(row.id, "방향에 맞는 접근법을 정리하고 있어요");
      const whySession = await saveContestWhy(contest, input.userId, {
        selectedCandidateId: input.selectedCandidateId,
        editedText: input.editedText,
      });

      const nextHow = whySession.howHypotheses[0];

      if (!nextHow) {
        throw new Error("다음 단계 아이디어 방향을 만들지 못했습니다.");
      }

      await updateIdeationJobProgress(row.id, "좋아한 방향으로 아이디어 카드를 뽑고 있어요");
      const whatSession = await saveContestHow(contest, input.userId, {
        selectedCandidateId: nextHow.id,
        editedText: nextHow.body,
      });

      await completeIdeationJob(row.id, whatSession);
      return true;
    }

    if (input.kind === "ideas_to_final") {
      await updateIdeationJobProgress(row.id, "선택한 카드와 메모를 기준으로 아이디어를 정리하고 있어요");
      await saveContestWhat(contest, input.userId, {
        votes: input.votes,
        customIdeas: input.customIdeas,
        userIdeaSeed: input.userIdeaSeed,
      });

      await updateIdeationJobProgress(row.id, "추천 순위와 한 줄 이유를 계산하고 있어요");
      const matrixSession = await saveContestMatrix(contest, input.userId, {
        preset: input.preset,
        weights: input.weights,
      });

      await completeIdeationJob(row.id, matrixSession);
      return true;
    }

    await updateIdeationJobProgress(row.id, "선택한 기준으로 추천 순위를 다시 계산하고 있어요");
    const matrixSession = await saveContestMatrix(contest, input.userId, {
      preset: input.preset,
      weights: input.weights,
    });

    await completeIdeationJob(row.id, matrixSession);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "브레인스토밍 생성 중 알 수 없는 오류가 발생했습니다.";
    await failIdeationJob(row.id, message);
    return false;
  }
}

export async function drainIdeationJobs(options?: {
  preferredJobId?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(options?.limit ?? 1, 10));
  let processed = 0;
  let preferredJobId = options?.preferredJobId ?? null;

  while (processed < limit) {
    const queuedJobId = preferredJobId ?? (await popQueueItem(IDEATION_QUEUE_KEY));
    preferredJobId = null;

    const claimed = await claimIdeationJob(queuedJobId);

    if (!claimed) {
      if (queuedJobId) {
        continue;
      }

      break;
    }

    await processIdeationJob(claimed);
    processed += 1;
  }

  return processed;
}

export type { IdeationJobInput };
