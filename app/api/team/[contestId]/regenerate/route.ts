import { NextResponse } from "next/server";

import { regenerateContestTeamSession } from "@/lib/server/contest-team";
import { getTeamWorkspaceWriteApiContext } from "@/lib/server/team-api";
import type { TeamRegenerateMode } from "@/types/contest";

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
      mode?: TeamRegenerateMode;
      memberId?: string;
    };

    if (!body.teamSessionId || !body.mode) {
      return NextResponse.json({ error: "team session과 mode가 필요합니다." }, { status: 400 });
    }

    const resolved = await getTeamWorkspaceWriteApiContext({
      contestId,
      teamSessionId: body.teamSessionId,
    });

    if (!("actor" in resolved)) {
      return resolved.response;
    }

    const snapshot = await regenerateContestTeamSession({
      contestId,
      teamSessionId: body.teamSessionId,
      userId: resolved.access.ownerUserId,
      actor: resolved.actor,
      mode: body.mode,
      memberId: body.memberId,
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "팀 구성 재생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
