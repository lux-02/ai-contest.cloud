import Link from "next/link";

import { ContestCard } from "@/components/contest-card";
import { groupTrackedContestsByStatus, getTrackedContestsForViewer } from "@/lib/server/contest-tracking";
import { requireViewerUser } from "@/lib/server/viewer-auth";
import { formatReminderLabel, formatTrackingStatus } from "@/lib/utils";
import type { Contest, ContestTrackingState } from "@/types/contest";

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

export default async function MyPage() {
  const user = await requireViewerUser("/my");
  const entries = await getTrackedContestsForViewer();
  const grouped = groupTrackedContestsByStatus(entries);

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
