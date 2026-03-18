import { after, NextResponse } from "next/server";

import { createTeamJob, drainTeamTurnJobs, findReusableTeamJob } from "@/lib/server/team-generation-jobs";
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
      teamSessionId?: string;
      message?: string;
      quickAction?: string;
    };

    if (!body.teamSessionId) {
      return NextResponse.json({ error: "team session 정보가 필요합니다." }, { status: 400 });
    }

    if (!body.message?.trim() && !body.quickAction) {
      return NextResponse.json({ error: "보낼 내용이 필요합니다." }, { status: 400 });
    }

    const resolved = await getTeamWorkspaceWriteApiContext({
      contestId,
      teamSessionId: body.teamSessionId,
    });

    if (!("actor" in resolved)) {
      return resolved.response;
    }

    const input = {
      kind: "turn" as const,
      contestId,
      teamSessionId: body.teamSessionId,
      userId: resolved.access.ownerUserId,
      actor: resolved.actor,
      message: body.message,
      quickAction: body.quickAction,
    };

    const reusableJob = await findReusableTeamJob(input, contestId);

    if (reusableJob) {
      if (reusableJob.status === "queued" || reusableJob.status === "running") {
        after(async () => {
          await drainTeamTurnJobs({ preferredJobId: reusableJob.id, limit: 1 });
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
      await drainTeamTurnJobs({ preferredJobId: job.id, limit: 1 });
    });

    return NextResponse.json(
      {
        job,
        snapshot: null,
      } satisfies TeamAsyncJobResponse,
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "팀 응답 생성을 시작하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
