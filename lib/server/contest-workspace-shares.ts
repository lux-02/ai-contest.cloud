import "server-only";

import { randomBytes } from "node:crypto";

import { getSupabaseServiceClient } from "@/lib/server/supabase";
import type { ContestWorkspaceShareLink } from "@/types/contest";

type ContestWorkspaceShareLinkRow = {
  id: string;
  contest_id: string;
  ideation_session_id: string;
  owner_user_id: string;
  share_token: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

function getAppBaseUrl() {
  return (process.env.APP_BASE_URL ?? "https://www.ai-contest.cloud").replace(/\/$/, "");
}

function buildShareUrl(shareToken: string) {
  return `${getAppBaseUrl()}/review/${shareToken}`;
}

function normalizeShareLink(row: ContestWorkspaceShareLinkRow): ContestWorkspaceShareLink {
  return {
    id: row.id,
    contestId: row.contest_id,
    ideationSessionId: row.ideation_session_id,
    ownerUserId: row.owner_user_id,
    shareToken: row.share_token,
    shareUrl: buildShareUrl(row.share_token),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at,
  };
}

function createShareToken() {
  return randomBytes(24).toString("base64url");
}

export async function getActiveContestWorkspaceShareLink(input: {
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("contest_workspace_share_links")
    .select("id, contest_id, ideation_session_id, owner_user_id, share_token, created_at, updated_at, revoked_at")
    .eq("contest_id", input.contestId)
    .eq("ideation_session_id", input.ideationSessionId)
    .eq("owner_user_id", input.ownerUserId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeShareLink(data as ContestWorkspaceShareLinkRow);
}

export async function ensureContestWorkspaceShareLink(input: {
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
}) {
  const existing = await getActiveContestWorkspaceShareLink(input);

  if (existing) {
    return existing;
  }

  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const { data, error } = await supabase
    .from("contest_workspace_share_links")
    .insert({
      contest_id: input.contestId,
      ideation_session_id: input.ideationSessionId,
      owner_user_id: input.ownerUserId,
      share_token: createShareToken(),
    })
    .select("id, contest_id, ideation_session_id, owner_user_id, share_token, created_at, updated_at, revoked_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "공유 링크를 만들지 못했습니다.");
  }

  return normalizeShareLink(data as ContestWorkspaceShareLinkRow);
}

export async function revokeContestWorkspaceShareLink(input: {
  shareLinkId: string;
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const { error } = await supabase
    .from("contest_workspace_share_links")
    .update({
      revoked_at: new Date().toISOString(),
    })
    .eq("id", input.shareLinkId)
    .eq("contest_id", input.contestId)
    .eq("ideation_session_id", input.ideationSessionId)
    .eq("owner_user_id", input.ownerUserId)
    .is("revoked_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function resolveContestWorkspaceShareLink(shareToken: string) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("contest_workspace_share_links")
    .select("id, contest_id, ideation_session_id, owner_user_id, share_token, created_at, updated_at, revoked_at")
    .eq("share_token", shareToken)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeShareLink(data as ContestWorkspaceShareLinkRow);
}
