import "server-only";

import { getContestById } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { getSupabaseServiceClient } from "@/lib/server/supabase";

type ReviewNotificationDeliveryStatus = "sent" | "failed" | "skipped";

type ReviewNotificationDeliveryLog = {
  reviewId: string;
  ownerUserId: string;
  contestId: string;
  provider: string;
  status: ReviewNotificationDeliveryStatus;
  providerMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const from = process.env.REMINDER_EMAIL_FROM ?? "";
  const replyTo = process.env.REMINDER_EMAIL_REPLY_TO ?? "";

  if (!apiKey || !from) {
    return null;
  }

  return {
    apiKey,
    from,
    replyTo,
  };
}

function getAppBaseUrl() {
  return (process.env.APP_BASE_URL ?? "https://www.ai-contest.cloud").replace(/\/$/, "");
}

function buildWorkspaceUrl(contestId: string, ideationSessionId: string) {
  return `${getAppBaseUrl()}/workspace/${contestId}?session=${ideationSessionId}`;
}

async function insertReviewNotificationDeliveryLog(entry: ReviewNotificationDeliveryLog) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  await supabase.from("contest_review_notification_deliveries").insert({
    review_id: entry.reviewId,
    owner_user_id: entry.ownerUserId,
    contest_id: entry.contestId,
    provider: entry.provider,
    provider_message_id: entry.providerMessageId ?? null,
    status: entry.status,
    error_message: entry.errorMessage ?? null,
    metadata: entry.metadata ?? {},
  });
}

async function getOwnerEmail(userId: string) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(error.message);
  }

  return data.user?.email?.trim().toLowerCase() ?? null;
}

async function sendReviewNotificationEmail(input: {
  to: string;
  contestTitle: string;
  contestId: string;
  ideationSessionId: string;
  reviewerLabel: string;
  reviewerRole?: string | null;
  focusArea: string;
  note: string;
  reviewId: string;
}) {
  const config = getEmailConfig();

  if (!config) {
    throw new Error("Review notification email provider is not configured.");
  }

  const workspaceUrl = buildWorkspaceUrl(input.contestId, input.ideationSessionId);
  const reviewerText = input.reviewerRole ? `${input.reviewerLabel} · ${input.reviewerRole}` : input.reviewerLabel;
  const subject = `[AI Contest Cloud] ${input.contestTitle} 워크스페이스에 새 리뷰가 도착했습니다`;
  const text = [
    `${input.contestTitle} 워크스페이스에 새 리뷰가 도착했습니다.`,
    "",
    `리뷰어: ${reviewerText}`,
    `검토 영역: ${input.focusArea}`,
    `리뷰 내용: ${input.note}`,
    "",
    `워크스페이스 열기: ${workspaceUrl}`,
  ].join("\n");

  const html = [
    `<h2 style="margin:0 0 12px;font-size:20px;">${input.contestTitle} 워크스페이스에 새 리뷰가 도착했습니다</h2>`,
    `<p style="margin:0 0 12px;">리뷰어: <strong>${reviewerText}</strong></p>`,
    `<p style="margin:0 0 12px;">검토 영역: <strong>${input.focusArea}</strong></p>`,
    `<div style="margin:0 0 16px;padding:14px 16px;border-radius:14px;background:#111827;color:#f9fafb;white-space:pre-wrap;line-height:1.6;">${input.note}</div>`,
    `<p style="margin:0;"><a href="${workspaceUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#f5f1e8;color:#1f2937;text-decoration:none;font-weight:600;">워크스페이스 열기</a></p>`,
  ].join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "Idempotency-Key": `contest-review:${input.reviewId}:${input.to}`,
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject,
      html,
      text,
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      tags: [
        { name: "product", value: "ai-contest-cloud" },
        { name: "kind", value: "workspace-review" },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };

  if (!response.ok || typeof payload.id !== "string") {
    throw new Error(payload.message || payload.error || "Review notification send failed.");
  }

  return {
    provider: "resend" as const,
    providerMessageId: payload.id,
  };
}

export async function notifyContestWorkspaceOwnerOfSharedReview(input: {
  reviewId: string;
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
  reviewerLabel: string;
  reviewerRole?: string | null;
  focusArea: string;
  note: string;
}) {
  const config = getEmailConfig();

  if (!config) {
    await insertReviewNotificationDeliveryLog({
      reviewId: input.reviewId,
      ownerUserId: input.ownerUserId,
      contestId: input.contestId,
      provider: "resend",
      status: "skipped",
      errorMessage: "Review notification email provider is not configured.",
      metadata: {
        reason: "missing_email_config",
      },
    });
    return;
  }

  const [contest, ownerEmail] = await Promise.all([getContestById(input.contestId), getOwnerEmail(input.ownerUserId)]);

  if (!ownerEmail) {
    await insertReviewNotificationDeliveryLog({
      reviewId: input.reviewId,
      ownerUserId: input.ownerUserId,
      contestId: input.contestId,
      provider: "resend",
      status: "skipped",
      errorMessage: "Owner email is unavailable.",
      metadata: {
        reason: "missing_owner_email",
      },
    });
    return;
  }

  if (!contest) {
    await insertReviewNotificationDeliveryLog({
      reviewId: input.reviewId,
      ownerUserId: input.ownerUserId,
      contestId: input.contestId,
      provider: "resend",
      status: "skipped",
      errorMessage: "Contest not found.",
      metadata: {
        reason: "missing_contest",
      },
    });
    return;
  }

  try {
    const delivery = await sendReviewNotificationEmail({
      to: ownerEmail,
      contestTitle: contest.title,
      contestId: input.contestId,
      ideationSessionId: input.ideationSessionId,
      reviewerLabel: input.reviewerLabel,
      reviewerRole: input.reviewerRole,
      focusArea: input.focusArea,
      note: input.note,
      reviewId: input.reviewId,
    });

    await insertReviewNotificationDeliveryLog({
      reviewId: input.reviewId,
      ownerUserId: input.ownerUserId,
      contestId: input.contestId,
      provider: delivery.provider,
      providerMessageId: delivery.providerMessageId,
      status: "sent",
      metadata: {
        ownerEmail,
        contestTitle: contest.title,
        reviewPreview: input.note.slice(0, 140),
        sentAtLabel: formatDate(new Date().toISOString()),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review notification send failed.";

    await insertReviewNotificationDeliveryLog({
      reviewId: input.reviewId,
      ownerUserId: input.ownerUserId,
      contestId: input.contestId,
      provider: "resend",
      status: "failed",
      errorMessage: message,
      metadata: {
        ownerEmail,
        contestTitle: contest.title,
      },
    });
  }
}
