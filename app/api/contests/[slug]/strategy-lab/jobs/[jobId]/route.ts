import { after, NextResponse } from "next/server";

import { getContestBySlug } from "@/lib/queries";
import { drainStrategyLabJobs, getStrategyLabJobById } from "@/lib/server/ai-generation-jobs";
import type { StrategyLabJobResponse } from "@/types/contest";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    slug: string;
    jobId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, jobId } = await context.params;
    const contest = await getContestBySlug(slug);

    if (!contest) {
      return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
    }

    const job = await getStrategyLabJobById(jobId, contest.id);

    if (!job) {
      return NextResponse.json({ error: "전략 생성 job을 찾을 수 없습니다." }, { status: 404 });
    }

    if (job.status === "queued" || job.status === "running") {
      after(async () => {
        await drainStrategyLabJobs({ preferredJobId: job.id, limit: 1 });
      });
    }

    return NextResponse.json(
      {
        job,
        result: job.result ?? null,
      } satisfies StrategyLabJobResponse,
      { status: job.status === "completed" ? 200 : 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "전략 생성 상태를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
