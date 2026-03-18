"use server";

import { redirect } from "next/navigation";

import { notifyContestWorkspaceOwnerOfAcceptedInvite } from "@/lib/server/contest-collaborator-notifications";
import { acceptContestWorkspaceInvite, getContestWorkspaceInviteByToken } from "@/lib/server/contest-workspace-access";
import { requireViewerUser } from "@/lib/server/viewer-auth";

export async function acceptContestWorkspaceInviteFromMyPageAction(formData: FormData) {
  const inviteToken = String(formData.get("inviteToken") ?? "");

  if (!inviteToken) {
    redirect("/my");
  }

  const user = await requireViewerUser("/my");

  if (!user.email) {
    redirect(`/invite/${inviteToken}?error=email`);
  }

  const invite = await getContestWorkspaceInviteByToken(inviteToken);

  if (!invite) {
    redirect(`/invite/${inviteToken}?error=expired`);
  }

  try {
    await acceptContestWorkspaceInvite({
      inviteToken,
      viewerUserId: user.id,
      viewerEmail: user.email,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid";

    if (reason.includes("이메일")) {
      redirect(`/invite/${inviteToken}?error=mismatch`);
    }

    redirect(`/invite/${inviteToken}?error=invalid`);
  }

  await notifyContestWorkspaceOwnerOfAcceptedInvite({
    inviteId: invite.id,
    ownerUserId: invite.ownerUserId,
    contestId: invite.contestId,
    ideationSessionId: invite.ideationSessionId,
    collaboratorUserId: user.id,
    collaboratorEmail: user.email,
    role: invite.role,
  });

  redirect(`/workspace/${invite.contestId}?session=${invite.ideationSessionId}`);
}
