import { NextResponse } from "next/server";

import { completeContestTeamSession } from "@/lib/server/contest-team";
import { getTeamWorkspaceWriteApiContext } from "@/lib/server/team-api";

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
    };

    if (!body.teamSessionId) {
      return NextResponse.json({ error: "team session 정보가 필요합니다." }, { status: 400 });
    }

    const resolved = await getTeamWorkspaceWriteApiContext({
      contestId,
      teamSessionId: body.teamSessionId,
    });

    if (!("actor" in resolved)) {
      return resolved.response;
    }

    const snapshot = await completeContestTeamSession({
      contestId,
      teamSessionId: body.teamSessionId,
      userId: resolved.access.ownerUserId,
      actor: resolved.actor,
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "팀 세션 완료 처리에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
