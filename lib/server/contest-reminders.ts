import "server-only";

import { randomUUID } from "crypto";

import { formatDate, formatReminderLabel, getDaysUntil } from "@/lib/utils";
import { canUseUpstashRedis, releaseLock, setLock } from "@/lib/server/upstash-redis";
import { getSupabaseServiceClient } from "@/lib/server/supabase";

type ReminderContestRow = {
  id: string;
  slug: string;
  title: string;
  organizer_name?: string | null;
  deadline?: string | null;
};

type ReminderTrackingRow = {
  user_id: string;
  contest_id: string;
  reminder_days_before: number;
  last_reminder_sent_at: string | null;
  contests: ReminderContestRow | ReminderContestRow[] | null;
};

type ReminderDeliveryStatus = "sent" | "failed" | "skipped";

type ReminderDeliveryLog = {
  userId: string;
  contestId: string;
  provider: string;
  status: ReminderDeliveryStatus;
  reminderDaysBefore: number;
  providerMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

export type ContestReminderDrainResult = {
  ok: boolean;
  locked: boolean;
  limit: number;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  breakdown: {
    sent: number;
    failed: number;
    skippedOverLimit: number;
    skippedAlreadySent: number;
    skippedMissingEmail: number;
  };
};

const REMINDER_DRAIN_LOCK_KEY = "contest-reminders:drain";
const REMINDER_DRAIN_LOCK_TTL_SECONDS = 60;

function getReminderEmailConfig() {
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

function normalizeContestRelation(value: ReminderTrackingRow["contests"]): ReminderContestRow | null {
  const target = Array.isArray(value) ? value[0] : value;

  if (!target || typeof target !== "object") {
    return null;
  }

  if (typeof target.id !== "string" || typeof target.slug !== "string" || typeof target.title !== "string") {
    return null;
  }

  return target;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildContestUrl(slug: string) {
  return `${getAppBaseUrl()}/contests/${slug}`;
}

async function insertReminderDeliveryLog(entry: ReminderDeliveryLog) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  await supabase.from("contest_reminder_deliveries").insert({
    user_id: entry.userId,
    contest_id: entry.contestId,
    provider: entry.provider,
    provider_message_id: entry.providerMessageId ?? null,
    status: entry.status,
    reminder_days_before: entry.reminderDaysBefore,
    error_message: entry.errorMessage ?? null,
    metadata: entry.metadata ?? {},
  });
}

async function markReminderSent(userId: string, contestId: string) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  await supabase
    .from("contest_user_tracking")
    .update({
      last_reminder_sent_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("contest_id", contestId);
}

async function getViewerEmail(userId: string) {
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

async function sendReminderEmail(input: {
  to: string;
  contest: ReminderContestRow;
  reminderDaysBefore: number;
}) {
  const config = getReminderEmailConfig();

  if (!config) {
    throw new Error("Reminder email provider is not configured.");
  }

  const contestUrl = buildContestUrl(input.contest.slug);
  const deadlineLabel = input.contest.deadline ? formatDate(input.contest.deadline) : "마감일 미정";
  const subject = `[AI Contest Cloud] ${input.contest.title} ${formatReminderLabel(input.reminderDaysBefore)}`;
  const text = [
    `${input.contest.title} 마감 리마인더`,
    "",
    `${formatReminderLabel(input.reminderDaysBefore)} 기준으로 다시 확인할 시점입니다.`,
    `주최: ${input.contest.organizer_name ?? "주최 정보 확인 필요"}`,
    `마감: ${deadlineLabel}`,
    `상세 보기: ${contestUrl}`,
    "",
    "제출 형식, 팀 구성 요건, AI 사용 가능 여부를 다시 점검한 뒤 전략/워크스페이스를 이어가세요.",
  ].join("\n");

  const html = [
    `<h2 style="margin:0 0 12px;font-size:20px;">${input.contest.title} 마감 리마인더</h2>`,
    `<p style="margin:0 0 12px;">${formatReminderLabel(input.reminderDaysBefore)} 기준으로 다시 확인할 시점입니다.</p>`,
    `<ul style="margin:0 0 16px 18px;padding:0;">`,
    `<li>주최: ${input.contest.organizer_name ?? "주최 정보 확인 필요"}</li>`,
    `<li>마감: ${deadlineLabel}</li>`,
    `</ul>`,
    `<p style="margin:0 0 16px;">제출 형식, 팀 구성 요건, AI 사용 가능 여부를 다시 점검한 뒤 전략/워크스페이스를 이어가세요.</p>`,
    `<p style="margin:0;"><a href="${contestUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#f5f1e8;color:#1f2937;text-decoration:none;font-weight:600;">공모전 다시 열기</a></p>`,
  ].join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "Idempotency-Key": `contest-reminder:${input.contest.id}:${input.to}:${input.reminderDaysBefore}`,
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
        { name: "kind", value: "contest-reminder" },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };

  if (!response.ok || typeof payload.id !== "string") {
    throw new Error(payload.message || payload.error || "Reminder email send failed.");
  }

  return {
    provider: "resend" as const,
    providerMessageId: payload.id,
  };
}

async function listDueReminderCandidates(limit: number) {
  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const fetchSize = Math.max(limit * 6, 24);
  const todayIsoDate = getTodayIsoDate();

  const { data, error } = await supabase
    .from("contest_user_tracking")
    .select("user_id, contest_id, reminder_days_before, last_reminder_sent_at, contests:contest_id(id, slug, title, organizer_name, deadline)")
    .eq("reminder_enabled", true)
    .order("updated_at", { ascending: false })
    .limit(fetchSize);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ReminderTrackingRow[])
    .map((row) => {
      const contest = normalizeContestRelation(row.contests);

      if (!contest?.deadline) {
        return null;
      }

      const daysUntilDeadline = getDaysUntil(contest.deadline);

      if (daysUntilDeadline !== row.reminder_days_before) {
        return null;
      }

      if (row.last_reminder_sent_at?.slice(0, 10) === todayIsoDate) {
        return {
          type: "already-sent" as const,
          row,
          contest,
        };
      }

      return {
        type: "due" as const,
        row,
        contest,
      };
    })
    .flatMap((entry) => (entry ? [entry] : []));
}

export async function drainContestReminderEmails(options?: { limit?: number }): Promise<ContestReminderDrainResult> {
  const limit = Number.isFinite(options?.limit) ? Math.min(Math.max(Math.floor(options?.limit ?? 1), 1), 50) : 20;
  if (!getReminderEmailConfig()) {
    throw new Error("Reminder email provider is not configured.");
  }

  const lockValue = randomUUID();
  const useRedisLock = canUseUpstashRedis();
  const locked = useRedisLock ? await setLock(REMINDER_DRAIN_LOCK_KEY, lockValue, REMINDER_DRAIN_LOCK_TTL_SECONDS) : true;

  if (!locked) {
    return {
      ok: true,
      locked: true,
      limit,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      breakdown: {
        sent: 0,
        failed: 0,
        skippedOverLimit: 0,
        skippedAlreadySent: 0,
        skippedMissingEmail: 0,
      },
    };
  }

  const result: ContestReminderDrainResult = {
    ok: true,
    locked: false,
    limit,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    breakdown: {
      sent: 0,
      failed: 0,
      skippedOverLimit: 0,
      skippedAlreadySent: 0,
      skippedMissingEmail: 0,
    },
  };

  try {
    const candidates = await listDueReminderCandidates(limit);
    const dueCandidates = candidates.filter((candidate) => candidate.type === "due").slice(0, limit);

    for (const candidate of candidates) {
      if (candidate.type === "already-sent") {
        result.skipped += 1;
        result.breakdown.skippedAlreadySent += 1;
      }
    }

    for (const candidate of dueCandidates) {
      const email = await getViewerEmail(candidate.row.user_id).catch(() => null);

      if (!email) {
        result.processed += 1;
        result.skipped += 1;
        result.breakdown.skippedMissingEmail += 1;
        await insertReminderDeliveryLog({
          userId: candidate.row.user_id,
          contestId: candidate.row.contest_id,
          provider: "resend",
          status: "skipped",
          reminderDaysBefore: candidate.row.reminder_days_before,
          errorMessage: "Viewer email is unavailable.",
          metadata: {
            reason: "missing_email",
          },
        });
        continue;
      }

      try {
        const delivery = await sendReminderEmail({
          to: email,
          contest: candidate.contest,
          reminderDaysBefore: candidate.row.reminder_days_before,
        });

        await markReminderSent(candidate.row.user_id, candidate.row.contest_id);
        await insertReminderDeliveryLog({
          userId: candidate.row.user_id,
          contestId: candidate.row.contest_id,
          provider: delivery.provider,
          providerMessageId: delivery.providerMessageId,
          status: "sent",
          reminderDaysBefore: candidate.row.reminder_days_before,
          metadata: {
            email,
            contestSlug: candidate.contest.slug,
          },
        });

        result.processed += 1;
        result.sent += 1;
        result.breakdown.sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Reminder email send failed.";

        await insertReminderDeliveryLog({
          userId: candidate.row.user_id,
          contestId: candidate.row.contest_id,
          provider: "resend",
          status: "failed",
          reminderDaysBefore: candidate.row.reminder_days_before,
          errorMessage: message,
          metadata: {
            email,
            contestSlug: candidate.contest.slug,
          },
        });

        result.processed += 1;
        result.failed += 1;
        result.breakdown.failed += 1;
      }
    }

    const unsentDueCount = candidates.filter((candidate) => candidate.type === "due").length - dueCandidates.length;

    if (unsentDueCount > 0) {
      result.skipped += unsentDueCount;
      result.breakdown.skippedOverLimit += unsentDueCount;
    }

    return result;
  } finally {
    if (useRedisLock) {
      await releaseLock(REMINDER_DRAIN_LOCK_KEY, lockValue);
    }
  }
}
