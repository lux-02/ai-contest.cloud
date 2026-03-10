import Link from "next/link";

import { BadgePill } from "@/components/badge-pill";
import {
  cn,
  formatCategory,
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatDeadlineLabel,
  formatDifficulty,
  formatMode,
  formatOrganizerType,
} from "@/lib/utils";
import type { Contest } from "@/types/contest";

interface ContestCardProps {
  contest: Contest;
}

export function ContestCard({ contest }: ContestCardProps) {
  const visibleBadges = contest.badges.slice(0, 3);
  const hiddenBadgeCount = Math.max(contest.badges.length - visibleBadges.length, 0);
  const judgingPreview = contest.judgingCriteria?.slice(0, 2) ?? [];
  const submissionPreview = contest.submissionItems?.slice(0, 2) ?? [];

  return (
    <Link href={`/contests/${contest.slug}`} className="contest-card group block">
      <div className="grid gap-5 md:grid-cols-[148px_1fr]">
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">마감</div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
            {formatDeadlineLabel(contest.deadline)}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">{formatDate(contest.deadline)}</div>

          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">상금</div>
            <div className="mt-2 text-base font-semibold text-[var(--foreground)]">{formatCurrency(contest.prizePoolKrw)}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="stat-pill">{formatMode(contest.participationMode)}</span>
            <span className="stat-pill">{formatDifficulty(contest.difficulty)}</span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--muted)]">{contest.organizer}</span>
            {contest.organizerType ? (
              <>
                <span className="h-1 w-1 rounded-full bg-[rgba(245,241,232,0.2)]" />
                <span className="text-sm text-[var(--foreground)]">{formatOrganizerType(contest.organizerType)}</span>
              </>
            ) : null}
            <span className="h-1 w-1 rounded-full bg-[rgba(245,241,232,0.2)]" />
            <span className="text-sm text-[var(--muted)]">
              {contest.teamAllowed ? `${contest.minTeamSize}-${contest.maxTeamSize}명 팀` : "개인 참가"}
            </span>
          </div>

          <h3 className="mt-3 max-w-4xl text-[1.85rem] font-semibold tracking-[-0.05em] text-[var(--foreground)] transition group-hover:text-[var(--accent-strong)]">
            {contest.title}
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">{contest.shortDescription}</p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--foreground)]">{contest.analysis.summary || contest.analysis.recommendReason}</p>

          {submissionPreview.length > 0 || judgingPreview.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {submissionPreview.length > 0 ? (
                <div className="rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">준비물</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{submissionPreview.join(" · ")}</p>
                </div>
              ) : null}
              {judgingPreview.length > 0 ? (
                <div className="rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">심사 포인트</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                    {judgingPreview
                      .map((criterion) =>
                        typeof criterion.weight === "number" ? `${criterion.label} ${criterion.weight}%` : criterion.label,
                      )
                      .join(" · ")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {visibleBadges.map((badge) => (
              <BadgePill key={badge} badge={badge} />
            ))}
            {hiddenBadgeCount > 0 ? (
              <span className="badge-pill border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)]">+{hiddenBadgeCount}</span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-wrap gap-2 text-xs font-medium text-[var(--muted)]">
              {contest.aiCategories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]"
                >
                  {formatCategory(category)}
                </span>
              ))}
            </div>
            <div className={cn("space-y-1 text-sm", "md:max-w-[42%] md:text-right")}>
              <div className="font-semibold text-[var(--foreground)]">우승 전략 리포트 보기</div>
              <div className="text-xs leading-6 text-[var(--muted)]">
                조회 {formatCompactNumber(contest.viewCount)} · 지원 {formatCompactNumber(contest.applyCount)}
              </div>
              <div className="text-xs leading-6 text-[var(--muted)]">{contest.tags.slice(0, 4).join(" · ")}</div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
