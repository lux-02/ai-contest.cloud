import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  FaArrowRight,
  FaBullseye,
  FaCircleCheck,
  FaClock,
  FaFileLines,
  FaTrophy,
  FaWandMagicSparkles,
} from "react-icons/fa6";

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
import type { Contest, ContestJudgingCriterion } from "@/types/contest";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function cleanLine(text: string) {
  return text.replace(/^[-•*]\s*/, "").replace(/\s{2,}/g, " ").trim();
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

function uniqueLines(items: string[]) {
  return Array.from(
    new Map(
      items
        .map((item) => cleanLine(item))
        .filter(Boolean)
        .map((item) => [item.toLowerCase(), item]),
    ).values(),
  );
}

function buildCompactSummary(text?: string | null, maxItems = 2) {
  return uniqueLines(
    buildContentBlocks(text).map((block) => block.replace(/\s+\*.*$/, "").replace(/\s+\/.*$/, "").trim()),
  )
    .slice(0, maxItems)
    .join(" / ");
}

function buildEligibilityHighlights(contest: Contest, maxItems = 3) {
  return uniqueLines(
    buildContentBlocks(contest.eligibilityText).map((line) =>
      line
        .replace(/^(\d+\.|\d+\))\s*/, "")
        .replace(/\s+\*.*$/, "")
        .replace(/\s+\/.*$/, "")
        .trim(),
    ),
  ).slice(0, maxItems);
}

function formatApplyChannel(url?: string | null) {
  if (!url) {
    return "신청 링크 미정";
  }

  const normalized = url.toLowerCase();

  if (normalized.includes("forms.gle") || normalized.includes("docs.google.com/forms")) {
    return "구글폼 제출";
  }

  if (normalized.includes("devpost.com")) {
    return "Devpost 제출";
  }

  if (normalized.includes("kaggle.com")) {
    return "Kaggle 제출";
  }

  if (normalized.includes("notion")) {
    return "노션 접수";
  }

  return "외부 링크 접수";
}

function buildSubmissionHighlights(contest: Contest, maxItems = 4) {
  return uniqueLines([
    formatApplyChannel(contest.applyUrl),
    ...(contest.submissionItems ?? []),
    ...buildContentBlocks(contest.submissionFormat),
  ]).slice(0, maxItems);
}

function sortJudgingCriteria(criteria: ContestJudgingCriterion[] = []) {
  return [...criteria].sort((left, right) => (right.weight ?? 0) - (left.weight ?? 0));
}

function buildJudgingHighlights(contest: Contest, maxItems = 3) {
  return sortJudgingCriteria(contest.judgingCriteria).map((criterion) => {
    const weight = criterion.weight ? ` ${criterion.weight}%` : "";
    return `${criterion.label}${weight}`;
  }).slice(0, maxItems);
}

function buildRewardHighlights(contest: Contest, maxItems = 4) {
  const rewardLines = uniqueLines(buildContentBlocks(contest.prizeSummary));

  if (rewardLines.length > 0) {
    return rewardLines.slice(0, maxItems);
  }

  return [formatCurrency(contest.prizePoolKrw)];
}

function hasStandaloneSubmissionFormat(contest: Contest) {
  const formatLines = uniqueLines(buildContentBlocks(contest.submissionFormat));
  const itemLines = uniqueLines(contest.submissionItems ?? []);

  if (formatLines.length === 0) {
    return false;
  }

  if (itemLines.length === 0) {
    return true;
  }

  return formatLines.some((line) => !itemLines.some((item) => item.toLowerCase() === line.toLowerCase()));
}

function formatTeamValue(contest: Contest) {
  return contest.teamAllowed ? `${contest.minTeamSize} - ${contest.maxTeamSize}명 팀 참가` : "개인 참가";
}

