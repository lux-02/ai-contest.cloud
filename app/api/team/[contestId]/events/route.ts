import { NextResponse } from "next/server";

import { listTeamActivityEvents } from "@/lib/server/contest-team";
import { getTeamWorkspaceApiContext } from "@/lib/server/team-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    contestId: string;
  }>;
};

const POLL_INTERVAL_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 15000;

export async function GET(request: Request, context: RouteContext) {
  const { contestId } = await context.params;
  const { searchParams } = new URL(request.url);
  const teamSessionId = searchParams.get("teamSessionId");
  const afterSequenceValue = searchParams.get("afterSequence");
  const afterSequence = afterSequenceValue ? Number(afterSequenceValue) : null;

  if (!teamSessionId) {
    return NextResponse.json({ error: "team session 정보가 필요합니다." }, { status: 400 });
  }

  if (afterSequenceValue && Number.isNaN(afterSequence)) {
    return NextResponse.json({ error: "afterSequence 값이 올바르지 않습니다." }, { status: 400 });
  }

  const resolved = await getTeamWorkspaceApiContext({
    contestId,
    teamSessionId,
  });

  if (!("access" in resolved)) {
    return resolved.response;
  }

  const access = resolved.access;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let currentSequence = afterSequence ?? 0;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;

      const send = (payload: string) => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(payload));
      };

      const poll = async () => {
        try {
          const events = await listTeamActivityEvents({
            contestId,
            teamSessionId,
            userId: access.ownerUserId,
            afterSequence: currentSequence,
          });

          for (const event of events) {
            currentSequence = Math.max(currentSequence, event.sequence);
            send(`event: team-activity\ndata: ${JSON.stringify(event)}\n\n`);
          }
        } catch {
          send(`event: team-error\ndata: ${JSON.stringify({ error: "activity stream failed" })}\n\n`);
        }
      };

      send("retry: 1000\n\n");
      void poll();

      pollTimer = setInterval(() => {
        void poll();
      }, POLL_INTERVAL_MS);

      heartbeatTimer = setInterval(() => {
        send(": keep-alive\n\n");
      }, HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        closed = true;
        if (pollTimer) {
          clearInterval(pollTimer);
        }
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
