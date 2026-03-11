import { NextResponse } from "next/server";

import { getContestBySlug } from "@/lib/queries";
import { collectContestSources } from "@/lib/server/contest-source-collector";
import { logRemoteAiFallback } from "@/lib/server/remote-ai-runtime";
import { getStoredStrategyReport, upsertStrategyReport } from "@/lib/server/contest-strategy-report-store";
import {
  canUseRemoteContestStrategyService,
  generateContestStrategyWithRemoteService,
} from "@/lib/server/contest-strategy-service";
import { generateContestStrategyLab } from "@/lib/server/contest-strategy-lab";
import type { CollectedStrategySource } from "@/lib/server/contest-source-collector";
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

    let sources: CollectedStrategySource[];
    let result: ContestStrategyLabResult;

    if (canUseRemoteContestStrategyService() && !userIdea) {
      try {
        const remote = await generateContestStrategyWithRemoteService(contest);
        sources = remote.sources;
        result = remote.result;
      } catch (error) {
        logRemoteAiFallback("contest-strategy", error, {
          contestSlug: contest.slug,
          route: "strategy-lab",
        });
        sources = await collectContestSources(contest);
        result = await generateContestStrategyLab(contest, sources, { userIdea });
      }
    } else {
      sources = await collectContestSources(contest);
      result = await generateContestStrategyLab(contest, sources, { userIdea });
    }

    if (result.status === "failed") {
      if (stored?.status === "completed") {
        return NextResponse.json(stored);
      }
      return NextResponse.json({ error: "브레인스토밍 생성에 실패했습니다." }, { status: 500 });
    }

    try {
      if (!userIdea) {
        await upsertStrategyReport(contest.id, result, sources);
      }
    } catch (error) {
      console.error("[strategy-lab] could not persist generated report", error);
      // The page can still render the in-memory result even if persistence fails.
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "브레인스토밍 생성 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
