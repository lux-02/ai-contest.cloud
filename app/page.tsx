import Link from "next/link";

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
        <div className="max-w-4xl">
          <div className="eyebrow">AI Contest Intelligence</div>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)] md:text-7xl">
            AI 공모전, <span className="gradient-text">좋은 대회만 빠르게</span> 고르세요.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--muted)]">
            한국 대학생과 취준생이 지금 지원할 만한 AI 공모전을 정리하고, 추천 이유와 우승 전략까지 짧고 명확하게 보여주는
            플랫폼입니다.
          </p>

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
