import { NextResponse } from "next/server";

import { getContestBySlug } from "@/lib/queries";
import { registerContestApply } from "@/lib/server/contest-metrics";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const contest = await getContestBySlug(slug);

  if (!contest) {
    return NextResponse.redirect(new URL("/contests", request.url), { status: 302 });
  }

  await registerContestApply(contest.id);

  return NextResponse.redirect(new URL(contest.applyUrl ?? contest.url), { status: 302 });
}
