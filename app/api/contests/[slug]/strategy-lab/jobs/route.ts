import { after, NextResponse } from "next/server";

import { getContestBySlug } from "@/lib/queries";
import {
  createStrategyLabJob,
  drainStrategyLabJobs,
  findReusableStrategyLabJob,
} from "@/lib/server/ai-generation-jobs";
import { getStoredStrategyReport } from "@/lib/server/contest-strategy-report-store";
import type { StrategyLabJobResponse } from "@/types/contest";

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

    if (!body.refresh && !userIdea) {
      const stored = await getStoredStrategyReport(contest.id);

      if (stored?.status === "completed") {
        return NextResponse.json({
          job: null,
          result: stored,
        } satisfies StrategyLabJobResponse);
      }
    }

    const reusableJob = await findReusableStrategyLabJob(
      { slug: contest.slug, userIdea },
      { includeCompleted: !body.refresh, contestId: contest.id },
    );

    if (reusableJob) {
      if (reusableJob.status === "queued" || reusableJob.status === "running") {
        after(async () => {
          await drainStrategyLabJobs({ preferredJobId: reusableJob.id, limit: 1 });
        });
      }

      return NextResponse.json(
        {
          job: reusableJob,
          result: reusableJob.result ?? null,
        } satisfies StrategyLabJobResponse,
        { status: reusableJob.status === "completed" ? 200 : 202 },
      );
    }

    const job = await createStrategyLabJob(
      { slug: contest.slug, userIdea },
      request.headers.get("x-request-id"),
    );

    after(async () => {
      await drainStrategyLabJobs({ preferredJobId: job.id, limit: 1 });
    });

    return NextResponse.json(
      {
        job,
        result: null,
      } satisfies StrategyLabJobResponse,
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "전략 생성 요청을 시작하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
