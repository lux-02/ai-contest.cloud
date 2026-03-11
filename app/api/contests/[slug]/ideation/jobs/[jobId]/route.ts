import { NextResponse } from "next/server";

import { getContestBySlug } from "@/lib/queries";
import { drainIdeationJobs, getIdeationJobById } from "@/lib/server/ideation-generation-jobs";
import type { ContestIdeationJobResponse } from "@/types/contest";

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

    let job = await getIdeationJobById(jobId, contest.id);

    if (!job) {
      return NextResponse.json({ error: "브레인스토밍 job을 찾을 수 없습니다." }, { status: 404 });
    }

    if (job.status === "queued" || job.status === "running") {
      await drainIdeationJobs({ preferredJobId: job.id, limit: 1 });
      job = await getIdeationJobById(jobId, contest.id);

      if (!job) {
        return NextResponse.json({ error: "브레인스토밍 job을 찾을 수 없습니다." }, { status: 404 });
      }
    }

    return NextResponse.json(
      {
        job,
        session: job.session ?? null,
      } satisfies ContestIdeationJobResponse,
      { status: job.status === "completed" ? 200 : 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "브레인스토밍 job 상태를 읽지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
