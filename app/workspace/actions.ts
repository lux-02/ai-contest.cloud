"use server";

import { revalidatePath } from "next/cache";

import { notifyContestWorkspaceInvite } from "@/lib/server/contest-invite-notifications";
import {
  createContestWorkspaceInvite,
  getContestWorkspaceInviteById,
  removeContestWorkspaceCollaborator,
  resolveContestWorkspaceAccess,
  revokeContestWorkspaceInvite,
  updateContestWorkspaceCollaboratorRole,
} from "@/lib/server/contest-workspace-access";
import {
  createContestWorkspaceReviewAsOwner,
  deleteContestWorkspaceReview,
} from "@/lib/server/contest-workspace-reviews";
import {
  ensureContestWorkspaceShareLink,
  revokeContestWorkspaceShareLink,
} from "@/lib/server/contest-workspace-shares";
import { requireViewerUser, sanitizeViewerNextPath } from "@/lib/server/viewer-auth";
import type { ContestWorkspaceReviewFocus } from "@/types/contest";

const reviewFocusAreas: ContestWorkspaceReviewFocus[] = ["strategy", "ideation", "team", "submission"];

function isReviewFocusArea(value: string): value is ContestWorkspaceReviewFocus {
  return reviewFocusAreas.includes(value as ContestWorkspaceReviewFocus);
}

export async function addContestWorkspaceReviewAction(formData: FormData) {
  const contestId = String(formData.get("contestId") ?? "");
  const ideationSessionId = String(formData.get("ideationSessionId") ?? "");
  const reviewerLabel = String(formData.get("reviewerLabel") ?? "");
  const reviewerRole = String(formData.get("reviewerRole") ?? "");
  const focusArea = String(formData.get("focusArea") ?? "");
  const note = String(formData.get("note") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));
  const user = await requireViewerUser(nextPath);

  if (!contestId || !ideationSessionId || !reviewerLabel.trim() || !note.trim() || !isReviewFocusArea(focusArea)) {
    return;
  }

  const access = await resolveContestWorkspaceAccess(contestId, ideationSessionId, user.id);

  if (!access?.canComment) {
    return;
  }

  await createContestWorkspaceReviewAsOwner({
    contestId,
    ideationSessionId,
    ownerUserId: access.ownerUserId,
    reviewerLabel,
    reviewerRole,
    focusArea,
    note,
  });

  revalidatePath(nextPath);
}

