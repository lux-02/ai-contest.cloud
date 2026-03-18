import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { TeamAsyncJobKind, TeamAsyncJobSnapshot, TeamBootstrapResponse, TeamSimulationTurnResponse } from "@/types/contest";

import { getDbPool } from "./db";
import { bootstrapContestTeamSession, simulateContestTeamTurn } from "./contest-team";
import { popQueueItem, pushQueueItem } from "./upstash-redis";

type TeamJobInput =
  | {
      kind: "bootstrap";
      contestId: string;
      ideationSessionId: string;
      userId: string;
      actor?: {
        userId: string;
        label: string;
        roleLabel: string;
      } | null;
    }
  | {
      kind: "turn";
      contestId: string;
      teamSessionId: string;
      userId: string;
      actor?: {
        userId: string;
        label: string;
        roleLabel: string;
      } | null;
      message?: string | null;
      quickAction?: string | null;
    };

type TeamJobRow = {
  id: string;
  contest_id: string;
  status: TeamAsyncJobSnapshot["status"];
  input_hash: string;
  input_json: TeamJobInput;
  result_json: TeamBootstrapResponse | TeamSimulationTurnResponse | null;
  error_message: string | null;
  progress_label: string | null;
  request_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
};

const TEAM_BOOTSTRAP_JOB_TYPE = "team_bootstrap";
const TEAM_TURN_JOB_TYPE = "team_turn";
const TEAM_BOOTSTRAP_QUEUE_KEY = "ai-generation:team-bootstrap";
const TEAM_TURN_QUEUE_KEY = "ai-generation:team-turn";
const TEAM_BOOTSTRAP_TTL_SECONDS = 15 * 60;
const TEAM_TURN_TTL_SECONDS = 5 * 60;

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function getJobType(kind: TeamAsyncJobKind) {
  return kind === "bootstrap" ? TEAM_BOOTSTRAP_JOB_TYPE : TEAM_TURN_JOB_TYPE;
}

function getQueueKey(kind: TeamAsyncJobKind) {
  return kind === "bootstrap" ? TEAM_BOOTSTRAP_QUEUE_KEY : TEAM_TURN_QUEUE_KEY;
}

function getReuseWindowSeconds(kind: TeamAsyncJobKind) {
  return kind === "bootstrap" ? TEAM_BOOTSTRAP_TTL_SECONDS : TEAM_TURN_TTL_SECONDS;
}

function normalizeTeamJob(row: TeamJobRow): TeamAsyncJobSnapshot {
  return {
    id: row.id,
    kind: row.input_json.kind,
    status: row.status,
    progressLabel: row.progress_label,
    errorMessage: row.error_message,
    snapshot: row.result_json,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    startedAt: toIsoString(row.started_at),
    completedAt: toIsoString(row.completed_at),
  };
}

export async function getTeamJobInputById(jobId: string, kind: TeamAsyncJobKind, contestId?: string) {
  const pool = getDbPool();
  const result = await pool.query<Pick<TeamJobRow, "input_json">>(
    `
      select input_json
      from public.ai_generation_jobs
      where id = $1
        and job_type = $2
        and ($3::uuid is null or contest_id = $3::uuid)
      limit 1
    `,
    [jobId, getJobType(kind), contestId ?? null],
  );

  return result.rows[0]?.input_json ?? null;
}

function buildInputHash(input: TeamJobInput) {
  return createHash("sha256")
    .update(JSON.stringify({ version: 1, ...input }))
    .digest("hex");
}

function isReusableJob(row: TeamJobRow, includeCompleted: boolean) {
  if (row.status === "queued" || row.status === "running") {
    return true;
  }

  if (!includeCompleted || row.status !== "completed") {
    return false;
  }

  const createdAt = new Date(row.created_at).getTime();
  return Date.now() - createdAt <= getReuseWindowSeconds(row.input_json.kind) * 1000;
}

export async function findReusableTeamJob(input: TeamJobInput, contestId?: string) {
  const pool = getDbPool();
  const result = await pool.query<TeamJobRow>(
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
    [getJobType(input.kind), buildInputHash(input), contestId ?? null],
  );

  const row = result.rows.find((candidate) => isReusableJob(candidate, true));
  return row ? normalizeTeamJob(row) : null;
}

export async function createTeamJob(input: TeamJobInput, requestId?: string | null) {
  const pool = getDbPool();
  const result = await pool.query<TeamJobRow>(
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
      input.contestId,
      getJobType(input.kind),
      buildInputHash(input),
      JSON.stringify(input),
      input.kind === "bootstrap" ? "AI 팀 구성을 준비하고 있어요" : "AI 팀이 답변과 다음 액션을 정리하고 있어요",
      requestId ?? randomUUID(),
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("팀 작업 job을 만들지 못했습니다.");
  }

  await pushQueueItem(getQueueKey(input.kind), row.id);
  return normalizeTeamJob(row);
}

