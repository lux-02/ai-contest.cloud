import "server-only";

import { getContestById } from "@/lib/queries";
import { getSupabaseServiceClient } from "@/lib/server/supabase";
import type { ContestWorkspaceCollaboratorNotificationDelivery } from "@/types/contest";

type CollaboratorAcceptDeliveryStatus = "sent" | "failed" | "skipped";

type CollaboratorAcceptDeliveryLog = {
  inviteId: string;
  ownerUserId: string;
  contestId: string;
  collaboratorUserId: string;
  collaboratorEmail: string;
  provider: string;
  status: CollaboratorAcceptDeliveryStatus;
  providerMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

function normalizeCollaboratorNotificationDelivery(row: {
  id: string;
  invite_id: string;
  owner_user_id: string;
  contest_id: string;
  collaborator_user_id: string;
  collaborator_email: string;
  provider: string;
  provider_message_id: string | null;
  status: "sent" | "failed" | "skipped";
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}): ContestWorkspaceCollaboratorNotificationDelivery {
  return {
    id: row.id,
    inviteId: row.invite_id,
    ownerUserId: row.owner_user_id,
    contestId: row.contest_id,
    collaboratorUserId: row.collaborator_user_id,
    collaboratorEmail: row.collaborator_email,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    status: row.status,
    errorMessage: row.error_message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

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

async function insertCollaboratorAcceptDeliveryLog(entry: CollaboratorAcceptDeliveryLog) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  await supabase.from("contest_workspace_collaborator_notification_deliveries").insert({
    invite_id: entry.inviteId,
    owner_user_id: entry.ownerUserId,
    contest_id: entry.contestId,
    collaborator_user_id: entry.collaboratorUserId,
    collaborator_email: entry.collaboratorEmail,
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

async function sendCollaboratorAcceptedEmail(input: {
  to: string;
  contestTitle: string;
  contestId: string;
  ideationSessionId: string;
  collaboratorEmail: string;
  role: string;
  inviteId: string;
}) {
  const config = getEmailConfig();

  if (!config) {
    throw new Error("Collaborator notification email provider is not configured.");
  }

  const workspaceUrl = buildWorkspaceUrl(input.contestId, input.ideationSessionId);
  const subject = `[AI Contest Cloud] ${input.collaboratorEmail} 님이 워크스페이스 초대를 수락했습니다`;
  const text = [
    `${input.contestTitle} 워크스페이스 초대가 수락되었습니다.`,
    "",
    `참여자: ${input.collaboratorEmail}`,
    `권한: ${input.role}`,
    `워크스페이스 열기: ${workspaceUrl}`,
  ].join("\n");

  const html = [
    `<h2 style="margin:0 0 12px;font-size:20px;">워크스페이스 초대가 수락되었습니다</h2>`,
    `<p style="margin:0 0 12px;">공모전: <strong>${input.contestTitle}</strong></p>`,
    `<p style="margin:0 0 12px;">참여자: <strong>${input.collaboratorEmail}</strong></p>`,
    `<p style="margin:0 0 16px;">권한: <strong>${input.role}</strong></p>`,
    `<p style="margin:0;"><a href="${workspaceUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#f5f1e8;color:#1f2937;text-decoration:none;font-weight:600;">워크스페이스 열기</a></p>`,
  ].join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "Idempotency-Key": `contest-collaborator-accepted:${input.inviteId}:${input.to}`,
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
        { name: "kind", value: "workspace-collaborator-accepted" },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };

  if (!response.ok || typeof payload.id !== "string") {
    throw new Error(payload.message || payload.error || "Collaborator acceptance notification send failed.");
  }

  return {
    provider: "resend" as const,
    providerMessageId: payload.id,
  };
}

export async function listLatestContestWorkspaceCollaboratorNotificationDeliveries(input: {
  ownerUserId: string;
  inviteIds: string[];
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase || input.inviteIds.length === 0) {
    return new Map<string, ContestWorkspaceCollaboratorNotificationDelivery>();
  }

  const { data, error } = await supabase
    .from("contest_workspace_collaborator_notification_deliveries")
    .select(
      "id, invite_id, owner_user_id, contest_id, collaborator_user_id, collaborator_email, provider, provider_message_id, status, error_message, metadata, created_at",
    )
    .eq("owner_user_id", input.ownerUserId)
    .in("invite_id", input.inviteIds)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return new Map<string, ContestWorkspaceCollaboratorNotificationDelivery>();
  }

  const latestByInviteId = new Map<string, ContestWorkspaceCollaboratorNotificationDelivery>();

  for (const row of data as Array<{
    id: string;
    invite_id: string;
    owner_user_id: string;
    contest_id: string;
    collaborator_user_id: string;
    collaborator_email: string;
    provider: string;
    provider_message_id: string | null;
    status: "sent" | "failed" | "skipped";
    error_message: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>) {
    if (latestByInviteId.has(row.invite_id)) {
      continue;
    }

    latestByInviteId.set(row.invite_id, normalizeCollaboratorNotificationDelivery(row));
  }

  return latestByInviteId;
}

export async function notifyContestWorkspaceOwnerOfAcceptedInvite(input: {
  inviteId: string;
  ownerUserId: string;
  contestId: string;
  ideationSessionId: string;
  collaboratorUserId: string;
  collaboratorEmail: string;
  role: string;
}) {
  const config = getEmailConfig();

  if (!config) {
    await insertCollaboratorAcceptDeliveryLog({
      inviteId: input.inviteId,
      ownerUserId: input.ownerUserId,
      contestId: input.contestId,
      collaboratorUserId: input.collaboratorUserId,
      collaboratorEmail: input.collaboratorEmail,
      provider: "resend",
      status: "skipped",
      errorMessage: "Collaborator notification email provider is not configured.",
      metadata: {
        reason: "missing_email_config",
        role: input.role,
      },
    });
    return;
  }

  const [contest, ownerEmail] = await Promise.all([getContestById(input.contestId), getOwnerEmail(input.ownerUserId)]);

  if (!ownerEmail) {
    await insertCollaboratorAcceptDeliveryLog({
      inviteId: input.inviteId,
      ownerUserId: input.ownerUserId,
      contestId: input.contestId,
      collaboratorUserId: input.collaboratorUserId,
      collaboratorEmail: input.collaboratorEmail,
      provider: "resend",
      status: "skipped",
      errorMessage: "Owner email is unavailable.",
      metadata: {
        reason: "missing_owner_email",
        role: input.role,
      },
    });
    return;
  }

  if (!contest) {
    await insertCollaboratorAcceptDeliveryLog({
      inviteId: input.inviteId,
      ownerUserId: input.ownerUserId,
      contestId: input.contestId,
      collaboratorUserId: input.collaboratorUserId,
      collaboratorEmail: input.collaboratorEmail,
      provider: "resend",
      status: "skipped",
      errorMessage: "Contest not found.",
      metadata: {
        reason: "missing_contest",
        role: input.role,
      },
    });
    return;
  }

  try {
    const delivery = await sendCollaboratorAcceptedEmail({
      to: ownerEmail,
      contestTitle: contest.title,
      contestId: input.contestId,
      ideationSessionId: input.ideationSessionId,
      collaboratorEmail: input.collaboratorEmail,
      role: input.role,
      inviteId: input.inviteId,
    });

    await insertCollaboratorAcceptDeliveryLog({
      inviteId: input.inviteId,
      ownerUserId: input.ownerUserId,
      contestId: input.contestId,
      collaboratorUserId: input.collaboratorUserId,
      collaboratorEmail: input.collaboratorEmail,
      provider: delivery.provider,
      providerMessageId: delivery.providerMessageId,
      status: "sent",
      metadata: {
        ownerEmail,
        contestTitle: contest.title,
        role: input.role,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Collaborator acceptance notification send failed.";

    await insertCollaboratorAcceptDeliveryLog({
      inviteId: input.inviteId,
      ownerUserId: input.ownerUserId,
      contestId: input.contestId,
      collaboratorUserId: input.collaboratorUserId,
      collaboratorEmail: input.collaboratorEmail,
      provider: "resend",
      status: "failed",
      errorMessage: message,
      metadata: {
        ownerEmail,
        contestTitle: contest.title,
        role: input.role,
      },
    });
  }
}
