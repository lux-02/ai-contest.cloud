import { NextResponse } from "next/server";

import { getTeamSessionSnapshot } from "@/lib/server/contest-team";
import { getTeamApiContext } from "@/lib/server/team-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    contestId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { contestId } = await context.params;
  const resolved = await getTeamApiContext(contestId);

  if ("response" in resolved) {
    return resolved.response;
  }

  const ideationSessionId = new URL(request.url).searchParams.get("session");

  if (!ideationSessionId) {
    return NextResponse.json({ error: "ideation session 정보가 필요합니다." }, { status: 400 });
  }

  const snapshot = await getTeamSessionSnapshot(contestId, ideationSessionId, resolved.user.id);

  if (!snapshot) {
    return NextResponse.json({ error: "팀 세션을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}
