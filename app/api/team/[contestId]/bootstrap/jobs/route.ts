import { after, NextResponse } from "next/server";

import { getTeamSessionSnapshot } from "@/lib/server/contest-team";
import { createTeamJob, drainTeamBootstrapJobs, findReusableTeamJob } from "@/lib/server/team-generation-jobs";
import { getTeamWorkspaceWriteApiContext } from "@/lib/server/team-api";
import type { TeamAsyncJobResponse } from "@/types/contest";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    contestId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { contestId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      ideationSessionId?: string;
    };

    if (!body.ideationSessionId) {
      return NextResponse.json({ error: "ideation session 정보가 필요합니다." }, { status: 400 });
    }

    const resolved = await getTeamWorkspaceWriteApiContext({
      contestId,
      ideationSessionId: body.ideationSessionId,
    });

    if (!("actor" in resolved)) {
      return resolved.response;
    }

    const existing = await getTeamSessionSnapshot(contestId, body.ideationSessionId, resolved.access.ownerUserId);

    if (existing) {
      return NextResponse.json({
        job: null,
        snapshot: existing,
      } satisfies TeamAsyncJobResponse);
    }

    const input = {
      kind: "bootstrap" as const,
      contestId,
      ideationSessionId: body.ideationSessionId,
      userId: resolved.access.ownerUserId,
      actor: resolved.actor,
    };

    const reusableJob = await findReusableTeamJob(input, contestId);

    if (reusableJob) {
      if (reusableJob.status === "queued" || reusableJob.status === "running") {
        after(async () => {
          await drainTeamBootstrapJobs({ preferredJobId: reusableJob.id, limit: 1 });
        });
      }

      return NextResponse.json(
        {
          job: reusableJob,
          snapshot: reusableJob.snapshot ?? null,
        } satisfies TeamAsyncJobResponse,
        { status: reusableJob.status === "completed" ? 200 : 202 },
      );
    }

    const job = await createTeamJob(input, request.headers.get("x-request-id"));

    after(async () => {
      await drainTeamBootstrapJobs({ preferredJobId: job.id, limit: 1 });
    });

    return NextResponse.json(
      {
        job,
        snapshot: null,
      } satisfies TeamAsyncJobResponse,
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "팀 빌딩 시작을 준비하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
