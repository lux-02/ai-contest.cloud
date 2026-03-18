import Link from "next/link";

import { ContestCard } from "@/components/contest-card";
import { getStrengthBasedContestRecommendations } from "@/lib/server/contest-recommendations";
import {
  listContestWorkspaceMembershipsForViewer,
  listPendingContestWorkspaceInvitesForViewer,
} from "@/lib/server/contest-workspace-access";
import { getContestWorkspaceSnapshot } from "@/lib/server/contest-workspace";
import { groupTrackedContestsByStatus, getTrackedContestsForViewer } from "@/lib/server/contest-tracking";
import { requireViewerUser } from "@/lib/server/viewer-auth";
import {
  formatCategory,
  formatDate,
  formatDeadlineLabel,
  formatDifficulty,
  formatOrganizerType,
  formatReminderLabel,
  formatTrackingStatus,
  getDaysUntil,
} from "@/lib/utils";
import type {
  Contest,
  ContestRecommendationSnapshot,
  ContestWorkspaceInviteInboxEntry,
  ContestWorkspaceMembershipSummary,
  ContestWorkspaceSnapshot,
  ContestStrengthConfidence,
  ContestTeamPreference,
  ContestTrackingState,
} from "@/types/contest";

const RECENT_SIGNAL_WINDOW_DAYS = 3;
const DEADLINE_WARNING_WINDOW_DAYS = 7;

function isRecentTimestamp(value?: string, windowDays = RECENT_SIGNAL_WINDOW_DAYS) {
  if (!value) {
    return false;
  }

  const now = Date.now();
  const target = new Date(value).getTime();

  if (Number.isNaN(target)) {
    return false;
  }

  return now - target <= windowDays * 24 * 60 * 60 * 1000;
}

function isUnreadSignalSince(input: {
  lastViewedAt?: string | null;
  signalAt?: string | null;
}) {
  if (!input.signalAt) {
    return false;
  }

  if (!input.lastViewedAt) {
    return true;
  }

  const signalTime = new Date(input.signalAt).getTime();
  const lastViewedTime = new Date(input.lastViewedAt).getTime();

  if (Number.isNaN(signalTime) || Number.isNaN(lastViewedTime)) {
    return false;
  }

  return signalTime > lastViewedTime;
}

function TrackingSection({
  title,
  body,
  entries,
}: {
  title: string;
  body: string;
  entries: Array<{ contest: Contest; tracking: ContestTrackingState }>;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
        </div>
        <div className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)]">
          {entries.length}
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="mt-5 grid gap-5">
          {entries.map(({ contest, tracking }) => (
            <div key={contest.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {tracking.status ? (
                  <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 font-semibold text-[var(--foreground)]">
                    {formatTrackingStatus(tracking.status)}
                  </span>
                ) : null}
                {tracking.reminderEnabled ? (
                  <span className="rounded-full border border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] px-3 py-1.5 font-semibold text-[var(--success)]">
                    {formatReminderLabel(tracking.reminderDaysBefore)}
                  </span>
                ) : null}
                {tracking.lastReminderSentAt ? (
                  <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 font-semibold text-[var(--muted)]">
                    최근 발송 {formatDate(tracking.lastReminderSentAt)}
                  </span>
                ) : null}
              </div>
              <ContestCard contest={contest} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-6 text-sm leading-6 text-[var(--muted)]">
          아직 저장한 대회가 없습니다. 마음에 드는 공모전에서 상태를 먼저 남겨보세요.
        </div>
      )}
    </section>
  );
}

function formatStrengthConfidence(confidence: ContestStrengthConfidence) {
  if (confidence === "strong") {
    return "신호 강함";
  }

  if (confidence === "growing") {
    return "신호 축적 중";
  }

  return "초기 신호";
}

function formatTeamPreference(teamPreference: ContestTeamPreference) {
  if (teamPreference === "team") {
    return "팀전 강점";
  }

  if (teamPreference === "individual") {
    return "개인전 강점";
  }

  return "개인전·팀전 혼합";
}

