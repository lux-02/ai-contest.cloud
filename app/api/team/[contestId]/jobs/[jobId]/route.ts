import { NextResponse } from "next/server";

import { drainTeamBootstrapJobs, drainTeamTurnJobs, getTeamJobById } from "@/lib/server/team-generation-jobs";
import { getTeamApiContext } from "@/lib/server/team-api";
import type { TeamAsyncJobKind, TeamAsyncJobResponse } from "@/types/contest";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    contestId: string;
    jobId: string;
  }>;
};

function normalizeKind(value: string | null): TeamAsyncJobKind | null {
  if (value === "bootstrap" || value === "turn") {
    return value;
  }

  return null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { contestId, jobId } = await context.params;
    const resolved = await getTeamApiContext(contestId);

    if ("response" in resolved) {
      return resolved.response;
    }

    const kind = normalizeKind(new URL(request.url).searchParams.get("kind"));

    if (!kind) {
      return NextResponse.json({ error: "job kind 정보가 필요합니다." }, { status: 400 });
    }

    let job = await getTeamJobById(jobId, kind, contestId);

    if (!job) {
      return NextResponse.json({ error: "팀 작업 job을 찾을 수 없습니다." }, { status: 404 });
    }

    if (job.status === "queued" || job.status === "running") {
      if (kind === "bootstrap") {
        await drainTeamBootstrapJobs({ preferredJobId: job.id, limit: 1 });
      } else {
        await drainTeamTurnJobs({ preferredJobId: job.id, limit: 1 });
      }

      job = await getTeamJobById(jobId, kind, contestId);

      if (!job) {
        return NextResponse.json({ error: "팀 작업 job을 찾을 수 없습니다." }, { status: 404 });
      }
    }

    return NextResponse.json(
      {
        job,
        snapshot: job.snapshot ?? null,
      } satisfies TeamAsyncJobResponse,
      { status: job.status === "completed" ? 200 : 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "팀 작업 job 상태를 읽지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
