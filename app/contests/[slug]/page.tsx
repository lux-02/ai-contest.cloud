import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { BadgePill } from "@/components/badge-pill";
import { ContestHeroActions } from "@/components/contest-hero-actions";
import { ContestPoster } from "@/components/contest-poster";
import { ContestPreparationExperience } from "@/components/contest-preparation-experience";
import { JudgingCriteriaChart } from "@/components/judging-criteria-chart";
import { getContestBySlug } from "@/lib/queries";
import { getContestIdeationSession } from "@/lib/server/contest-ideation";
import { registerContestView } from "@/lib/server/contest-metrics";
import { getContestTrackingState } from "@/lib/server/contest-tracking";
import { getViewerSession } from "@/lib/server/viewer-auth";
import {
  formatCategory,
  formatCurrency,
  formatDate,
  formatDeadlineLabel,
  formatDifficulty,
  formatLanguage,
  formatOrganizerType,
  formatMode,
} from "@/lib/utils";
import type { Contest } from "@/types/contest";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] py-4 last:border-none last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="text-sm font-medium text-[var(--muted)]">{label}</dt>
      <dd className="text-sm leading-6 text-[var(--foreground)] sm:max-w-[70%] sm:text-right">{value}</dd>
    </div>
  );
}

function formatTeamValue(contest: Contest) {
  return contest.teamAllowed ? `${contest.minTeamSize} - ${contest.maxTeamSize}명 팀 참가` : "개인 참가";
}

function formatOrganizerTrust(contest: Contest) {
  return contest.organizerType ? formatOrganizerType(contest.organizerType) : "주최 성격 미정";
}

function normalizeDisplayText(text?: string | null) {
  if (!text) {
    return "";
  }

  return text
    .replace(/\r/g, "\n")
    .replace(/([^\n])•\s*/g, "$1\n• ")
    .replace(/^•\s*/g, "• ")
    .replace(/\s+\*\s*/g, "\n* ")
    .replace(/(\d+\.)\s*/g, "\n$1 ")
    .replace(/(\d+\))\s*/g, "\n$1 ")
    .replace(/([.!?])\s*-\s*/g, "$1\n- ")
    .replace(/([^\n])(구글폼 링크:)/g, "$1\n$2")
    .replace(/([^\n])(https?:\/\/)/g, "$1\n$2")
    .replace(/(\[[^\]]+\])/g, "\n$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildContentBlocks(text?: string | null) {
  if (!text) {
    return [];
  }

  return normalizeDisplayText(text)
    .split(/\n+/)
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

