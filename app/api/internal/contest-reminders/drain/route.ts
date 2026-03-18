import { NextResponse } from "next/server";

import { drainContestReminderEmails } from "@/lib/server/contest-reminders";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const expected = process.env.REMINDER_JOB_RUNNER_SECRET ?? process.env.AI_JOB_RUNNER_SECRET;

  if (!expected) {
    return false;
  }

  return request.headers.get("x-reminder-job-secret") === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const result = await drainContestReminderEmails({ limit: body.limit });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Contest reminder drain failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