function RecommendationSection({ snapshot }: { snapshot: ContestRecommendationSnapshot }) {
  if (!snapshot.profile) {
    return (
      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">강점 기반 추천</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Saved, Planning, Applied 기록이 쌓이면 내가 상대적으로 잘 풀어온 공모전 패턴을 기준으로 추천을 계산합니다.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-6 text-sm leading-6 text-[var(--muted)]">
          아직 추천을 계산할 활동 신호가 부족합니다. 공모전 상태를 한두 개만 저장해도 개인화 추천이 열립니다.
        </div>
      </section>
    );
  }

  const { profile, recommendations } = snapshot;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">강점 기반 추천</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            저장한 공모전, 준비 상태, 아이데이션과 팀 진행 흔적을 바탕으로 지금 이길 확률이 더 높은 대회를 추렸습니다.
          </p>
        </div>
        <div className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)]">
          {recommendations.length}
        </div>
      </div>

      <div className="mt-5 rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-6">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] px-3 py-1.5 font-semibold text-[var(--success)]">
            {formatStrengthConfidence(profile.confidence)}
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]">
            실행 준비도 {profile.executionReadiness}점
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]">
            {formatTeamPreference(profile.teamPreference)}
          </span>
          {profile.preferredDifficulty ? (
            <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]">
              선호 난이도 {formatDifficulty(profile.preferredDifficulty)}
            </span>
          ) : null}
          {profile.preferredOrganizerType ? (
            <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]">
              선호 주최사 {formatOrganizerType(profile.preferredOrganizerType)}
            </span>
          ) : null}
          {profile.topCategories.map((category) => (
            <span
              key={category}
              className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]"
            >
              {formatCategory(category)}
            </span>
          ))}
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--foreground)]">{profile.summary}</p>
        <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
          최근 활동 {profile.sourceContestCount}건 중 깊게 분석된 신호 {profile.deepSignalCount}건을 반영했습니다.
        </p>
      </div>

      {recommendations.length > 0 ? (
        <div className="mt-5 grid gap-5">
          {recommendations.map((recommendation) => (
            <div key={recommendation.contest.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] px-3 py-1.5 font-semibold text-[var(--success)]">
                  {recommendation.fitLabel}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 font-semibold text-[var(--foreground)]">
                  추천 점수 {recommendation.score}
                </span>
                {recommendation.reasons.map((reason) => (
                  <span
                    key={`${recommendation.contest.id}-${reason}`}
                    className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--muted)]"
                  >
                    {reason}
                  </span>
                ))}
              </div>
              <ContestCard contest={recommendation.contest} />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-6 text-sm leading-6 text-[var(--muted)]">
          현재 보유한 신호와 맞는 신규 공모전이 충분하지 않습니다. Saved/Planning 상태를 더 쌓거나 카테고리 필터를 넓혀 다시
          확인해보세요.
        </div>
      )}
    </section>
  );
}

type SharedWorkspaceEntry = ContestWorkspaceMembershipSummary & {
  preview: {
    label: string;
    detail: string;
    updatedAt: string;
    tone: "success" | "neutral";
  } | null;
  stats: {
    readyChecklistCount: number;
    warningChecklistCount: number;
    reviewCount: number;
    readinessScore: number | null;
  };
  hasUnreadActivity: boolean;
  attention: {
    label: string;
    detail: string;
    tone: "success" | "warning" | "neutral";
  } | null;
};

function buildSharedWorkspacePreview(snapshot: ContestWorkspaceSnapshot | null) {
  if (!snapshot) {
    return null;
  }

  const latestReview = snapshot.reviewNotes[0] ?? null;
  const latestTeamEvent = snapshot.teamSnapshot?.teamSession.activityEvents[0] ?? null;
  const candidates = [
    latestReview
      ? {
          updatedAt: latestReview.createdAt,
          label: "새 리뷰",
          detail: `${latestReview.reviewerLabel}${latestReview.reviewerRole ? ` · ${latestReview.reviewerRole}` : ""}: ${latestReview.note}`,
          tone: "neutral" as const,
        }
      : null,
    latestTeamEvent
      ? {
          updatedAt: latestTeamEvent.createdAt,
          label: latestTeamEvent.source === "ai" ? "AI 팀 활동" : latestTeamEvent.source === "user" ? "팀 액션" : "시스템",
          detail: latestTeamEvent.detail ?? latestTeamEvent.title,
          tone: latestTeamEvent.state === "completed" ? ("success" as const) : ("neutral" as const),
        }
      : null,
  ]
    .flatMap((item) => (item ? [item] : []))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  return candidates[0] ?? null;
}

