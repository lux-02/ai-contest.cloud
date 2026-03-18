import { NextResponse } from "next/server";

import { getContestWorkspacePackageMarkdown } from "@/lib/server/contest-workspace";
import { getTeamApiContext } from "@/lib/server/team-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    contestId: string;
  }>;
};

function sanitizeFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { contestId } = await context.params;
    const resolved = await getTeamApiContext(contestId);

    if ("response" in resolved) {
      return resolved.response;
    }

    const ideationSessionId = new URL(request.url).searchParams.get("session");

    if (!ideationSessionId) {
      return NextResponse.json({ error: "ideation session 정보가 필요합니다." }, { status: 400 });
    }

    const markdown = await getContestWorkspacePackageMarkdown(contestId, ideationSessionId, resolved.user.id);

    if (!markdown) {
      return NextResponse.json({ error: "워크스페이스 패키지를 찾을 수 없습니다." }, { status: 404 });
    }

    const filename = `${sanitizeFilename(resolved.contest.title || "contest-package") || "contest-package"}.md`;

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "워크스페이스 패키지 export에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
