import Link from "next/link";

import { ContestCard } from "@/components/contest-card";
import { getStrengthBasedContestRecommendations } from "@/lib/server/contest-recommendations";
import { groupTrackedContestsByStatus, getTrackedContestsForViewer } from "@/lib/server/contest-tracking";
import { requireViewerUser } from "@/lib/server/viewer-auth";
import {
  formatCategory,
  formatDate,
  formatDifficulty,
  formatOrganizerType,
  formatReminderLabel,
  formatTrackingStatus,
} from "@/lib/utils";
import type {
  Contest,
  ContestRecommendationSnapshot,
  ContestStrengthConfidence,
  ContestTeamPreference,
  ContestTrackingState,
} from "@/types/contest";

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

export default async function MyPage() {
  const user = await requireViewerUser("/my");
  const entries = await getTrackedContestsForViewer();
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

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["Saved", grouped.saved.length],
            ["Planning", grouped.planning.length],
            ["Applied", grouped.applied.length],
            ["Reminder On", grouped.reminders.length],
          ].map(([label, count]) => (
            <div key={label} className="hero-metric">
              <div className="text-3xl font-semibold tracking-[-0.04em]">{count}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{label}</div>
            </div>
          ))}
        </div>
      </section>

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