function buildSharedWorkspaceAttention(input: {
  contest: Contest;
  preview: SharedWorkspaceEntry["preview"];
  stats: SharedWorkspaceEntry["stats"];
  hasUnreadActivity: boolean;
}) {
  if (input.stats.warningChecklistCount > 0) {
    return {
      label: "재확인 필요",
      detail: `제출 전 다시 확인할 체크리스트 ${input.stats.warningChecklistCount}개`,
      tone: "warning" as const,
    };
  }

  if (input.preview?.label === "새 리뷰" && input.hasUnreadActivity) {
    return {
      label: "미확인 리뷰",
      detail: "마지막으로 본 이후 새 피드백이 들어왔습니다.",
      tone: "neutral" as const,
    };
  }

  if (input.preview?.label === "AI 팀 활동" || input.preview?.label === "팀 액션") {
    if (input.hasUnreadActivity) {
      return {
        label: "미확인 활동",
        detail: "마지막으로 본 이후 팀 대시보드에 새 진행 상황이 있습니다.",
        tone: "success" as const,
      };
    }
  }

  const daysUntilDeadline = getDaysUntil(input.contest.deadline);

  if (daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= DEADLINE_WARNING_WINDOW_DAYS) {
    return {
      label: "마감 임박",
      detail: formatDeadlineLabel(input.contest.deadline),
      tone: "warning" as const,
    };
  }

  return null;
}

function buildInviteAttention(entry: ContestWorkspaceInviteInboxEntry) {
  const daysUntilDeadline = getDaysUntil(entry.contest.deadline);

  if (daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= DEADLINE_WARNING_WINDOW_DAYS) {
    return {
      label: "마감 임박",
      detail: formatDeadlineLabel(entry.contest.deadline),
      tone: "warning" as const,
    };
  }

  if (isRecentTimestamp(entry.createdAt)) {
    return {
      label: "새 초대",
      detail: "최근에 도착한 워크스페이스 초대입니다.",
      tone: "success" as const,
    };
  }

  return {
    label: "합류 가능",
    detail: "지금 바로 수락해서 워크스페이스에 참여할 수 있습니다.",
    tone: "neutral" as const,
  };
}

