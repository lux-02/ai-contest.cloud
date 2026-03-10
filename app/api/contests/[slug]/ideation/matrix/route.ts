import { NextResponse } from "next/server";

import { saveContestMatrix } from "@/lib/server/contest-ideation";
import { getContestIdeationApiContext } from "@/lib/server/contest-ideation-api";
import type { ContestDecisionMatrixPreset, ContestDecisionMatrixWeights } from "@/types/contest";

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
      preset?: ContestDecisionMatrixPreset;
      weights?: ContestDecisionMatrixWeights;
    };

    if (!body.preset || !body.weights) {
      return NextResponse.json({ error: "Matrix preset과 가중치가 필요합니다." }, { status: 400 });
    }

    const session = await saveContestMatrix(resolved.contest, resolved.user.id, {
      preset: body.preset,
      weights: body.weights,
    });
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Decision Matrix 생성에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
