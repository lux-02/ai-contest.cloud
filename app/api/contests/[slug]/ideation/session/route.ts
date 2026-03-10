import { NextResponse } from "next/server";

import { getContestIdeationSession } from "@/lib/server/contest-ideation";
import { getContestIdeationApiContext } from "@/lib/server/contest-ideation-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const resolved = await getContestIdeationApiContext(slug);

  if ("response" in resolved) {
    return resolved.response;
  }

  const session = await getContestIdeationSession(resolved.contest, resolved.user.id);
  return NextResponse.json({ session });
}
