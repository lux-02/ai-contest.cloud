import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/server/admin-auth";
import { extractContestFields } from "@/lib/server/contest-extraction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const adminSession = await getAdminSession();

  if (!adminSession.user) {
    return NextResponse.json({ error: "관리자 로그인 세션이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as {
    sourceUrl?: string | null;
    rawText?: string | null;
  };

  const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";

  if (!rawText && !sourceUrl) {
    return NextResponse.json({ error: "원문 링크나 공고 본문 중 하나는 필요합니다." }, { status: 400 });
  }

  const result = await extractContestFields({
    sourceUrl: sourceUrl || null,
    rawText,
  });

  if (result.status === "failed") {
    return NextResponse.json(
      {
        error: "AI 추출에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        notes: result.notes,
        rawResponse: result.rawResponse,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(result);
}
