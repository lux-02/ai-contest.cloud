import { NextResponse } from "next/server";

import { getContestBySlug } from "@/lib/queries";
import { collectContestSources } from "@/lib/server/contest-source-collector";
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
    const body = (await request.json().catch(() => ({}))) as { refresh?: boolean };
    const { slug } = await context.params;
    const contest = await getContestBySlug(slug);

    if (!contest) {
      return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
    }

    const stored = await getStoredStrategyReport(contest.id);

    if (!body.refresh) {

      if (stored?.status === "completed") {
        return NextResponse.json(stored);
      }
    }

    let sources: CollectedStrategySource[];
    let result: ContestStrategyLabResult;

    if (canUseRemoteContestStrategyService()) {
      try {
        const remote = await generateContestStrategyWithRemoteService(contest);
        sources = remote.sources;
        result = remote.result;
      } catch (error) {
        console.error("[strategy-lab] remote service failed, falling back to local pipeline", error);
        sources = await collectContestSources(contest);
        result = await generateContestStrategyLab(contest, sources);
      }
    } else {
      sources = await collectContestSources(contest);
      result = await generateContestStrategyLab(contest, sources);
    }

    if (result.status === "failed") {
      if (stored?.status === "completed") {
        return NextResponse.json(stored);
      }
      return NextResponse.json({ error: "브레인스토밍 생성에 실패했습니다." }, { status: 500 });
    }

    try {
      await upsertStrategyReport(contest.id, result, sources);
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
