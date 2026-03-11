import { NextResponse } from "next/server";

import { drainStrategyLabJobs } from "@/lib/server/ai-generation-jobs";
import { drainIdeationJobs } from "@/lib/server/ideation-generation-jobs";
import { drainTeamBootstrapJobs, drainTeamTurnJobs } from "@/lib/server/team-generation-jobs";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const expected = process.env.AI_JOB_RUNNER_SECRET;

  if (!expected) {
    return false;
  }

  return request.headers.get("x-ai-job-secret") === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = Number.isFinite(body.limit) ? Math.min(Math.max(Math.floor(body.limit ?? 1), 1), 20) : 5;
    const [strategyProcessed, ideationProcessed, teamBootstrapProcessed, teamTurnProcessed] = await Promise.all([
      drainStrategyLabJobs({ limit }),
      drainIdeationJobs({ limit }),
      drainTeamBootstrapJobs({ limit }),
      drainTeamTurnJobs({ limit }),
    ]);
    const processed = strategyProcessed + ideationProcessed + teamBootstrapProcessed + teamTurnProcessed;

    return NextResponse.json({
      ok: true,
      processed,
      limit,
      breakdown: {
        strategy: strategyProcessed,
        ideation: ideationProcessed,
        teamBootstrap: teamBootstrapProcessed,
        teamTurn: teamTurnProcessed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI job drain failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