export async function deleteContestWorkspaceReviewAction(formData: FormData) {
  const reviewId = String(formData.get("reviewId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const ideationSessionId = String(formData.get("ideationSessionId") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));

  const user = await requireViewerUser(nextPath);

  if (!reviewId || !contestId || !ideationSessionId) {
    return;
  }

  const access = await resolveContestWorkspaceAccess(contestId, ideationSessionId, user.id);

  if (!access?.canManage) {
    return;
  }

  await deleteContestWorkspaceReview({
    reviewId,
    contestId,
    ideationSessionId,
  });

  revalidatePath(nextPath);
}

export async function createContestWorkspaceShareLinkAction(formData: FormData) {
  const contestId = String(formData.get("contestId") ?? "");
  const ideationSessionId = String(formData.get("ideationSessionId") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));
  const user = await requireViewerUser(nextPath);

  if (!contestId || !ideationSessionId) {
    return;
  }

  const access = await resolveContestWorkspaceAccess(contestId, ideationSessionId, user.id);

  if (!access?.canManage) {
    return;
  }

  await ensureContestWorkspaceShareLink({
    contestId,
    ideationSessionId,
    ownerUserId: access.ownerUserId,
  });

  revalidatePath(nextPath);
}

export async function revokeContestWorkspaceShareLinkAction(formData: FormData) {
  const shareLinkId = String(formData.get("shareLinkId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const ideationSessionId = String(formData.get("ideationSessionId") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));
  const user = await requireViewerUser(nextPath);

  if (!shareLinkId || !contestId || !ideationSessionId) {
    return;
  }

  const access = await resolveContestWorkspaceAccess(contestId, ideationSessionId, user.id);

  if (!access?.canManage) {
    return;
  }

  await revokeContestWorkspaceShareLink({
    shareLinkId,
    contestId,
    ideationSessionId,
    ownerUserId: access.ownerUserId,
  });

  revalidatePath(nextPath);
}

export async function createContestWorkspaceInviteAction(formData: FormData) {
  const contestId = String(formData.get("contestId") ?? "");
  const ideationSessionId = String(formData.get("ideationSessionId") ?? "");
  const inviteeEmail = String(formData.get("inviteeEmail") ?? "");
  const role = String(formData.get("role") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));
  const user = await requireViewerUser(nextPath);

  if (!contestId || !ideationSessionId || !inviteeEmail.trim() || (role !== "member" && role !== "reviewer")) {
    return;
  }

  const access = await resolveContestWorkspaceAccess(contestId, ideationSessionId, user.id);

  if (!access?.canManage) {
    return;
  }

  const invite = await createContestWorkspaceInvite({
    contestId,
    ideationSessionId,
    ownerUserId: access.ownerUserId,
    invitedByUserId: user.id,
    inviteeEmail,
    role,
  });

  await notifyContestWorkspaceInvite({
    inviteId: invite.id,
    ownerUserId: invite.ownerUserId,
    contestId: invite.contestId,
    inviteeEmail: invite.inviteeEmail,
    role: invite.role,
    inviteUrl: invite.inviteUrl,
  });

  revalidatePath(nextPath);
}

export async function revokeContestWorkspaceInviteAction(formData: FormData) {
  const inviteId = String(formData.get("inviteId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const ideationSessionId = String(formData.get("ideationSessionId") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));
  const user = await requireViewerUser(nextPath);

  if (!inviteId || !contestId || !ideationSessionId) {
    return;
  }

  const access = await resolveContestWorkspaceAccess(contestId, ideationSessionId, user.id);

  if (!access?.canManage) {
    return;
  }

  await revokeContestWorkspaceInvite({
    inviteId,
    contestId,
    ideationSessionId,
    ownerUserId: access.ownerUserId,
  });

  revalidatePath(nextPath);
}

export async function removeContestWorkspaceCollaboratorAction(formData: FormData) {
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const ideationSessionId = String(formData.get("ideationSessionId") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));
  const user = await requireViewerUser(nextPath);

  if (!collaboratorId || !contestId || !ideationSessionId) {
    return;
  }

  const access = await resolveContestWorkspaceAccess(contestId, ideationSessionId, user.id);

  if (!access?.canManage) {
    return;
  }

  await removeContestWorkspaceCollaborator({
    collaboratorId,
    contestId,
    ideationSessionId,
    ownerUserId: access.ownerUserId,
  });

  revalidatePath(nextPath);
}

export async function resendContestWorkspaceInviteAction(formData: FormData) {
  const inviteId = String(formData.get("inviteId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const ideationSessionId = String(formData.get("ideationSessionId") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));
  const user = await requireViewerUser(nextPath);

  if (!inviteId || !contestId || !ideationSessionId) {
    return;
  }

  const access = await resolveContestWorkspaceAccess(contestId, ideationSessionId, user.id);

  if (!access?.canManage) {
    return;
  }

  const invite = await getContestWorkspaceInviteById({
    inviteId,
    contestId,
    ideationSessionId,
    ownerUserId: access.ownerUserId,
  });

  if (!invite || invite.status !== "pending") {
    return;
  }

  await notifyContestWorkspaceInvite({
    inviteId: invite.id,
    ownerUserId: invite.ownerUserId,
    contestId: invite.contestId,
    inviteeEmail: invite.inviteeEmail,
    role: invite.role,
    inviteUrl: invite.inviteUrl,
  });

  revalidatePath(nextPath);
}

export async function updateContestWorkspaceCollaboratorRoleAction(formData: FormData) {
  const collaboratorId = String(formData.get("collaboratorId") ?? "");
  const contestId = String(formData.get("contestId") ?? "");
  const ideationSessionId = String(formData.get("ideationSessionId") ?? "");
  const role = String(formData.get("role") ?? "");
  const nextPath = sanitizeViewerNextPath(String(formData.get("next") ?? "/my"));
  const user = await requireViewerUser(nextPath);

  if (!collaboratorId || !contestId || !ideationSessionId || (role !== "member" && role !== "reviewer")) {
    return;
  }

  const access = await resolveContestWorkspaceAccess(contestId, ideationSessionId, user.id);

  if (!access?.canManage) {
    return;
  }

  await updateContestWorkspaceCollaboratorRole({
    collaboratorId,
    contestId,
    ideationSessionId,
    ownerUserId: access.ownerUserId,
    role,
  });

  revalidatePath(nextPath);
}
