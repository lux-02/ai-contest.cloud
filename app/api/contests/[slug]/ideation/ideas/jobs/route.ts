import { after, NextResponse } from "next/server";

import {
  createIdeationJob,
  drainIdeationJobs,
  findReusableIdeationJob,
} from "@/lib/server/ideation-generation-jobs";
import { getContestIdeationApiContext } from "@/lib/server/contest-ideation-api";
import type { ContestIdeationJobResponse } from "@/types/contest";

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
      votes?: Array<{
        candidateId?: string;
        voteState?: "liked" | "skipped" | "neutral";
      }>;
      customIdeas?: Array<{
        title?: string;
        description?: string;
        pros?: string[];
        cons?: string[];
        fitReason?: string;
      }>;
      userIdeaSeed?: string | null;
      preset?: "balanced" | "impact" | "deadline";
      weights?: {
        impact: number;
        feasibility: number;
        alignment: number;
        speed: number;
      };
    };

    if (!body.preset || !body.weights) {
      return NextResponse.json({ error: "추천 순위를 만들 기준이 필요합니다." }, { status: 400 });
    }

    const votes = (body.votes ?? []).flatMap((vote) =>
      vote.candidateId && vote.voteState ? [{ candidateId: vote.candidateId, voteState: vote.voteState }] : [],
    );
    const customIdeas = (body.customIdeas ?? []).flatMap((idea) =>
      idea.title && idea.description
        ? [
            {
              title: idea.title,
              description: idea.description,
              pros: idea.pros ?? [],
              cons: idea.cons ?? [],
              fitReason: idea.fitReason ?? "",
            },
          ]
        : [],
    );

    const input = {
      slug: resolved.contest.slug,
      userId: resolved.user.id,
      kind: "ideas_to_final" as const,
      votes,
      customIdeas,
      userIdeaSeed: body.userIdeaSeed,
      preset: body.preset,
      weights: body.weights,
    };

    const reusableJob = await findReusableIdeationJob(input, resolved.contest.id);

    if (reusableJob) {
      if (reusableJob.status === "queued" || reusableJob.status === "running") {
        after(async () => {
          await drainIdeationJobs({ preferredJobId: reusableJob.id, limit: 1 });
        });
      }

      return NextResponse.json(
        {
          job: reusableJob,
          session: reusableJob.session ?? null,
        } satisfies ContestIdeationJobResponse,
        { status: reusableJob.status === "completed" ? 200 : 202 },
      );
    }

    const job = await createIdeationJob(input, request.headers.get("x-request-id"));

    after(async () => {
      await drainIdeationJobs({ preferredJobId: job.id, limit: 1 });
    });

    return NextResponse.json(
      {
        job,
        session: null,
      } satisfies ContestIdeationJobResponse,
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "아이디어 추천 순위를 만들지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