function formatOrganizerTrust(contest: Contest) {
  return contest.organizerType ? formatOrganizerType(contest.organizerType) : "주최 성격 미정";
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

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-card">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function QuickScanCard({
  icon,
  eyebrow,
  title,
  items,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        <span className="text-[var(--foreground)]">{icon}</span>
        {eyebrow}
      </div>
      <div className="mt-3 text-base font-semibold text-[var(--foreground)]">{title}</div>
      <ul className="mt-4 space-y-2.5 text-sm leading-6 text-[var(--muted)]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-[0.45rem] inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(245,241,232,0.7)]" />
            <span className="keep-all">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickCheckRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function SectionJumpLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="chip-nowrap inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[rgba(245,241,232,0.2)] hover:bg-[rgba(255,255,255,0.06)]"
    >
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[rgba(245,241,232,0.7)]" />
      {label}
    </a>
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

  const eligibilityHighlights = buildEligibilityHighlights(contestMetrics);
  const submissionHighlights = buildSubmissionHighlights(contestMetrics);
  const judgingHighlights = buildJudgingHighlights(contestMetrics);
  const rewardHighlights = buildRewardHighlights(contestMetrics);
  const showStandaloneSubmissionFormat = hasStandaloneSubmissionFormat(contestMetrics);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-32 pt-10 md:pb-20">
      <section id="overview" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
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
            {contestMetrics.badges.map((badge) => (
              <BadgePill key={badge} badge={badge} />
            ))}
          </div>

          <h1 className="text-balance mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.06em] text-[var(--foreground)] md:text-6xl">
            {contestMetrics.title}
          </h1>
          <p className="text-pretty mt-5 max-w-3xl text-base leading-8 text-[var(--muted)] md:text-lg">
            {contestMetrics.shortDescription}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <HeroStat label="상금" value={formatCurrency(contestMetrics.prizePoolKrw)} />
            <HeroStat label="마감" value={formatDeadlineLabel(contestMetrics.deadline)} />
            <HeroStat label="주최 성격" value={formatOrganizerTrust(contestMetrics)} />
            <HeroStat label="참가 방식" value={formatTeamValue(contestMetrics)} />
            <HeroStat label="진행 방식" value={formatMode(contestMetrics.participationMode)} />
            <HeroStat label="언어" value={formatLanguage(contestMetrics.language)} />
          </div>

          <div className="mt-8 rounded-[28px] border border-[var(--border)] bg-[var(--surface-muted)] p-6">
            <div className="eyebrow">지원 전에 먼저 볼 것</div>
            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <QuickScanCard
                icon={<FaWandMagicSparkles className="h-3.5 w-3.5" aria-hidden />}
                eyebrow="누가 지원하기 좋은가"
                title="지원 대상과 난도를 먼저 확인하세요."
                items={eligibilityHighlights.length ? eligibilityHighlights : ["응모 자격은 원문 공고 확인이 필요합니다."]}
              />
              <QuickScanCard
                icon={<FaFileLines className="h-3.5 w-3.5" aria-hidden />}
                eyebrow="무엇을 준비해야 하나"
                title="제출 채널과 형식을 먼저 챙기면 편합니다."
                items={submissionHighlights.length ? submissionHighlights : ["접수 항목 정보가 아직 정리되지 않았습니다."]}
              />
              <QuickScanCard
                icon={<FaBullseye className="h-3.5 w-3.5" aria-hidden />}
                eyebrow="심사에서 보는 것"
                title="상위권 포인트는 이 기준에 걸립니다."
                items={judgingHighlights.length ? judgingHighlights : ["심사 기준 정보가 아직 정리되지 않았습니다."]}
              />
            </div>
          </div>

          {contestMetrics.analysis.analysisStatus === "pending" ? (
            <div className="mt-6 rounded-[24px] border border-[rgba(255,200,87,0.18)] bg-[rgba(255,200,87,0.08)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">분석 대기 중</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">
                대회 정보는 저장됐고 GPT 분석은 아직 생성되지 않았습니다. 키를 연결하면 추천 이유와 전략이 여기에 채워집니다.
              </p>
            </div>
          ) : contestMetrics.analysis.analysisStatus === "failed" ? (
            <div className="mt-6 rounded-[24px] border border-[rgba(255,125,136,0.18)] bg-[rgba(255,125,136,0.08)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">분석 생성 실패</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">
                대회는 저장됐지만 분석 응답을 만들지 못했습니다. API 응답을 확인한 뒤 다시 생성하면 됩니다.
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">왜 지금 볼 만한가</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{contestMetrics.analysis.recommendReason}</p>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{contestMetrics.analysis.summary}</p>
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:sticky xl:top-24 xl:self-start">
          <aside className="surface-card rounded-[34px] p-8">
            <div className="eyebrow">참가 액션</div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip-nowrap rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]">
                {formatDeadlineLabel(contestMetrics.deadline)}
              </span>
              <span className="chip-nowrap rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]">
                {formatTeamValue(contestMetrics)}
              </span>
              <span className="chip-nowrap rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]">
                {formatApplyChannel(contestMetrics.applyUrl)}
              </span>
            </div>

            <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
              <div className="text-sm font-semibold text-[var(--foreground)]">신청 전, 포스터와 접수 형식만 먼저 확인해도 판단이 빨라집니다.</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                모바일에서는 아래 고정 바에서 바로 신청하고, 세부 조건은 이 페이지 안에서 이어서 확인하면 됩니다.
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              <a href={`/contests/${contestMetrics.slug}/apply`} className="primary-button w-full">
                공모전 신청하기
              </a>
              <a href="#full-notice" className="secondary-button w-full">
                전체 공고 보기
              </a>
            </div>

            <div className="mt-5">
              <ContestPoster contest={contestMetrics} />
            </div>
          </aside>

          <aside className="surface-card rounded-[34px] p-8">
            <div className="eyebrow">지원 전 체크</div>
            <div className="mt-4 space-y-3">
              <QuickCheckRow
                label="지원 대상"
                value={buildCompactSummary(contestMetrics.eligibilityText, 2) || "응모 자격은 원문 공고를 확인해 주세요."}
              />
              <QuickCheckRow
                label="접수 방식"
                value={submissionHighlights.slice(0, 2).join(" / ") || "신청 링크와 제출 형식이 아직 정리되지 않았습니다."}
              />
              <QuickCheckRow
                label="심사 포인트"
                value={judgingHighlights.slice(0, 2).join(" / ") || "심사 기준은 원문 공고를 확인해 주세요."}
              />
              <QuickCheckRow
                label="브랜드 성격"
                value={`${formatOrganizerTrust(contestMetrics)} 성격의 공모전`}
              />
            </div>
          </aside>

          <aside className="surface-card rounded-[34px] p-8">
            <div className="eyebrow">단계별 일정</div>
            {contestMetrics.stageSchedule?.length ? (
              <div className="mt-4 space-y-3">
                {contestMetrics.stageSchedule.map((stage) => (
                  <div key={`${stage.label}-${stage.date ?? "none"}`} className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)] text-[var(--foreground)]">
                        <FaClock className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--foreground)]">{stage.label}</div>
                        <div className="mt-1 text-sm text-[var(--foreground)]">{stage.date ? formatDate(stage.date) : "날짜 미정"}</div>
                        {stage.note ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{stage.note}</p> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">세부 일정은 아직 정리되지 않았습니다. 원문 공고를 같이 확인해 주세요.</p>
            )}
          </aside>
        </div>
      </section>

      <nav className="scrollbar-hidden mt-6 flex gap-2 overflow-x-auto pb-1">
        <SectionJumpLink href="#prep-flow" label="전략 시작" />
        <SectionJumpLink href="#essentials" label="준비물 체크" />
        <SectionJumpLink href="#judging" label="심사 기준" />
        <SectionJumpLink href="#full-notice" label="전체 공고" />
      </nav>

      <section id="prep-flow" className="mt-8">
        <ContestPreparationExperience
          contest={contestMetrics}
          isLoggedIn={Boolean(viewerSession.user)}
          initialSession={ideationSession}
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <div className="space-y-6">
          <section id="essentials" className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">지원 전에 챙길 것</div>
            <h2 className="text-balance mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
              실제 준비에 필요한 정보만 다시 정리했습니다.
            </h2>
            <p className="text-pretty mt-3 text-sm leading-7 text-[var(--muted)]">
              공고 원문을 전부 읽기 전에, 제출물과 대상, 보상, 데이터셋 여부부터 빠르게 훑을 수 있게 묶었습니다.
            </p>

            <div className="mt-6 space-y-5">
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
                    {uniqueLines(contestMetrics.submissionItems).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-[0.45rem] inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(245,241,232,0.7)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">접수 항목 정보 미정</p>
                )}
              </div>

              {showStandaloneSubmissionFormat ? (
                <div>
                  <div className="insight-label">제출 형식</div>
                  <div className="mt-3">
                    <ContentBlocks text={contestMetrics.submissionFormat} emptyText="제출 형식 미정" />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
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
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--foreground)]">
                    {rewardHighlights.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-[0.45rem] inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(245,241,232,0.7)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section id="judging" className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">심사 기준</div>
            <h2 className="text-balance mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
              여기서 점수를 잃지 않도록, 비중이 큰 기준부터 보세요.
            </h2>
            <p className="text-pretty mt-3 text-sm leading-7 text-[var(--muted)]">
              상위권 전략은 결국 심사 기준을 얼마나 설계에 드러내느냐에 달려 있습니다. 높은 비중부터 화면에 드러나게 준비하는 편이 좋습니다.
            </p>
            <div className="mt-6">
              <JudgingCriteriaChart criteria={contestMetrics.judgingCriteria ?? []} />
            </div>

            {judgingHighlights.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {judgingHighlights.map((item) => (
                  <span
                    key={item}
                    className="chip-nowrap inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
                  >
                    <FaCircleCheck className="h-3 w-3" aria-hidden />
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">참고 자료</div>
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
            {contestMetrics.tags.length ? (
              <p className="mt-5 text-sm leading-6 text-[var(--muted)]">{contestMetrics.tags.join(" · ")}</p>
            ) : null}

            {contestMetrics.pastWinners ? (
              <div className="mt-6">
                <div className="insight-label">과거 수상작 / 참고 사례</div>
                <div className="mt-3">
                  <ContentBlocks text={contestMetrics.pastWinners} />
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  <FaTrophy className="h-3.5 w-3.5 text-[var(--foreground)]" aria-hidden />
                  참고 사례
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  과거 수상작 정보는 아직 비어 있습니다. 대신 심사 기준과 보상 구조를 보고 전략을 먼저 잡는 편이 좋습니다.
                </p>
              </div>
            )}
          </section>

          <section id="full-notice" className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">전체 공고</div>
            <h2 className="text-balance mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
              세부 문구까지 확인할 때만 펼쳐서 보면 됩니다.
            </h2>
            <p className="text-pretty mt-3 text-sm leading-7 text-[var(--muted)]">
              첫 화면에서는 판단에 필요한 정보만 먼저 보여주고, 전체 공고는 아래에 접어뒀습니다. 세부 조항이나 유의사항을 확인할 때 펼쳐보세요.
            </p>

            <details className="mt-6 rounded-[26px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">전체 공고 펼쳐보기</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      공고 본문 {buildContentBlocks(contestMetrics.description).length}개 문단이 정리돼 있습니다.
                    </p>
                  </div>
                  <span className="chip-nowrap inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]">
                    펼치기
                    <FaArrowRight className="h-3 w-3" aria-hidden />
                  </span>
                </div>
              </summary>

              <div className="mt-5 max-h-[34rem] overflow-y-auto pr-2">
                <ContentBlocks text={contestMetrics.description} />
              </div>
            </details>
          </section>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[rgba(5,6,8,0.92)] px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl gap-3">
          <a href={`/contests/${contestMetrics.slug}/apply`} className="primary-button min-w-0 flex-1">
            공모전 신청하기
          </a>
          <a href="#prep-flow" className="secondary-button min-w-0 flex-1">
            전략 보기
          </a>
        </div>
      </div>
    </main>
  );
}