function SharedWorkspaceSection({ entries }: { entries: SharedWorkspaceEntry[] }) {
  const attentionCount = entries.filter((entry) => entry.attention).length;
  const unreadCount = entries.filter((entry) => entry.hasUnreadActivity).length;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">공유 워크스페이스</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            owner가 초대한 공모전 워크스페이스입니다. 여기서 바로 공동 작업 화면으로 다시 들어갈 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unreadCount ? (
            <div className="rounded-full border border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] px-3 py-1.5 text-sm font-semibold text-[var(--success)]">
              미확인 {unreadCount}
            </div>
          ) : null}
          {attentionCount ? (
            <div className="rounded-full border border-[rgba(217,119,6,0.24)] bg-[rgba(217,119,6,0.12)] px-3 py-1.5 text-sm font-semibold text-[rgb(255,211,146)]">
              확인 필요 {attentionCount}
            </div>
          ) : null}
          <div className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)]">
            {entries.length}
          </div>
        </div>
      </div>

      {entries.length ? (
        <div className="mt-5 grid gap-5">
          {entries.map((entry) => (
            <div key={`${entry.contest.id}-${entry.ideationSessionId}`} className="rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full border border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] px-3 py-1.5 font-semibold text-[var(--success)]">
                      {entry.role}
                    </span>
                    {entry.hasUnreadActivity ? (
                      <span className="rounded-full border border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] px-3 py-1.5 font-semibold text-[var(--success)]">
                        미확인
                      </span>
                    ) : null}
                    {entry.attention ? (
                      <span
                        className={`rounded-full border px-3 py-1.5 font-semibold ${
                          entry.attention.tone === "warning"
                            ? "border-[rgba(217,119,6,0.24)] bg-[rgba(217,119,6,0.12)] text-[rgb(255,211,146)]"
                            : entry.attention.tone === "success"
                              ? "border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] text-[var(--success)]"
                              : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)]"
                        }`}
                      >
                        {entry.attention.label}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--muted)]">
                      최근 업데이트 {formatDate(entry.updatedAt)}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{entry.contest.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{entry.contest.shortDescription}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]">
                      체크리스트 준비 {entry.stats.readyChecklistCount}
                    </span>
                    <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]">
                      재확인 {entry.stats.warningChecklistCount}
                    </span>
                    <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]">
                      리뷰 {entry.stats.reviewCount}
                    </span>
                    {entry.stats.readinessScore !== null ? (
                      <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]">
                        팀 준비도 {entry.stats.readinessScore}%
                      </span>
                    ) : null}
                  </div>
                  {entry.preview ? (
                    <div className="mt-4 rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-full border px-3 py-1 font-semibold ${
                            entry.preview.tone === "success"
                              ? "border-[rgba(126,211,170,0.18)] bg-[rgba(126,211,170,0.08)] text-[rgb(204,244,222)]"
                              : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)]"
                          }`}
                        >
                          {entry.preview.label}
                        </span>
                        <span className="uppercase tracking-[0.14em] text-[var(--muted)]">
                          {formatDate(entry.preview.updatedAt)}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{entry.preview.detail}</p>
                    </div>
                  ) : null}
                  {entry.attention ? (
                    <p className="mt-3 text-xs leading-6 text-[var(--muted)]">{entry.attention.detail}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href={`/workspace/${entry.contest.id}?session=${entry.ideationSessionId}`} className="primary-button">
                    워크스페이스 열기
                  </Link>
                  <a
                    href={`/api/workspace/${entry.contest.id}/package?session=${entry.ideationSessionId}`}
                    className="secondary-button"
                  >
                    제출 패키지
                  </a>
                  <Link href={`/team/${entry.contest.id}?session=${entry.ideationSessionId}`} className="secondary-button">
                    팀 대시보드
                  </Link>
                  <Link href={`/contests/${entry.contest.slug}`} className="secondary-button">
                    공모전 보기
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-6 text-sm leading-6 text-[var(--muted)]">
          아직 초대받은 공유 워크스페이스가 없습니다.
        </div>
      )}
    </section>
  );
}

function InviteInboxSection({ entries }: { entries: ContestWorkspaceInviteInboxEntry[] }) {
  const recentCount = entries.filter((entry) => isRecentTimestamp(entry.createdAt)).length;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">수락 가능한 초대</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            현재 로그인한 이메일로 도착한 워크스페이스 초대입니다. 메일을 놓쳤더라도 여기서 바로 합류할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {recentCount ? (
            <div className="rounded-full border border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] px-3 py-1.5 text-sm font-semibold text-[var(--success)]">
              새 초대 {recentCount}
            </div>
          ) : null}
          <div className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)]">
            {entries.length}
          </div>
        </div>
      </div>

      {entries.length ? (
        <div className="mt-5 grid gap-5">
          {entries.map((entry) => {
            const attention = buildInviteAttention(entry);

            return (
              <div key={entry.inviteId} className="rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full border border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] px-3 py-1.5 font-semibold text-[var(--success)]">
                        {entry.role}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1.5 font-semibold ${
                          attention.tone === "warning"
                            ? "border-[rgba(217,119,6,0.24)] bg-[rgba(217,119,6,0.12)] text-[rgb(255,211,146)]"
                            : attention.tone === "success"
                              ? "border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] text-[var(--success)]"
                              : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)]"
                        }`}
                      >
                        {attention.label}
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--muted)]">
                        초대 생성 {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{entry.contest.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{entry.contest.shortDescription}</p>
                    <p className="mt-3 text-xs leading-6 text-[var(--muted)]">{attention.detail}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link href={`/invite/${entry.inviteToken}`} className="primary-button">
                      초대 수락
                    </Link>
                    <Link href={`/contests/${entry.contest.slug}`} className="secondary-button">
                      공모전 보기
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default async function MyPage() {
  const user = await requireViewerUser("/my");
  const [entries, sharedWorkspaces, pendingInvites] = await Promise.all([
    getTrackedContestsForViewer(),
    listContestWorkspaceMembershipsForViewer(user.id),
    user.email ? listPendingContestWorkspaceInvitesForViewer(user.email) : Promise.resolve([]),
  ]);
  const sharedWorkspaceEntries = await Promise.all(
    sharedWorkspaces.map(async (entry) => {
      const snapshot = await getContestWorkspaceSnapshot(entry.contest.id, entry.ideationSessionId, user.id);
      const stats = {
        readyChecklistCount: snapshot?.submissionPackage.checklist.filter((item) => item.state === "ready").length ?? 0,
        warningChecklistCount: snapshot?.submissionPackage.checklist.filter((item) => item.state === "warning").length ?? 0,
        reviewCount: snapshot?.reviewNotes.length ?? 0,
        readinessScore: snapshot?.teamSnapshot?.teamSession.readinessScore ?? null,
      };
      const preview = buildSharedWorkspacePreview(snapshot);
      const hasUnreadActivity = isUnreadSignalSince({
        lastViewedAt: entry.lastViewedAt,
        signalAt: preview?.updatedAt ?? entry.updatedAt,
      });

      return {
        ...entry,
        preview,
        stats,
        hasUnreadActivity,
        attention: buildSharedWorkspaceAttention({
          contest: entry.contest,
          preview,
          stats,
          hasUnreadActivity,
        }),
      } satisfies SharedWorkspaceEntry;
    }),
  );
  const actionRequiredCount =
    pendingInvites.length + sharedWorkspaceEntries.filter((entry) => entry.attention !== null).length;
  const grouped = groupTrackedContestsByStatus(entries);
  const recommendationSnapshot = await getStrengthBasedContestRecommendations(entries, user.id);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-10">
      <section className="surface-card rounded-[34px] p-8 md:p-10">
        <div className="eyebrow">내 활동</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
          저장한 대회와 신청 흐름을 한 화면에서 확인하세요.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
          {user.email ?? "로그인한 사용자"} 계정으로 저장한 AI 공모전을 정리했습니다. 상태별로 나눠 보고, reminder를 켠 대회도 함께
          확인할 수 있습니다.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/contests" className="primary-button">
            새 공모전 탐색하기
          </Link>
          <Link href="/" className="secondary-button">
            홈으로 돌아가기
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-6">
          {[
            ["Saved", grouped.saved.length],
            ["Planning", grouped.planning.length],
            ["Applied", grouped.applied.length],
            ["Reminder On", grouped.reminders.length],
            ["Shared", sharedWorkspaces.length],
            ["Needs Action", actionRequiredCount],
          ].map(([label, count]) => (
            <div key={label} className="hero-metric">
              <div className="text-3xl font-semibold tracking-[-0.04em]">{count}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <InviteInboxSection entries={pendingInvites} />
      <SharedWorkspaceSection entries={sharedWorkspaceEntries} />
      <RecommendationSection snapshot={recommendationSnapshot} />
      <TrackingSection title="Saved" body="일단 눈여겨보는 대회들입니다." entries={grouped.saved} />
      <TrackingSection title="Planning" body="준비를 시작했고 일정 조율이 필요한 대회들입니다." entries={grouped.planning} />
      <TrackingSection title="Applied" body="이미 신청했거나 제출 진행 중인 대회들입니다." entries={grouped.applied} />
      <TrackingSection
        title="마감 reminder"
        body="마감 전 알림을 켜둔 대회입니다."
        entries={grouped.reminders}
      />
    </main>
  );
}
