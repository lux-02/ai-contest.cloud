import "server-only";

import { NextResponse } from "next/server";

import { getContestById } from "@/lib/queries";
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
