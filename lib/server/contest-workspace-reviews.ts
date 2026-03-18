import "server-only";

import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/server/supabase";
import type { ContestWorkspaceReviewFocus, ContestWorkspaceReviewNote } from "@/types/contest";

type ContestWorkspaceReviewRow = {
  id: string;
  reviewer_label: string;
  reviewer_role: string | null;
  focus_area: ContestWorkspaceReviewFocus;
  note: string;
  created_at: string;
  updated_at: string;
};

function normalizeReview(row: ContestWorkspaceReviewRow): ContestWorkspaceReviewNote {
  return {
    id: row.id,
    reviewerLabel: row.reviewer_label,
    reviewerRole: row.reviewer_role,
    focusArea: row.focus_area,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listContestWorkspaceReviews(contestId: string, ideationSessionId: string) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return [] satisfies ContestWorkspaceReviewNote[];
  }

  const { data, error } = await supabase
    .from("contest_workspace_reviews")
    .select("id, reviewer_label, reviewer_role, focus_area, note, created_at, updated_at")
    .eq("contest_id", contestId)
    .eq("ideation_session_id", ideationSessionId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [] satisfies ContestWorkspaceReviewNote[];
  }

  return (data as ContestWorkspaceReviewRow[]).map(normalizeReview);
}

export async function createContestWorkspaceReview(input: {
  contestId: string;
  ideationSessionId: string;
  userId: string;
  reviewerLabel: string;
  reviewerRole?: string | null;
  focusArea: ContestWorkspaceReviewFocus;
  note: string;
}) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase server client is not configured.");
  }

  const { data, error } = await supabase
    .from("contest_workspace_reviews")
    .insert({
      contest_id: input.contestId,
      ideation_session_id: input.ideationSessionId,
      user_id: input.userId,
      reviewer_label: input.reviewerLabel.trim(),
      reviewer_role: input.reviewerRole?.trim() || null,
      focus_area: input.focusArea,
      note: input.note.trim(),
    })
    .select("id, reviewer_label, reviewer_role, focus_area, note, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "리뷰를 저장하지 못했습니다.");
  }

  return normalizeReview(data as ContestWorkspaceReviewRow);
}

export async function createContestWorkspaceReviewAsOwner(input: {
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
  reviewerLabel: string;
  reviewerRole?: string | null;
  focusArea: ContestWorkspaceReviewFocus;
  note: string;
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const { data, error } = await supabase
    .from("contest_workspace_reviews")
    .insert({
      contest_id: input.contestId,
      ideation_session_id: input.ideationSessionId,
      user_id: input.ownerUserId,
      reviewer_label: input.reviewerLabel.trim(),
      reviewer_role: input.reviewerRole?.trim() || null,
      focus_area: input.focusArea,
      note: input.note.trim(),
    })
    .select("id, reviewer_label, reviewer_role, focus_area, note, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "리뷰를 저장하지 못했습니다.");
  }

  return normalizeReview(data as ContestWorkspaceReviewRow);
}

export async function listContestWorkspaceReviewsWithServiceRole(contestId: string, ideationSessionId: string) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return [] satisfies ContestWorkspaceReviewNote[];
  }

  const { data, error } = await supabase
    .from("contest_workspace_reviews")
    .select("id, reviewer_label, reviewer_role, focus_area, note, created_at, updated_at")
    .eq("contest_id", contestId)
    .eq("ideation_session_id", ideationSessionId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [] satisfies ContestWorkspaceReviewNote[];
  }

  return (data as ContestWorkspaceReviewRow[]).map(normalizeReview);
}

export async function deleteContestWorkspaceReview(input: {
  reviewId: string;
  contestId: string;
  ideationSessionId: string;
}) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase server client is not configured.");
  }

  const { error } = await supabase
    .from("contest_workspace_reviews")
    .delete()
    .eq("id", input.reviewId)
    .eq("contest_id", input.contestId)
    .eq("ideation_session_id", input.ideationSessionId);

  if (error) {
    throw new Error(error.message);
  }
}
