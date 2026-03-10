import Link from "next/link";

import { ContestCard } from "@/components/contest-card";
import { FilterBar } from "@/components/filter-bar";
import { getContests } from "@/lib/queries";
import { formatCategory, formatDeadlineLabel, formatDifficulty } from "@/lib/utils";
import {
  contestBadgeOptions,
  contestCategoryOptions,
  difficultyOptions,
  isContestBadge,
  isContestCategory,
  isContestDifficulty,
} from "@/types/contest";

type PageProps = {
  searchParams: Promise<{
    category?: string;
    badge?: string;
    difficulty?: string;
  }>;
};

export default async function ContestsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const filters = {
    category: isContestCategory(params.category) ? params.category : undefined,
    badge: isContestBadge(params.badge) ? params.badge : undefined,
    difficulty: isContestDifficulty(params.difficulty) ? params.difficulty : undefined,
  };

  const contests = await getContests(filters);
  const spotlight = contests[0];
  const hasFilters = Boolean(filters.category || filters.badge || filters.difficulty);
  const uniqueCategories = new Set(contests.flatMap((contest) => contest.aiCategories));
  const urgentCount = contests.filter((contest) => contest.badges.includes("deadline_urgent")).length;
  const studentCount = contests.filter((contest) => contest.badges.includes("student_friendly")).length;

  const activeSignals = [
    filters.category
      ? contestCategoryOptions.find((option) => option.id === filters.category)?.label
      : "대학생 포트폴리오 중심",
    filters.badge ? contestBadgeOptions.find((option) => option.id === filters.badge)?.label : "마감 / 상금 / 학생 적합도",
    filters.difficulty
      ? difficultyOptions.find((option) => option.id === filters.difficulty)?.label
      : "입문부터 상위권 대회까지",
  ].flatMap((item) => (item ? [item] : []));

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-10">
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="surface-card rounded-[38px] p-8 md:p-10">
          <div className="eyebrow">탐색 레이더</div>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)] md:text-6xl">
            내 스펙과 일정에 맞는 <span className="gradient-text">AI 공모전만 남겨보세요.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            한국 대학생과 취준생이 상금, 마감, 기술 스택, 팀 구성을 기준으로 지금 넣을 만한 대회를 빠르게 고르고, 바로
            우승 전략 리포트까지 읽는 탐색 화면입니다.
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            {activeSignals.map((item) => (
              <span key={item} className="signal-chip">
                <span className="signal-dot" />
                {item}
              </span>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="hero-metric">
              <div className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">{contests.length}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">현재 조건에 맞는 대회</div>
            </div>
            <div className="hero-metric">
              <div className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">{urgentCount}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">마감 임박 라인업</div>
            </div>
            <div className="hero-metric">
              <div className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">{studentCount}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">학생 친화 대회</div>
            </div>
          </div>
        </div>

        <div className="surface-card rounded-[38px] p-8 md:p-10">
          <div className="eyebrow">이번 주 스포트라이트</div>
          {spotlight ? (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {spotlight.aiCategories.slice(0, 2).map((category) => (
                  <span key={category} className="badge-pill border-[var(--border)] bg-white text-[var(--foreground)]">
                    {formatCategory(category)}
                  </span>
                ))}
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-4xl">
                {spotlight.title}
              </h2>
              <p className="mt-4 text-base leading-7 text-[var(--foreground)]">{spotlight.analysis.summary}</p>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{spotlight.analysis.recommendReason}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="report-card">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">마감</div>
                  <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {formatDeadlineLabel(spotlight.deadline)}
                  </div>
                </div>
                <div className="report-card">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">난도</div>
                  <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {formatDifficulty(spotlight.difficulty)}
                  </div>
                </div>
                <div className="report-card">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">분야</div>
                  <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {spotlight.aiCategories[0] ? formatCategory(spotlight.aiCategories[0]) : "AI Contest"}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/contests/${spotlight.slug}`} className="primary-button">
                  우승 전략 리포트 보기
                </Link>
                <Link href="/contests?badge=student_friendly" className="secondary-button">
                  대학생 추천만 보기
                </Link>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-[28px] border border-[rgba(122,157,221,0.16)] bg-[rgba(255,255,255,0.03)] p-6">
              <div className="text-base font-semibold text-[var(--foreground)]">현재 조건에 맞는 대회를 찾지 못했습니다.</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                카테고리나 난도를 풀어 다시 탐색해 보세요. 필터를 비우면 전체 AI 공모전 라인업을 바로 확인할 수 있습니다.
              </p>
              <Link href="/contests" className="secondary-button mt-5">
                필터 초기화
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[310px_1fr]">
        <FilterBar
          selectedCategory={filters.category}
          selectedBadge={filters.badge}
          selectedDifficulty={filters.difficulty}
          total={contests.length}
        />

        <div className="space-y-5">
          <div className="surface-card rounded-[30px] p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="eyebrow">탐색 결과</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  지금 바로 지원 판단이 가능한 대회만 모았습니다.
                </h2>
              </div>
              <div className="text-sm leading-6 text-[var(--muted)]">
                {contests.length}개 대회 · {uniqueCategories.size}개 카테고리
                {hasFilters ? " · 조건 적용 중" : " · 전체 탐색 중"}
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              카드에서는 한줄 요약과 추천 이유를 먼저 보고, 상세로 들어가면 심사 포인트와 준비 체크리스트까지 이어서 읽을 수
              있습니다.
            </p>
          </div>

          {contests.length > 0 ? (
            <div className="grid gap-5">
              {contests.map((contest) => (
                <ContestCard key={contest.id} contest={contest} />
              ))}
            </div>
          ) : (
            <div className="surface-card rounded-[32px] p-8">
              <div className="eyebrow">No Match</div>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                지금 선택한 조건으로는 대회가 없습니다.
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                카테고리를 넓히거나 난도를 풀면 대학생 포트폴리오용 대회부터 상금형 해커톤까지 다시 추천해 드릴 수 있습니다.
              </p>
              <Link href="/contests" className="secondary-button mt-6">
                전체 목록으로 돌아가기
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
