import "server-only";

import { randomBytes } from "node:crypto";

import { getContestById, getContests } from "@/lib/queries";
import { getContestIdeationSession } from "@/lib/server/contest-ideation";
import { getSupabaseServiceClient } from "@/lib/server/supabase";
import type {
  Contest,
  ContestWorkspaceAccess,
  ContestWorkspaceAccessRole,
  ContestWorkspaceCollaborator,
  ContestWorkspaceInviteInboxEntry,
  ContestWorkspaceInvite,
  ContestWorkspaceInviteStatus,
  ContestWorkspaceMembershipSummary,
} from "@/types/contest";

type ContestWorkspaceMemberRow = {
  id: string;
  contest_id: string;
  ideation_session_id: string;
  owner_user_id: string;
  member_user_id: string;
  role: ContestWorkspaceAccessRole;
  created_at: string;
  updated_at: string;
};

type ContestWorkspaceInviteRow = {
  id: string;
  contest_id: string;
  ideation_session_id: string;
  owner_user_id: string;
  invitee_email: string;
  role: ContestWorkspaceAccessRole;
  invite_token: string;
  status: ContestWorkspaceInviteStatus;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

type ContestWorkspaceMemberViewRow = {
  ideation_session_id: string;
  last_viewed_at: string;
};

function getAppBaseUrl() {
  return (process.env.APP_BASE_URL ?? "https://www.ai-contest.cloud").replace(/\/$/, "");
}

function buildInviteUrl(inviteToken: string) {
  return `${getAppBaseUrl()}/invite/${inviteToken}`;
}

function createInviteToken() {
  return randomBytes(24).toString("base64url");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function buildAccess(input: {
  viewerUserId: string;
  ownerUserId: string;
  role: ContestWorkspaceAccessRole;
}): ContestWorkspaceAccess {
  const canManage = input.role === "owner";
  const canUseTeamDashboard = true;
  const canEditTeam = input.role !== "reviewer";

  return {
    viewerUserId: input.viewerUserId,
    ownerUserId: input.ownerUserId,
    role: input.role,
    canManage,
    canComment: true,
    canExport: true,
    canUseTeamDashboard,
    canEditTeam,
  };
}

function normalizeCollaborator(
  row: ContestWorkspaceMemberRow,
  memberEmail?: string | null,
): ContestWorkspaceCollaborator {
  return {
    id: row.id,
    contestId: row.contest_id,
    ideationSessionId: row.ideation_session_id,
    ownerUserId: row.owner_user_id,
    memberUserId: row.member_user_id,
    memberEmail: memberEmail ?? null,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeInvite(row: ContestWorkspaceInviteRow): ContestWorkspaceInvite {
  return {
    id: row.id,
    contestId: row.contest_id,
    ideationSessionId: row.ideation_session_id,
    ownerUserId: row.owner_user_id,
    inviteeEmail: row.invitee_email,
    role: row.role,
    inviteToken: row.invite_token,
    inviteUrl: buildInviteUrl(row.invite_token),
    status: row.status,
    acceptedByUserId: row.accepted_by_user_id,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getMemberEmail(userId: string) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    return null;
  }

  return data.user?.email?.trim().toLowerCase() ?? null;
}

async function resolveOwnerAccess(contest: Contest, ideationSessionId: string, viewerUserId: string) {
  const ideationSession = await getContestIdeationSession(contest, viewerUserId);

  if (!ideationSession || ideationSession.id !== ideationSessionId) {
    return null;
  }

  return buildAccess({
    viewerUserId,
    ownerUserId: viewerUserId,
    role: "owner",
  });
}

export async function resolveContestWorkspaceAccess(
  contestId: string,
  ideationSessionId: string,
  viewerUserId: string,
): Promise<ContestWorkspaceAccess | null> {
  const contest = await getContestById(contestId);

  if (!contest) {
    return null;
  }

  const ownerAccess = await resolveOwnerAccess(contest, ideationSessionId, viewerUserId);

  if (ownerAccess) {
    return ownerAccess;
  }

  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("contest_workspace_members")
    .select("id, contest_id, ideation_session_id, owner_user_id, member_user_id, role, created_at, updated_at")
    .eq("contest_id", contestId)
    .eq("ideation_session_id", ideationSessionId)
    .eq("member_user_id", viewerUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as ContestWorkspaceMemberRow;

  return buildAccess({
    viewerUserId,
    ownerUserId: row.owner_user_id,
    role: row.role,
  });
}

export async function listContestWorkspaceCollaborators(input: {
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return [] satisfies ContestWorkspaceCollaborator[];
  }

  const { data, error } = await supabase
    .from("contest_workspace_members")
    .select("id, contest_id, ideation_session_id, owner_user_id, member_user_id, role, created_at, updated_at")
    .eq("contest_id", input.contestId)
    .eq("ideation_session_id", input.ideationSessionId)
    .eq("owner_user_id", input.ownerUserId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [] satisfies ContestWorkspaceCollaborator[];
  }

  const rows = data as ContestWorkspaceMemberRow[];
  const emails = await Promise.all(rows.map((row) => getMemberEmail(row.member_user_id)));

  return rows.map((row, index) => normalizeCollaborator(row, emails[index] ?? null));
}

export async function listContestWorkspaceMembershipsForViewer(viewerUserId: string) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return [] satisfies ContestWorkspaceMembershipSummary[];
  }

  const { data, error } = await supabase
    .from("contest_workspace_members")
    .select("contest_id, ideation_session_id, owner_user_id, role, updated_at")
    .eq("member_user_id", viewerUserId)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [] satisfies ContestWorkspaceMembershipSummary[];
  }

  const { data: viewData } = await supabase
    .from("contest_workspace_member_views")
    .select("ideation_session_id, last_viewed_at")
    .eq("viewer_user_id", viewerUserId);

  const contests = await getContests();
  const contestMap = new Map(contests.map((contest) => [contest.id, contest]));
  const viewMap = new Map(
    ((viewData as ContestWorkspaceMemberViewRow[] | null) ?? []).map((row) => [row.ideation_session_id, row.last_viewed_at]),
  );

  return (data as Array<{
    contest_id: string;
    ideation_session_id: string;
    owner_user_id: string;
    role: ContestWorkspaceAccessRole;
    updated_at: string;
  }>)
    .map((row) => {
      const contest = contestMap.get(row.contest_id);

      if (!contest) {
        return null;
      }

      return {
        contest,
        ideationSessionId: row.ideation_session_id,
        ownerUserId: row.owner_user_id,
        role: row.role,
        updatedAt: row.updated_at,
        lastViewedAt: viewMap.get(row.ideation_session_id) ?? null,
      } satisfies ContestWorkspaceMembershipSummary;
    })
    .flatMap((entry) => (entry ? [entry] : []));
}

export async function touchContestWorkspaceView(input: {
  contestId: string;
  ideationSessionId: string;
  viewerUserId: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("contest_workspace_member_views").upsert(
    {
      contest_id: input.contestId,
      ideation_session_id: input.ideationSessionId,
      viewer_user_id: input.viewerUserId,
      last_viewed_at: new Date().toISOString(),
    },
    { onConflict: "ideation_session_id,viewer_user_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function listPendingContestWorkspaceInvitesForViewer(viewerEmail: string) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return [] satisfies ContestWorkspaceInviteInboxEntry[];
  }

  const normalizedEmail = normalizeEmail(viewerEmail);

  if (!normalizedEmail) {
    return [] satisfies ContestWorkspaceInviteInboxEntry[];
  }

  const { data, error } = await supabase
    .from("contest_workspace_invites")
    .select(
      "id, contest_id, ideation_session_id, owner_user_id, invitee_email, role, invite_token, status, accepted_by_user_id, accepted_at, created_at, updated_at",
    )
    .eq("invitee_email", normalizedEmail)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [] satisfies ContestWorkspaceInviteInboxEntry[];
  }

  const contests = await getContests();
  const contestMap = new Map(contests.map((contest) => [contest.id, contest]));

  return (data as ContestWorkspaceInviteRow[])
    .map((row) => {
      const contest = contestMap.get(row.contest_id);

      if (!contest) {
        return null;
      }

      return {
        contest,
        inviteId: row.id,
        ideationSessionId: row.ideation_session_id,
        ownerUserId: row.owner_user_id,
        inviteToken: row.invite_token,
        inviteUrl: buildInviteUrl(row.invite_token),
        inviteeEmail: row.invitee_email,
        role: row.role === "reviewer" ? "reviewer" : "member",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } satisfies ContestWorkspaceInviteInboxEntry;
    })
    .flatMap((entry) => (entry ? [entry] : []));
}

export async function removeContestWorkspaceCollaborator(input: {
  collaboratorId: string;
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const { error } = await supabase
    .from("contest_workspace_members")
    .delete()
    .eq("id", input.collaboratorId)
    .eq("contest_id", input.contestId)
    .eq("ideation_session_id", input.ideationSessionId)
    .eq("owner_user_id", input.ownerUserId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateContestWorkspaceCollaboratorRole(input: {
  collaboratorId: string;
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
  role: Exclude<ContestWorkspaceAccessRole, "owner">;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const { error } = await supabase
    .from("contest_workspace_members")
    .update({
      role: input.role,
    })
    .eq("id", input.collaboratorId)
    .eq("contest_id", input.contestId)
    .eq("ideation_session_id", input.ideationSessionId)
    .eq("owner_user_id", input.ownerUserId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listContestWorkspaceInvites(input: {
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return [] satisfies ContestWorkspaceInvite[];
  }

  const { data, error } = await supabase
    .from("contest_workspace_invites")
    .select(
      "id, contest_id, ideation_session_id, owner_user_id, invitee_email, role, invite_token, status, accepted_by_user_id, accepted_at, created_at, updated_at",
    )
    .eq("contest_id", input.contestId)
    .eq("ideation_session_id", input.ideationSessionId)
    .eq("owner_user_id", input.ownerUserId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [] satisfies ContestWorkspaceInvite[];
  }

  return (data as ContestWorkspaceInviteRow[]).map(normalizeInvite);
}

export async function createContestWorkspaceInvite(input: {
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
  invitedByUserId: string;
  inviteeEmail: string;
  role: Exclude<ContestWorkspaceAccessRole, "owner">;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const inviteeEmail = normalizeEmail(input.inviteeEmail);

  const { data: existing, error: existingError } = await supabase
    .from("contest_workspace_invites")
    .select(
      "id, contest_id, ideation_session_id, owner_user_id, invitee_email, role, invite_token, status, accepted_by_user_id, accepted_at, created_at, updated_at",
    )
    .eq("contest_id", input.contestId)
    .eq("ideation_session_id", input.ideationSessionId)
    .eq("owner_user_id", input.ownerUserId)
    .eq("invitee_email", inviteeEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return normalizeInvite(existing as ContestWorkspaceInviteRow);
  }

  const { data, error } = await supabase
    .from("contest_workspace_invites")
    .insert({
      contest_id: input.contestId,
      ideation_session_id: input.ideationSessionId,
      owner_user_id: input.ownerUserId,
      invited_by_user_id: input.invitedByUserId,
      invitee_email: inviteeEmail,
      role: input.role,
      invite_token: createInviteToken(),
      status: "pending",
    })
    .select(
      "id, contest_id, ideation_session_id, owner_user_id, invitee_email, role, invite_token, status, accepted_by_user_id, accepted_at, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "워크스페이스 초대를 만들지 못했습니다.");
  }

  return normalizeInvite(data as ContestWorkspaceInviteRow);
}

export async function revokeContestWorkspaceInvite(input: {
  inviteId: string;
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const { error } = await supabase
    .from("contest_workspace_invites")
    .update({
      status: "revoked",
    })
    .eq("id", input.inviteId)
    .eq("contest_id", input.contestId)
    .eq("ideation_session_id", input.ideationSessionId)
    .eq("owner_user_id", input.ownerUserId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }
}

export async function getContestWorkspaceInviteById(input: {
  inviteId: string;
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("contest_workspace_invites")
    .select(
      "id, contest_id, ideation_session_id, owner_user_id, invitee_email, role, invite_token, status, accepted_by_user_id, accepted_at, created_at, updated_at",
    )
    .eq("id", input.inviteId)
    .eq("contest_id", input.contestId)
    .eq("ideation_session_id", input.ideationSessionId)
    .eq("owner_user_id", input.ownerUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeInvite(data as ContestWorkspaceInviteRow);
}

export async function getContestWorkspaceInviteByToken(inviteToken: string) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("contest_workspace_invites")
    .select(
      "id, contest_id, ideation_session_id, owner_user_id, invitee_email, role, invite_token, status, accepted_by_user_id, accepted_at, created_at, updated_at",
    )
    .eq("invite_token", inviteToken)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeInvite(data as ContestWorkspaceInviteRow);
}

export async function acceptContestWorkspaceInvite(input: {
  inviteToken: string;
  viewerUserId: string;
  viewerEmail: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const invite = await getContestWorkspaceInviteByToken(input.inviteToken);

  if (!invite || invite.status !== "pending") {
    throw new Error("유효한 초대 링크가 아닙니다.");
  }

  if (normalizeEmail(input.viewerEmail) !== normalizeEmail(invite.inviteeEmail)) {
    throw new Error("초대받은 이메일 계정으로 로그인해야 합니다.");
  }

  const { error: memberError } = await supabase.from("contest_workspace_members").upsert(
    {
      contest_id: invite.contestId,
      ideation_session_id: invite.ideationSessionId,
      owner_user_id: invite.ownerUserId,
      member_user_id: input.viewerUserId,
      role: invite.role,
    },
    {
      onConflict: "ideation_session_id,member_user_id",
    },
  );

  if (memberError) {
    throw new Error(memberError.message);
  }

  const { error: inviteError } = await supabase
    .from("contest_workspace_invites")
    .update({
      status: "accepted",
      accepted_by_user_id: input.viewerUserId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id)
    .eq("status", "pending");

  if (inviteError) {
    throw new Error(inviteError.message);
  }

  return invite;
}

export async function resolveContestWorkspaceAccessByTeamSessionId(
  contestId: string,
  teamSessionId: string,
  viewerUserId: string,
) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("team_sessions")
    .select("ideation_session_id, user_id")
    .eq("id", teamSessionId)
    .eq("contest_id", contestId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const ideationSessionId =
    typeof data.ideation_session_id === "string" ? data.ideation_session_id : String(data.ideation_session_id ?? "");

  if (!ideationSessionId) {
    return null;
  }

  return resolveContestWorkspaceAccess(contestId, ideationSessionId, viewerUserId);
}
