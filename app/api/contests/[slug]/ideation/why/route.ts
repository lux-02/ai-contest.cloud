import { NextResponse } from "next/server";

import { saveContestWhy } from "@/lib/server/contest-ideation";
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
      selectedCandidateId?: string;
      editedText?: string | null;
    };

    if (!body.selectedCandidateId) {
      return NextResponse.json({ error: "WHY 선택값이 필요합니다." }, { status: 400 });
    }

    const session = await saveContestWhy(resolved.contest, resolved.user.id, {
      selectedCandidateId: body.selectedCandidateId,
      editedText: body.editedText,
    });
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "WHY 저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
