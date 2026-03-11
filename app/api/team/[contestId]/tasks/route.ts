import { NextResponse } from "next/server";

import { updateContestTeamTask } from "@/lib/server/contest-team";
import { getTeamApiContext } from "@/lib/server/team-api";
import type { TeamTaskStatus } from "@/types/contest";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    contestId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { contestId } = await context.params;
    const resolved = await getTeamApiContext(contestId);

    if ("response" in resolved) {
      return resolved.response;
    }

    const body = (await request.json().catch(() => ({}))) as {
      teamSessionId?: string;
      taskId?: string;
      action?: "assign" | "move" | "complete";
      assigneeMemberId?: string | null;
      status?: TeamTaskStatus;
    };

    if (!body.teamSessionId || !body.taskId || !body.action) {
      return NextResponse.json({ error: "team session, task, action이 필요합니다." }, { status: 400 });
    }

    const snapshot = await updateContestTeamTask({
      contestId,
      teamSessionId: body.teamSessionId,
      userId: resolved.user.id,
      action: body.action,
      taskId: body.taskId,
      assigneeMemberId: body.assigneeMemberId,
      status: body.status,
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "태스크 업데이트에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
