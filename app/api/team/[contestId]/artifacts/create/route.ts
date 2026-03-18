import { NextResponse } from "next/server";

import { createContestTeamArtifact } from "@/lib/server/contest-team";
import { getTeamWorkspaceWriteApiContext } from "@/lib/server/team-api";
import type { TeamArtifactStatus, TeamArtifactType } from "@/types/contest";

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
      artifactType?: TeamArtifactType;
      title?: string;
      summary?: string;
      body?: string;
      status?: TeamArtifactStatus;
      sourceTaskId?: string | null;
    };

    if (!body.teamSessionId || !body.artifactType || !body.title) {
      return NextResponse.json({ error: "team session과 작업물 정보가 필요합니다." }, { status: 400 });
    }

    const resolved = await getTeamWorkspaceWriteApiContext({
      contestId,
      teamSessionId: body.teamSessionId,
    });

    if (!("actor" in resolved)) {
      return resolved.response;
    }

    const snapshot = await createContestTeamArtifact({
      contestId,
      teamSessionId: body.teamSessionId,
      userId: resolved.access.ownerUserId,
      actor: resolved.actor,
      artifactType: body.artifactType,
      title: body.title,
      summary: body.summary ?? "",
      body: body.body ?? "",
      status: body.status,
      sourceTaskId: body.sourceTaskId,
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "작업물 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