function buildCompactSummary(text?: string | null, maxItems = 2) {
  const blocks = buildContentBlocks(text);
  return blocks
    .map((block) => block.replace(/^[-•]\s*/, "").replace(/\s+\*.*$/, "").replace(/\s+\/.*$/, "").trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .join(" / ");
}

function ContentBlocks({ text, emptyText = "내용 미정" }: { text?: string | null; emptyText?: string }) {
  const blocks = buildContentBlocks(text);

  if (blocks.length === 0) {
    return <p className="text-sm leading-6 text-[var(--muted)]">{emptyText}</p>;
  }

  return (
    <div className="space-y-2.5">
      {blocks.map((block) => (
        <p key={block} className="text-sm leading-7 text-[var(--foreground)]">
          {block}
        </p>
      ))}
    </div>
  );
}

export default async function ContestDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [contest, viewerSession] = await Promise.all([getContestBySlug(slug), getViewerSession()]);

  if (!contest) {
    notFound();
  }

  await registerContestView(contest.id);

  const contestMetrics = {
    ...contest,
    viewCount: (contest.viewCount ?? 0) + 1,
  } satisfies Contest;

  const [trackingState, ideationSession] = viewerSession.user
    ? await Promise.all([getContestTrackingState(contest.id), getContestIdeationSession(contestMetrics, viewerSession.user.id)])
    : [null, null];

  return (
    <main className="mx-auto max-w-7xl px-6 pb-20 pt-10">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="surface-card rounded-[34px] p-8 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="eyebrow">대회 브리프</div>
            <ContestHeroActions
              contestId={contestMetrics.id}
              slug={contestMetrics.slug}
              tracking={trackingState}
              isLoggedIn={Boolean(viewerSession.user)}
              viewCount={contestMetrics.viewCount}
              applyCount={contestMetrics.applyCount}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {contestMetrics.aiCategories.map((category) => (
              <span key={category} className="signal-chip">
                <span className="signal-dot" />
                {formatCategory(category)}
              </span>
            ))}
          </div>

          <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)] md:text-6xl">
            {contestMetrics.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">{contestMetrics.shortDescription}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="report-card">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">상금</div>
              <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatCurrency(contestMetrics.prizePoolKrw)}</div>
            </div>
            <div className="report-card">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">마감</div>
              <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatDeadlineLabel(contestMetrics.deadline)}</div>
            </div>
            <div className="report-card">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">방식</div>
              <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatMode(contestMetrics.participationMode)}</div>
            </div>
            <div className="report-card">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">난도</div>
              <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatDifficulty(contestMetrics.difficulty)}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="report-card">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">주최 성격</div>
              <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatOrganizerTrust(contestMetrics)}</div>
            </div>
            <div className="report-card">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">참가 방식</div>
              <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatTeamValue(contestMetrics)}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {contestMetrics.badges.map((badge) => (
              <BadgePill key={badge} badge={badge} />
            ))}
          </div>

          {contestMetrics.analysis.analysisStatus === "pending" ? (
            <div className="mt-8 rounded-[24px] border border-[rgba(255,200,87,0.18)] bg-[rgba(255,200,87,0.08)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">분석 대기 중</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">
                대회 정보는 저장됐고 GPT 분석은 아직 생성되지 않았습니다. 키를 연결하면 추천 이유와 전략이 여기에 채워집니다.
              </p>
            </div>
          ) : contestMetrics.analysis.analysisStatus === "failed" ? (
            <div className="mt-8 rounded-[24px] border border-[rgba(255,125,136,0.18)] bg-[rgba(255,125,136,0.08)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">분석 생성 실패</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">
                대회는 저장됐지만 분석 응답을 만들지 못했습니다. API 응답을 확인한 뒤 다시 생성하면 됩니다.
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-[28px] border border-[var(--border)] bg-[var(--surface-muted)] p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">왜 지금 볼 만한가</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{contestMetrics.analysis.recommendReason}</p>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{contestMetrics.analysis.summary}</p>
            </div>
          )}

          <div className="mt-6 rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">공고 내용 정리</div>
            <div className="mt-4 max-h-[320px] overflow-y-auto pr-1">
              <ContentBlocks text={contestMetrics.description} />
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <aside className="surface-card rounded-[34px] p-8">
            <div className="eyebrow">참가 액션</div>
            <div className="mt-4">
              <ContestPoster contest={contestMetrics} />
            </div>
            <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">{formatDeadlineLabel(contestMetrics.deadline)}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                공고 이미지를 확인한 뒤 바로 신청하고, 아래에서 심사 기준과 접수 항목을 이어서 보면 됩니다.
              </p>
            </div>
            <div className="mt-5">
              <a href={`/contests/${contestMetrics.slug}/apply`} className="primary-button w-full">
                공모전 신청하기
              </a>
            </div>
          </aside>

          <aside className="surface-card rounded-[34px] p-8">
            <div className="eyebrow">지원 판단 체크</div>
            <dl className="mt-4">
              <MetaRow label="마감일" value={formatDate(contestMetrics.deadline)} />
              <MetaRow label="행사일" value={formatDate(contestMetrics.eventDate)} />
              <MetaRow label="진행 방식" value={formatMode(contestMetrics.participationMode)} />
              <MetaRow label="위치" value={contestMetrics.location ?? "미정"} />
              <MetaRow label="상금" value={formatCurrency(contestMetrics.prizePoolKrw)} />
              <MetaRow label="주최 성격" value={formatOrganizerTrust(contestMetrics)} />
              <MetaRow label="팀 구성" value={formatTeamValue(contestMetrics)} />
              <MetaRow label="언어" value={formatLanguage(contestMetrics.language)} />
              <MetaRow label="응모 자격" value={buildCompactSummary(contestMetrics.eligibilityText) || "원문 공고 확인"} />
            </dl>
          </aside>

          <aside className="surface-card rounded-[34px] p-8">
            <div className="eyebrow">단계별 일정</div>
            {contestMetrics.stageSchedule?.length ? (
              <div className="mt-4 space-y-3">
                {contestMetrics.stageSchedule.map((stage) => (
                  <div key={`${stage.label}-${stage.date ?? "none"}`} className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <div className="text-sm font-semibold text-[var(--foreground)]">{stage.label}</div>
                    <div className="mt-2 text-sm text-[var(--foreground)]">{stage.date ? formatDate(stage.date) : "날짜 미정"}</div>
                    {stage.note ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{stage.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">세부 일정은 아직 정리되지 않았습니다. 원문 공고를 같이 확인해 주세요.</p>
            )}
          </aside>
        </div>
      </section>

      <ContestPreparationExperience
        contest={contestMetrics}
        isLoggedIn={Boolean(viewerSession.user)}
        initialSession={ideationSession}
      />

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-card rounded-[32px] p-7">
          <div className="eyebrow">참가 조건 정리</div>

          <div className="mt-8 space-y-5">
            <div>
              <div className="insight-label">참가 대상</div>
              <div className="mt-3">
                <ContentBlocks text={contestMetrics.eligibilityText} />
              </div>
            </div>
            <div>
              <div className="insight-label">접수 항목 / 준비 서류</div>
              {contestMetrics.submissionItems?.length ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--foreground)]">
                  {contestMetrics.submissionItems.map((item) => (
                    <li key={item}>• {item.replace(/^[-•]\s*/, "")}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">접수 항목 정보 미정</p>
              )}
            </div>
            <div>
              <div className="insight-label">제출 형식</div>
              <div className="mt-3">
                <ContentBlocks text={contestMetrics.submissionFormat} emptyText="제출 형식 미정" />
              </div>
            </div>
            <div>
              <div className="insight-label">데이터셋</div>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                {contestMetrics.datasetProvided
                  ? contestMetrics.datasetSummary ?? "데이터셋이 제공됩니다."
                  : contestMetrics.datasetSummary ?? "고정 데이터셋 없이 팀이 문제 구조를 직접 정의합니다."}
              </p>
            </div>
            <div>
              <div className="insight-label">상금 / 보상</div>
              <div className="mt-3">
                <ContentBlocks text={contestMetrics.prizeSummary} emptyText={formatCurrency(contestMetrics.prizePoolKrw)} />
              </div>
            </div>
            <div>
              <div className="insight-label">심사 기준</div>
              <JudgingCriteriaChart criteria={contestMetrics.judgingCriteria ?? []} />
            </div>
            {contestMetrics.pastWinners ? (
              <div>
                <div className="insight-label">과거 수상작 / 참고 사례</div>
                <div className="mt-3">
                  <ContentBlocks text={contestMetrics.pastWinners} />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">AI 분야</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {contestMetrics.aiCategories.map((category) => (
                <span
                  key={category}
                  className="badge-pill border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)]"
                >
                  {formatCategory(category)}
                </span>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--muted)]">{contestMetrics.tags.join(" · ")}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
