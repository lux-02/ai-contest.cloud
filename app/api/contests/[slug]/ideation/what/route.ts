import { NextResponse } from "next/server";

import { saveContestWhat } from "@/lib/server/contest-ideation";
import { getContestIdeationApiContext } from "@/lib/server/contest-ideation-api";

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
    };

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

    const session = await saveContestWhat(resolved.contest, resolved.user.id, {
      votes,
      customIdeas,
      userIdeaSeed: body.userIdeaSeed,
    });
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "아이디어 후보 저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
