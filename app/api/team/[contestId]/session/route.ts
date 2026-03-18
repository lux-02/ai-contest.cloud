import { NextResponse } from "next/server";

import { getTeamSessionSnapshot } from "@/lib/server/contest-team";
import { getTeamWorkspaceApiContext } from "@/lib/server/team-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    contestId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { contestId } = await context.params;
  const ideationSessionId = new URL(request.url).searchParams.get("session");

  if (!ideationSessionId) {
    return NextResponse.json({ error: "ideation session 정보가 필요합니다." }, { status: 400 });
  }

  const resolved = await getTeamWorkspaceApiContext({
    contestId,
    ideationSessionId,
  });

  if (!("access" in resolved)) {
    return resolved.response;
  }

  const access = resolved.access;

  const snapshot = await getTeamSessionSnapshot(contestId, ideationSessionId, access.ownerUserId);

  if (!snapshot) {
    return NextResponse.json({ error: "팀 세션을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}
