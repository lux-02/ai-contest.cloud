import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { StrategyLabJobSnapshot, ContestStrategyLabResult } from "@/types/contest";

import { getContestBySlug } from "@/lib/queries";

import { getDbPool } from "./db";
import { runContestStrategyPipeline } from "./contest-strategy-pipeline";
import { popQueueItem, pushQueueItem } from "./upstash-redis";

type StrategyLabJobInput = {
  slug: string;
  userIdea?: string | null;
};

type StrategyJobStatus = StrategyLabJobSnapshot["status"];

type StrategyJobRow = {
  id: string;
  contest_id: string;
  status: StrategyJobStatus;
  input_hash: string;
  input_json: StrategyLabJobInput;
  result_json: ContestStrategyLabResult | null;
  error_message: string | null;
  progress_label: string | null;
  request_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
};

const STRATEGY_JOB_TYPE = "strategy_lab";
const STRATEGY_QUEUE_KEY = "ai-generation:strategy-lab";
const STRATEGY_REPORT_TTL_SECONDS = 6 * 60 * 60;
const STRATEGY_IDEA_TTL_SECONDS = 30 * 60;

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeJob(row: StrategyJobRow): StrategyLabJobSnapshot {
  return {
    id: row.id,
    status: row.status,
    progressLabel: row.progress_label,
    errorMessage: row.error_message,
    result: row.result_json,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    startedAt: toIsoString(row.started_at),
    completedAt: toIsoString(row.completed_at),
  };
}

function buildInputHash(input: StrategyLabJobInput) {
  return createHash("sha256")
    .update(JSON.stringify({ version: 1, slug: input.slug, userIdea: input.userIdea?.trim() || null }))
    .digest("hex");
}

function getReuseWindowSeconds(userIdea?: string | null) {
  return userIdea?.trim() ? STRATEGY_IDEA_TTL_SECONDS : STRATEGY_REPORT_TTL_SECONDS;
}

function isReusableJob(row: StrategyJobRow, maxAgeSeconds: number, includeCompleted: boolean) {
  if (row.status === "queued" || row.status === "running") {
    return true;
  }

  if (!includeCompleted || row.status !== "completed") {
    return false;
  }

  const createdAt = new Date(row.created_at).getTime();
  return Date.now() - createdAt <= maxAgeSeconds * 1000;
}

export async function findReusableStrategyLabJob(
  input: StrategyLabJobInput,
  options?: { includeCompleted?: boolean; contestId?: string },
) {
  const pool = getDbPool();
  const inputHash = buildInputHash(input);
  const result = await pool.query<StrategyJobRow>(
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
    [STRATEGY_JOB_TYPE, inputHash, options?.contestId ?? null],
  );

  const row = result.rows.find((candidate) =>
    isReusableJob(candidate, getReuseWindowSeconds(input.userIdea), options?.includeCompleted ?? true),
  );

  return row ? normalizeJob(row) : null;
}

export async function createStrategyLabJob(input: StrategyLabJobInput, requestId?: string | null) {
  const contest = await getContestBySlug(input.slug);

  if (!contest) {
    throw new Error("대회를 찾을 수 없습니다.");
  }

  const pool = getDbPool();
  const result = await pool.query<StrategyJobRow>(
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
      STRATEGY_JOB_TYPE,
      buildInputHash(input),
      JSON.stringify(input),
      "전략 리포트 대기열에 넣었어요",
      requestId ?? randomUUID(),
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("전략 생성 job을 만들지 못했습니다.");
  }

  await pushQueueItem(STRATEGY_QUEUE_KEY, row.id);
  return normalizeJob(row);
}

export async function getStrategyLabJobById(jobId: string, contestId?: string) {
  const pool = getDbPool();
  const result = await pool.query<StrategyJobRow>(
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
    [jobId, STRATEGY_JOB_TYPE, contestId ?? null],
  );

  const row = result.rows[0];
  return row ? normalizeJob(row) : null;
}

async function updateStrategyLabJob(jobId: string, values: Record<string, unknown>) {
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
    [jobId, ...entries.map(([, value]) => value), STRATEGY_JOB_TYPE],
  );
}

async function claimStrategyLabJob(jobId?: string | null) {
  const pool = getDbPool();

  if (jobId) {
    const result = await pool.query<StrategyJobRow>(
      `
        update public.ai_generation_jobs
        set
          status = 'running',
          started_at = coalesce(started_at, timezone('utc', now())),
          attempt_count = attempt_count + 1,
          progress_label = '전략 리포트를 만들고 있어요'
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
      [jobId, STRATEGY_JOB_TYPE],
    );

    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  const fallback = await pool.query<StrategyJobRow>(
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
        progress_label = '전략 리포트를 만들고 있어요'
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
    [STRATEGY_JOB_TYPE],
  );

  return fallback.rows[0] ?? null;
}

async function completeStrategyLabJob(jobId: string, result: ContestStrategyLabResult) {
  await updateStrategyLabJob(jobId, {
    status: "completed",
    result_json: result,
    error_message: null,
    progress_label: "전략 리포트 생성이 끝났어요",
    completed_at: new Date().toISOString(),
  });
}

async function failStrategyLabJob(jobId: string, errorMessage: string) {
  await updateStrategyLabJob(jobId, {
    status: "failed",
    error_message: errorMessage,
    progress_label: "전략 리포트 생성에 실패했어요",
    completed_at: new Date().toISOString(),
  });
}

export async function updateStrategyLabJobProgress(jobId: string, progressLabel: string) {
  await updateStrategyLabJob(jobId, {
    progress_label: progressLabel,
  });
}

async function processStrategyLabJob(row: StrategyJobRow) {
  const input = row.input_json;
  const contest = await getContestBySlug(input.slug);

  if (!contest) {
    await failStrategyLabJob(row.id, "대회를 찾을 수 없습니다.");
    return false;
  }

  try {
    const output = await runContestStrategyPipeline(contest, {
      userIdea: input.userIdea?.trim() || undefined,
      persist: !input.userIdea?.trim(),
      onProgress: async (label) => {
        await updateStrategyLabJobProgress(row.id, label);
      },
    });

    await completeStrategyLabJob(row.id, output.result);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "전략 리포트 생성 중 알 수 없는 오류가 발생했습니다.";
    await failStrategyLabJob(row.id, message);
    return false;
  }
}

export async function drainStrategyLabJobs(options?: {
  preferredJobId?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(options?.limit ?? 1, 10));
  let processed = 0;
  let preferredJobId = options?.preferredJobId ?? null;

  while (processed < limit) {
    const queuedJobId = preferredJobId ?? (await popQueueItem(STRATEGY_QUEUE_KEY));
    preferredJobId = null;

    const claimed = await claimStrategyLabJob(queuedJobId);

    if (!claimed) {
      if (queuedJobId) {
        continue;
      }

      break;
    }

    await processStrategyLabJob(claimed);
    processed += 1;
  }

  return processed;
}
