import { NextResponse } from "next/server";

import { selectContestIdea } from "@/lib/server/contest-ideation";
import { getContestIdeationApiContext } from "@/lib/server/contest-ideation-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const resolved = await getContestIdeationApiContext(slug);

    if ("response" in resolved) {
      return resolved.response;
    }

    const body = (await request.json().catch(() => ({}))) as {
      ideaId?: string;
    };

    if (!body.ideaId) {
      return NextResponse.json({ error: "확정할 아이디어가 필요합니다." }, { status: 400 });
    }

    const session = await selectContestIdea(resolved.contest, resolved.user.id, {
      ideaId: body.ideaId,
    });
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "아이디어 확정에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
