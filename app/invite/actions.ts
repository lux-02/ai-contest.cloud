"use server";

import { redirect } from "next/navigation";

import { acceptContestWorkspaceInvite, getContestWorkspaceInviteByToken } from "@/lib/server/contest-workspace-access";
import { requireViewerUser } from "@/lib/server/viewer-auth";

export async function acceptContestWorkspaceInviteAction(formData: FormData) {
  const inviteToken = String(formData.get("inviteToken") ?? "");

  if (!inviteToken) {
    redirect("/contests");
  }

  const user = await requireViewerUser(`/invite/${inviteToken}`);

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

  redirect(`/workspace/${invite.contestId}?session=${invite.ideationSessionId}`);
}
