import "server-only";

import { getContestById } from "@/lib/queries";
import { getSupabaseServiceClient } from "@/lib/server/supabase";
import type { ContestWorkspaceInviteDelivery } from "@/types/contest";

type InviteDeliveryStatus = "sent" | "failed" | "skipped";

type InviteDeliveryLog = {
  id?: string;
  inviteId: string;
  ownerUserId: string;
  inviteeEmail: string;
  provider: string;
  status: InviteDeliveryStatus;
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

async function insertInviteDeliveryLog(entry: InviteDeliveryLog) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  await supabase.from("contest_workspace_invite_deliveries").insert({
    invite_id: entry.inviteId,
    owner_user_id: entry.ownerUserId,
    invitee_email: entry.inviteeEmail,
    provider: entry.provider,
    provider_message_id: entry.providerMessageId ?? null,
    status: entry.status,
    error_message: entry.errorMessage ?? null,
    metadata: entry.metadata ?? {},
  });
}

function normalizeInviteDelivery(row: {
  id: string;
  invite_id: string;
  owner_user_id: string;
  invitee_email: string;
  provider: string;
  provider_message_id: string | null;
  status: "sent" | "failed" | "skipped";
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}): ContestWorkspaceInviteDelivery {
  return {
    id: row.id,
    inviteId: row.invite_id,
    ownerUserId: row.owner_user_id,
    inviteeEmail: row.invitee_email,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    status: row.status,
    errorMessage: row.error_message,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export async function listLatestContestWorkspaceInviteDeliveries(input: {
  ownerUserId: string;
  inviteIds: string[];
}) {
  const supabase = getSupabaseServiceClient();

  if (!supabase || input.inviteIds.length === 0) {
    return new Map<string, ContestWorkspaceInviteDelivery>();
  }

  const { data, error } = await supabase
    .from("contest_workspace_invite_deliveries")
    .select(
      "id, invite_id, owner_user_id, invitee_email, provider, provider_message_id, status, error_message, metadata, created_at",
    )
    .eq("owner_user_id", input.ownerUserId)
    .in("invite_id", input.inviteIds)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return new Map<string, ContestWorkspaceInviteDelivery>();
  }

  const latestByInviteId = new Map<string, ContestWorkspaceInviteDelivery>();

  for (const row of data as Array<{
    id: string;
    invite_id: string;
    owner_user_id: string;
    invitee_email: string;
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

    latestByInviteId.set(row.invite_id, normalizeInviteDelivery(row));
  }

  return latestByInviteId;
}

async function sendInviteEmail(input: {
  to: string;
  contestTitle: string;
  role: string;
  inviteUrl: string;
  inviteId: string;
}) {
  const config = getEmailConfig();

  if (!config) {
    throw new Error("Invite email provider is not configured.");
  }

  const subject = `[AI Contest Cloud] ${input.contestTitle} 워크스페이스 초대`;
  const text = [
    `${input.contestTitle} 워크스페이스에 초대되었습니다.`,
    "",
    `역할: ${input.role}`,
    `초대 수락: ${input.inviteUrl}`,
    "",
    "로그인 후 초대를 수락하면 제출 워크스페이스와 팀 준비 상태를 함께 볼 수 있습니다.",
  ].join("\n");

  const html = [
    `<h2 style="margin:0 0 12px;font-size:20px;">${input.contestTitle} 워크스페이스 초대</h2>`,
    `<p style="margin:0 0 12px;">AI Contest Cloud workspace에 초대되었습니다.</p>`,
    `<p style="margin:0 0 16px;">역할: <strong>${input.role}</strong></p>`,
    `<p style="margin:0;"><a href="${input.inviteUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#f5f1e8;color:#1f2937;text-decoration:none;font-weight:600;">초대 수락하기</a></p>`,
  ].join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "Idempotency-Key": `contest-invite:${input.inviteId}:${input.to}`,
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
        { name: "kind", value: "workspace-invite" },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };

  if (!response.ok || typeof payload.id !== "string") {
    throw new Error(payload.message || payload.error || "Invite email send failed.");
  }

  return {
    provider: "resend" as const,
    providerMessageId: payload.id,
  };
}

export async function notifyContestWorkspaceInvite(input: {
  inviteId: string;
  ownerUserId: string;
  contestId: string;
  inviteeEmail: string;
  role: string;
  inviteUrl: string;
}) {
  const config = getEmailConfig();

  if (!config) {
    await insertInviteDeliveryLog({
      inviteId: input.inviteId,
      ownerUserId: input.ownerUserId,
      inviteeEmail: input.inviteeEmail,
      provider: "resend",
      status: "skipped",
      errorMessage: "Invite email provider is not configured.",
      metadata: {
        reason: "missing_email_config",
      },
    });
    return;
  }

  const contest = await getContestById(input.contestId);

  if (!contest) {
    await insertInviteDeliveryLog({
      inviteId: input.inviteId,
      ownerUserId: input.ownerUserId,
      inviteeEmail: input.inviteeEmail,
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
    const delivery = await sendInviteEmail({
      to: input.inviteeEmail,
      contestTitle: contest.title,
      role: input.role,
      inviteUrl: input.inviteUrl,
      inviteId: input.inviteId,
    });

    await insertInviteDeliveryLog({
      inviteId: input.inviteId,
      ownerUserId: input.ownerUserId,
      inviteeEmail: input.inviteeEmail,
      provider: delivery.provider,
      providerMessageId: delivery.providerMessageId,
      status: "sent",
      metadata: {
        contestTitle: contest.title,
        role: input.role,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invite email send failed.";

    await insertInviteDeliveryLog({
      inviteId: input.inviteId,
      ownerUserId: input.ownerUserId,
      inviteeEmail: input.inviteeEmail,
      provider: "resend",
      status: "failed",
      errorMessage: message,
      metadata: {
        contestTitle: contest.title,
        role: input.role,
      },
    });
  }
}