export async function getTeamJobById(jobId: string, kind: TeamAsyncJobKind, contestId?: string) {
  const pool = getDbPool();
  const result = await pool.query<TeamJobRow>(
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
    [jobId, getJobType(kind), contestId ?? null],
  );

  const row = result.rows[0];
  return row ? normalizeTeamJob(row) : null;
}

async function updateTeamJob(jobId: string, kind: TeamAsyncJobKind, values: Record<string, unknown>) {
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
    [jobId, ...entries.map(([, value]) => value), getJobType(kind)],
  );
}

async function claimTeamJob(kind: TeamAsyncJobKind, jobId?: string | null) {
  const pool = getDbPool();
  const jobType = getJobType(kind);

  if (jobId) {
    const result = await pool.query<TeamJobRow>(
      `
        update public.ai_generation_jobs
        set
          status = 'running',
          started_at = coalesce(started_at, timezone('utc', now())),
          attempt_count = attempt_count + 1,
          progress_label = $3
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
      [jobId, jobType, kind === "bootstrap" ? "AI 팀 구성을 만들고 있어요" : "AI 팀이 응답을 만드는 중이에요"],
    );

    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  const fallback = await pool.query<TeamJobRow>(
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
        progress_label = $2
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
    [jobType, kind === "bootstrap" ? "AI 팀 구성을 만들고 있어요" : "AI 팀이 응답을 만드는 중이에요"],
  );

  return fallback.rows[0] ?? null;
}

async function completeTeamJob(
  jobId: string,
  kind: TeamAsyncJobKind,
  snapshot: TeamBootstrapResponse | TeamSimulationTurnResponse,
) {
  await updateTeamJob(jobId, kind, {
    status: "completed",
    result_json: JSON.stringify(snapshot),
    error_message: null,
    progress_label: kind === "bootstrap" ? "AI 팀 구성이 준비됐어요" : "팀 응답과 다음 액션이 준비됐어요",
    completed_at: new Date().toISOString(),
  });
}

async function failTeamJob(jobId: string, kind: TeamAsyncJobKind, errorMessage: string) {
  await updateTeamJob(jobId, kind, {
    status: "failed",
    error_message: errorMessage,
    progress_label: kind === "bootstrap" ? "AI 팀 구성을 만들지 못했어요" : "팀 응답 생성에 실패했어요",
    completed_at: new Date().toISOString(),
  });
}

async function processTeamJob(row: TeamJobRow) {
  const input = row.input_json;

  try {
    if (input.kind === "bootstrap") {
      const snapshot = await bootstrapContestTeamSession(input.contestId, input.ideationSessionId, input.userId);

      if (!snapshot) {
        throw new Error("팀 세션을 만들 수 없습니다.");
      }

      await completeTeamJob(row.id, "bootstrap", snapshot);
      return true;
    }

    const snapshot = await simulateContestTeamTurn({
      contestId: input.contestId,
      teamSessionId: input.teamSessionId,
      userId: input.userId,
      actor: input.actor,
      message: input.message,
      quickAction: input.quickAction,
    });

    await completeTeamJob(row.id, "turn", snapshot);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "팀 작업 처리 중 알 수 없는 오류가 발생했습니다.";
    await failTeamJob(row.id, input.kind, message);
    return false;
  }
}

async function drainTeamJobsForKind(kind: TeamAsyncJobKind, options?: { preferredJobId?: string | null; limit?: number }) {
  const limit = Math.max(1, Math.min(options?.limit ?? 1, 10));
  let processed = 0;
  let preferredJobId = options?.preferredJobId ?? null;

  while (processed < limit) {
    const queuedJobId = preferredJobId ?? (await popQueueItem(getQueueKey(kind)));
    preferredJobId = null;

    const claimed = await claimTeamJob(kind, queuedJobId);

    if (!claimed) {
      if (queuedJobId) {
        continue;
      }

      break;
    }

    await processTeamJob(claimed);
    processed += 1;
  }

  return processed;
}

export async function drainTeamBootstrapJobs(options?: { preferredJobId?: string | null; limit?: number }) {
  return drainTeamJobsForKind("bootstrap", options);
}

export async function drainTeamTurnJobs(options?: { preferredJobId?: string | null; limit?: number }) {
  return drainTeamJobsForKind("turn", options);
}

export type { TeamJobInput };
