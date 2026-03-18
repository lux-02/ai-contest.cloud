import "server-only";

import { NextResponse } from "next/server";

import { getContestById } from "@/lib/queries";
import {
  resolveContestWorkspaceAccess,
  resolveContestWorkspaceAccessByTeamSessionId,
} from "@/lib/server/contest-workspace-access";
import { getViewerSession } from "@/lib/server/viewer-auth";

export async function getTeamApiContext(contestId: string) {
  const [contest, viewerSession] = await Promise.all([getContestById(contestId), getViewerSession()]);

  if (!contest) {
    return {
      response: NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 }),
    };
  }

  if (!viewerSession.user) {
    return {
      response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }),
    };
  }

  return {
    contest,
    user: viewerSession.user,
  };
}

function resolveViewerLabel(user: NonNullable<Awaited<ReturnType<typeof getViewerSession>>["user"]>) {
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";

  if (metadataName.trim()) {
    return metadataName.trim();
  }

  const emailName = user.email?.split("@")[0]?.trim();
  return emailName || "협업 멤버";
}

function resolveViewerRoleLabel(role: "owner" | "member" | "reviewer") {
  if (role === "owner") {
    return "워크스페이스 owner";
  }

  if (role === "member") {
    return "협업 멤버";
  }

  return "리뷰어";
}

export async function getTeamWorkspaceApiContext(input: {
  contestId: string;
  ideationSessionId?: string | null;
  teamSessionId?: string | null;
}) {
  const base = await getTeamApiContext(input.contestId);

  if ("response" in base) {
    return base;
  }

  const access = input.ideationSessionId
    ? await resolveContestWorkspaceAccess(input.contestId, input.ideationSessionId, base.user.id)
    : input.teamSessionId
      ? await resolveContestWorkspaceAccessByTeamSessionId(input.contestId, input.teamSessionId, base.user.id)
      : null;

  if (!access) {
    return {
      response: NextResponse.json({ error: "워크스페이스 접근 권한이 없습니다." }, { status: 403 }),
    };
  }

  return {
    ...base,
    access,
  };
}

export async function getTeamWorkspaceWriteApiContext(input: {
  contestId: string;
  ideationSessionId?: string | null;
  teamSessionId?: string | null;
}) {
  const resolved = await getTeamWorkspaceApiContext(input);

  if (!("access" in resolved)) {
    return resolved;
  }

  if (!resolved.access.canEditTeam) {
    return {
      response: NextResponse.json({ error: "팀 세션을 수정할 권한이 없습니다." }, { status: 403 }),
    };
  }

  return {
    ...resolved,
    actor: {
      userId: resolved.user.id,
      label: resolveViewerLabel(resolved.user),
      roleLabel: resolveViewerRoleLabel(resolved.access.role),
    },
  };
}
