import { NextResponse } from "next/server";

import { bootstrapContestTeamSession } from "@/lib/server/contest-team";
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

    const snapshot = await bootstrapContestTeamSession(contestId, body.ideationSessionId, resolved.access.ownerUserId);

    if (!snapshot) {
      return NextResponse.json({ error: "팀 세션을 만들 수 없습니다." }, { status: 403 });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "팀 세션 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
