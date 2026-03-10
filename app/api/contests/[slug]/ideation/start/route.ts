import { NextResponse } from "next/server";

import { startContestIdeation } from "@/lib/server/contest-ideation";
import { getContestIdeationApiContext } from "@/lib/server/contest-ideation-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const resolved = await getContestIdeationApiContext(slug);

    if ("response" in resolved) {
      return resolved.response;
    }

    const session = await startContestIdeation(resolved.contest, resolved.user.id);
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "브레인스토밍 세션을 시작하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
