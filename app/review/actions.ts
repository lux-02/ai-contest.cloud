"use server";

import { redirect } from "next/navigation";

import { notifyContestWorkspaceOwnerOfSharedReview } from "@/lib/server/contest-review-notifications";
import { createContestWorkspaceReviewAsOwner } from "@/lib/server/contest-workspace-reviews";
import { resolveContestWorkspaceShareLink } from "@/lib/server/contest-workspace-shares";
import type { ContestWorkspaceReviewFocus } from "@/types/contest";

const reviewFocusAreas: ContestWorkspaceReviewFocus[] = ["strategy", "ideation", "team", "submission"];

function isReviewFocusArea(value: string): value is ContestWorkspaceReviewFocus {
  return reviewFocusAreas.includes(value as ContestWorkspaceReviewFocus);
}

export async function submitSharedContestWorkspaceReviewAction(formData: FormData) {
  const shareToken = String(formData.get("shareToken") ?? "");
  const reviewerLabel = String(formData.get("reviewerLabel") ?? "");
  const reviewerRole = String(formData.get("reviewerRole") ?? "");
  const focusArea = String(formData.get("focusArea") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!shareToken || !reviewerLabel.trim() || !note.trim() || !isReviewFocusArea(focusArea)) {
    redirect(`/review/${shareToken}?error=invalid`);
  }

  const shareLink = await resolveContestWorkspaceShareLink(shareToken);

  if (!shareLink) {
    redirect(`/review/${shareToken}?error=expired`);
  }

  const review = await createContestWorkspaceReviewAsOwner({
    contestId: shareLink.contestId,
    ideationSessionId: shareLink.ideationSessionId,
    ownerUserId: shareLink.ownerUserId,
    reviewerLabel,
    reviewerRole,
    focusArea,
    note,
  });

  await notifyContestWorkspaceOwnerOfSharedReview({
    reviewId: review.id,
    contestId: shareLink.contestId,
    ideationSessionId: shareLink.ideationSessionId,
    ownerUserId: shareLink.ownerUserId,
    reviewerLabel: review.reviewerLabel,
    reviewerRole: review.reviewerRole,
    focusArea: review.focusArea,
    note: review.note,
  });

  redirect(`/review/${shareToken}?submitted=1`);
}
