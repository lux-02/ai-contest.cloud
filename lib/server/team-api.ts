import "server-only";

import { NextResponse } from "next/server";

import { getContestById } from "@/lib/queries";
import {
  resolveContestWorkspaceAccess,
  resolveContestWorkspaceAccessByTeamSessionId,
} from "@/lib/server/contest-workspace-access";
import { getViewerSession } from "@/lib/server/viewer-auth";

export async function getTeamApiContext(contestId: string) {
  const [contest, viewerSession] = await Promise.all([getContestById(contestId), getViewerSession()]);

  if (!contest) {
    return {
      response: NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 }),
    };
  }

  if (!viewerSession.user) {
    return {
      response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }),
    };
  }

  return {
    contest,
    user: viewerSession.user,
  };
}

export async function getTeamWorkspaceApiContext(input: {
  contestId: string;
  ideationSessionId?: string | null;
  teamSessionId?: string | null;
}) {
  const base = await getTeamApiContext(input.contestId);

  if ("response" in base) {
    return base;
  }

  const access = input.ideationSessionId
    ? await resolveContestWorkspaceAccess(input.contestId, input.ideationSessionId, base.user.id)
    : input.teamSessionId
      ? await resolveContestWorkspaceAccessByTeamSessionId(input.contestId, input.teamSessionId, base.user.id)
      : null;

  if (!access) {
    return {
      response: NextResponse.json({ error: "워크스페이스 접근 권한이 없습니다." }, { status: 403 }),
    };
  }

  return {
    ...base,
    access,
  };
}
