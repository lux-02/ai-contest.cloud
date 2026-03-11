import { NextResponse } from "next/server";

import { getContestBySlug } from "@/lib/queries";
import { getStoredStrategyReport } from "@/lib/server/contest-strategy-report-store";
import { runContestStrategyPipeline } from "@/lib/server/contest-strategy-pipeline";
import type { ContestStrategyLabResult } from "@/types/contest";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as { refresh?: boolean; userIdea?: string };
    const userIdea = body.userIdea?.trim() || undefined;
    const { slug } = await context.params;
    const contest = await getContestBySlug(slug);

    if (!contest) {
      return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
    }

    const stored = await getStoredStrategyReport(contest.id);

    if (!body.refresh && !userIdea) {
      if (stored?.status === "completed") {
        return NextResponse.json(stored);
      }
    }

    const { result } = await runContestStrategyPipeline(contest, {
      userIdea,
      persist: !userIdea,
    });

    if (result.status === "failed") {
      if (stored?.status === "completed") {
        return NextResponse.json(stored);
      }
      return NextResponse.json({ error: "브레인스토밍 생성에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "브레인스토밍 생성 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
