import Link from "next/link";
import { notFound } from "next/navigation";

import { BadgePill } from "@/components/badge-pill";
import { ContestPoster } from "@/components/contest-poster";
import { ContestTrackingPanel } from "@/components/contest-tracking-panel";
import { InsightPanel } from "@/components/insight-panel";
import { getContestBySlug } from "@/lib/queries";
import { getContestTrackingState } from "@/lib/server/contest-tracking";
import { getViewerSession } from "@/lib/server/viewer-auth";
import {
  formatCategory,
  formatCurrency,
  formatDate,
  formatDeadlineLabel,
  formatDifficulty,
  formatMode,
} from "@/lib/utils";
import type { Contest } from "@/types/contest";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function MetaRow({ label, value }: { label: string; value: string }) {
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

function buildContentBlocks(text?: string | null) {
  if (!text) {
    return [];
  }

  return text
    .replace(/•\s*/g, "\n• ")
    .replace(/(\d+\))\s+/g, "\n$1 ")
    .replace(/(\d+\.)\s+/g, "\n$1 ")
    .replace(/(\[[^\]]+\])/g, "\n$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n+/)
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
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

  const trackingState = viewerSession.user ? await getContestTrackingState(contest.id) : null;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-20 pt-10">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="surface-card rounded-[34px] p-8 md:p-10">
          <div className="eyebrow">대회 브리프</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {contest.aiCategories.map((category) => (
              <span key={category} className="signal-chip">
                <span className="signal-dot" />
                {formatCategory(category)}
              </span>
            ))}
          </div>

          <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)] md:text-6xl">
            {contest.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted)]">{contest.shortDescription}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="report-card">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">상금</div>
              <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatCurrency(contest.prizePoolKrw)}</div>
            </div>
            <div className="report-card">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">마감</div>
              <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatDeadlineLabel(contest.deadline)}</div>
            </div>
            <div className="report-card">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">방식</div>
              <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatMode(contest.participationMode)}</div>
            </div>
            <div className="report-card">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">난도</div>
              <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatDifficulty(contest.difficulty)}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {contest.badges.map((badge) => (
              <BadgePill key={badge} badge={badge} />
            ))}
          </div>

          {contest.analysis.analysisStatus === "pending" ? (
            <div className="mt-8 rounded-[24px] border border-[rgba(255,200,87,0.18)] bg-[rgba(255,200,87,0.08)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">분석 대기 중</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">
                대회 정보는 저장됐고 GPT 분석은 아직 생성되지 않았습니다. 키를 연결하면 추천 이유와 전략이 여기에 채워집니다.
              </p>
            </div>
          ) : contest.analysis.analysisStatus === "failed" ? (
            <div className="mt-8 rounded-[24px] border border-[rgba(255,125,136,0.18)] bg-[rgba(255,125,136,0.08)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">분석 생성 실패</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">
                대회는 저장됐지만 분석 응답을 만들지 못했습니다. API 응답을 확인한 뒤 다시 생성하면 됩니다.
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-[28px] border border-[var(--border)] bg-[var(--surface-muted)] p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">왜 지금 볼 만한가</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{contest.analysis.recommendReason}</p>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{contest.analysis.summary}</p>
            </div>
          )}

          <div className="mt-6 rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.72)] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">공고 내용 정리</div>
            <div className="mt-4 max-h-[320px] overflow-y-auto pr-1">
              <ContentBlocks text={contest.description} />
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <aside className="surface-card rounded-[34px] p-8">
            <div className="eyebrow">참가 액션</div>
            <div className="mt-4">
              <ContestPoster contest={contest} />
            </div>
            <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">{formatDeadlineLabel(contest.deadline)}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                공고 이미지를 먼저 확인하고 바로 신청한 뒤, 아래 리포트에서 심사 포인트와 준비 순서를 읽을 수 있습니다.
              </p>
            </div>
            <div className="mt-5 grid gap-3">
              <Link
                href={contest.applyUrl ?? contest.url}
                target="_blank"
                rel="noreferrer"
                className="primary-button w-full"
              >
                공모전 신청하기
              </Link>
              <div className="flex flex-wrap gap-3">
                <Link href={contest.url} target="_blank" rel="noreferrer" className="secondary-button flex-1">
                  원문 공고 보기
                </Link>
                {contest.sourceUrl ? (
                  <Link href={contest.sourceUrl} target="_blank" rel="noreferrer" className="secondary-button flex-1">
                    수집 소스 보기
                  </Link>
                ) : null}
              </div>
            </div>
            <ContestTrackingPanel
              contestId={contest.id}
              slug={contest.slug}
              tracking={trackingState}
              isLoggedIn={Boolean(viewerSession.user)}
            />
          </aside>

          <aside className="surface-card rounded-[34px] p-8">
            <div className="eyebrow">지원 판단 체크</div>
            <dl className="mt-4">
              <MetaRow label="마감일" value={formatDate(contest.deadline)} />
              <MetaRow label="행사일" value={formatDate(contest.eventDate)} />
              <MetaRow label="진행 방식" value={formatMode(contest.participationMode)} />
              <MetaRow label="위치" value={contest.location ?? "미정"} />
              <MetaRow label="상금" value={formatCurrency(contest.prizePoolKrw)} />
              <MetaRow label="팀 구성" value={formatTeamValue(contest)} />
              <MetaRow label="언어" value={contest.language} />
            </dl>
          </aside>
        </div>
      </section>

      <section className="mt-8">
        <InsightPanel contest={contest} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-card rounded-[32px] p-7">
          <div className="eyebrow">참가 조건 정리</div>

          <div className="mt-8 space-y-5">
            <div>
              <div className="insight-label">참가 대상</div>
              <div className="mt-3">
                <ContentBlocks text={contest.eligibilityText} />
              </div>
            </div>
            <div>
              <div className="insight-label">제출 형식</div>
              <div className="mt-3">
                <ContentBlocks text={contest.submissionFormat} emptyText="제출 형식 미정" />
              </div>
            </div>
            <div>
              <div className="insight-label">데이터셋</div>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                {contest.datasetProvided
                  ? contest.datasetSummary ?? "데이터셋이 제공됩니다."
                  : contest.datasetSummary ?? "고정 데이터셋 없이 팀이 문제 구조를 직접 정의합니다."}
              </p>
            </div>
            <div>
              <div className="insight-label">상금 / 보상</div>
              <div className="mt-3">
                <ContentBlocks text={contest.prizeSummary} emptyText={formatCurrency(contest.prizePoolKrw)} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">AI 분야</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {contest.aiCategories.map((category) => (
                <span
                  key={category}
                  className="badge-pill border-[var(--border)] bg-white text-[var(--foreground)]"
                >
                  {formatCategory(category)}
                </span>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--muted)]">{contest.tags.join(" · ")}</p>
          </div>

          <div className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">주요 도구 / 스택</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {contest.toolsAllowed.map((tool) => (
                <span
                  key={tool}
                  className="badge-pill border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)]"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>

          <div className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">제출물 힌트</div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--foreground)]">
              <li>데모나 결과물을 한 문장으로 설명할 수 있는 핵심 사용 시나리오를 먼저 정리하세요.</li>
              <li>{contest.submissionFormat ?? "제출 형식은 추후 업데이트될 수 있으니 원문 공고를 같이 확인하세요."}</li>
              <li>{contest.datasetSummary ?? "데이터셋 제공 여부에 따라 직접 수집 범위를 먼저 정하는 편이 안전합니다."}</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
