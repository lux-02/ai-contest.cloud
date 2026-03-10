import Image from "next/image";
import Link from "next/link";
import { FaMagnifyingGlass } from "react-icons/fa6";

import { ContestCard } from "@/components/contest-card";
import { getContestStats, getFeaturedContestSections } from "@/lib/queries";

export default async function HomePage() {
  const [sections, stats] = await Promise.all([getFeaturedContestSections(), getContestStats()]);
  const urgentContest = sections.urgent[0];
  const highPrizeContest = sections.highPrize.find((contest) => contest.id !== urgentContest?.id) ?? sections.highPrize[0];
  const studentContest =
    sections.studentFriendly.find((contest) => contest.id !== urgentContest?.id && contest.id !== highPrizeContest?.id) ??
    sections.studentFriendly[0];

  const featuredContests = [urgentContest, highPrizeContest, studentContest].flatMap((contest) => (contest ? [contest] : []));
  const uniqueFeaturedContests = featuredContests.filter(
    (contest, index, list) => list.findIndex((candidate) => candidate.id === contest.id) === index,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-10">
      <section className="surface-card rounded-[36px] px-7 py-10 md:px-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-4 rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-4 lg:hidden">
              <span className="flex h-[72px] w-[72px] items-center justify-center p-2">
                <Image src="/ai-contest-logo.svg" alt="AI Contest Cloud 로고" width={52} height={58} priority />
              </span>
              <div>
                <div className="eyebrow">AI Contest Cloud</div>
                <div className="mt-2 text-sm text-[var(--muted)]">AI 공모전 전략 플랫폼</div>
              </div>
            </div>

            <div className="mt-6 lg:mt-0">
              <div className="eyebrow">AI Contest Intelligence</div>
              <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)] md:text-7xl">
                AI 공모전, <span className="gradient-text">좋은 대회만 빠르게</span> 고르세요.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--muted)]">
                지금 지원할 만한 AI 공모전을 모아 보고, 추천 이유와 우승 전략까지 한 번에 확인하는 플랫폼입니다.
              </p>

              <form action="/contests" className="mt-7 max-w-2xl">
                <label
                  htmlFor="home-contest-search"
                  className="mb-3 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
                >
                  빠른 검색
                </label>
                <div className="flex flex-col gap-3 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center gap-3 rounded-[18px] px-2 py-2">
                    <FaMagnifyingGlass className="h-4 w-4 text-[var(--muted)]" aria-hidden />
                    <input
                      id="home-contest-search"
                      name="q"
                      type="search"
                      placeholder="예: 생성형 AI, OpenAI, 해커톤, 컴퓨터 비전"
                      className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                    />
                  </div>
                  <button type="submit" className="primary-button w-full sm:w-auto">
                    검색하기
                  </button>
                </div>
              </form>

              <div className="mt-7 flex flex-wrap gap-2">
                {["마감 임박", "상금 높은 대회", "대학생 추천", "우승 전략 요약"].map((item) => (
                  <span key={item} className="signal-chip">
                    <span className="signal-dot" />
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/contests" className="primary-button">
                  추천 대회 보기
                </Link>
                <Link href="/contests" className="secondary-button">
                  전체 목록 보기
                </Link>
              </div>
            </div>
          </div>

          <div className="relative hidden h-full min-h-[320px] overflow-hidden rounded-[32px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] lg:flex lg:flex-col lg:justify-between lg:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,164,216,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_58%)]" />
            <div className="relative">
              <div className="eyebrow">Brand Mark</div>
            </div>
            <div className="relative flex items-center justify-center">
              <Image src="/ai-contest-logo.svg" alt="AI Contest Cloud 로고" width={124} height={138} priority className="h-auto w-[124px]" />
            </div>
            <div className="relative">
              <div className="text-sm font-semibold text-[var(--foreground)]">AI Contest Cloud</div>
              <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                AI Contest Intelligence for students and early-career builders.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 border-t border-[var(--border)] pt-8 md:grid-cols-3">
          <div className="hero-metric">
            <div className="text-3xl font-semibold tracking-[-0.04em]">{stats.contestCount}</div>
            <div className="mt-2 text-sm text-[var(--muted)]">실시간 대회</div>
          </div>
          <div className="hero-metric">
            <div className="text-3xl font-semibold tracking-[-0.04em]">{stats.badgeCount}</div>
            <div className="mt-2 text-sm text-[var(--muted)]">전략 배지</div>
          </div>
          <div className="hero-metric">
            <div className="text-3xl font-semibold tracking-[-0.04em]">{stats.categoryCount}</div>
            <div className="mt-2 text-sm text-[var(--muted)]">AI 분야 분류</div>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow">추천 3개</div>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
              이번 주 먼저 볼 대회만 남겼습니다.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
              마감, 상금, 대학생 적합도를 기준으로 지금 바로 살펴볼 만한 대회만 추렸습니다.
            </p>
          </div>
          <Link href="/contests" className="secondary-button">
            전체 목록 보기
          </Link>
        </div>

        <div className="mt-8 grid gap-5">
          {uniqueFeaturedContests.map((contest) => (
            <ContestCard key={contest.id} contest={contest} />
          ))}
        </div>
      </section>
    </main>
  );
}
