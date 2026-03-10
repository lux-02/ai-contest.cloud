import { DeleteContestButton } from "@/components/admin/delete-contest-button";
import { LogoutButton } from "@/components/admin/logout-button";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContestForm } from "@/components/admin/contest-form";
import {
  deleteContestAction,
  getAdminContestBySlug,
  retryContestAnalysisAction,
  updateContestAction,
} from "@/lib/server/contest-admin";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { formatDate, formatDeadlineLabel, formatDifficulty, formatMode } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function AdminContestEditPage({ params }: PageProps) {
  await requireAdminSession("/admin/contests");

  const { slug } = await params;
  const contest = await getAdminContestBySlug(slug);

  if (!contest) {
    notFound();
  }

  const analysisReady = Boolean(process.env.OPENAI_API_KEY);
  const updateAction = updateContestAction.bind(null, contest.id);
  const retryAction = retryContestAnalysisAction.bind(null, contest.id);
  const deleteAction = deleteContestAction.bind(null, contest.id);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-20 pt-10">
      <section className="surface-card rounded-[34px] p-8 md:p-10">
        <div className="eyebrow">관리자 편집</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)] md:text-6xl">
              {contest.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
              저장 시 공개 상세 페이지와 GPT 분석 결과가 함께 갱신됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/contests/${contest.slug}`} className="secondary-button">
              공개 페이지 보기
            </Link>
            <Link href="/admin/contests" className="secondary-button">
              등록 화면으로
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="hero-metric">
            <div className="text-sm text-[var(--muted)]">분석 상태</div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {contest.analysisStatus}
            </div>
          </div>
          <div className="hero-metric">
            <div className="text-sm text-[var(--muted)]">마감</div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {formatDeadlineLabel(contest.deadline ?? undefined)}
            </div>
          </div>
          <div className="hero-metric">
            <div className="text-sm text-[var(--muted)]">참가 방식</div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {formatMode(contest.participationMode)}
            </div>
          </div>
          <div className="hero-metric">
            <div className="text-sm text-[var(--muted)]">난이도</div>
            <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {formatDifficulty(contest.difficulty)}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <ContestForm action={updateAction} analysisReady={analysisReady} initialData={contest} mode="edit" />
        </div>

        <aside className="space-y-6">
          <div className="surface-card rounded-[30px] p-6">
            <div className="eyebrow">빠른 액션</div>
            <div className="mt-4 grid gap-3">
              {analysisReady ? (
                <form action={retryAction}>
                  <button type="submit" className="secondary-button w-full">
                    분석 재실행
                  </button>
                </form>
              ) : (
                <div className="rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--muted)]">
                  API 키가 없으면 분석 재실행은 pending 상태만 유지됩니다.
                </div>
              )}
              <DeleteContestButton action={deleteAction} subject={contest.title} fullWidth />
            </div>
          </div>

          <div className="surface-card rounded-[30px] p-6">
            <div className="eyebrow">메타 상태</div>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[var(--muted)]">현재 상태</dt>
                <dd className="font-semibold text-[var(--foreground)]">{contest.status}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[var(--muted)]">생성일</dt>
                <dd className="font-semibold text-[var(--foreground)]">{formatDate(contest.createdAt)}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[var(--muted)]">최근 수정</dt>
                <dd className="font-semibold text-[var(--foreground)]">{formatDate(contest.updatedAt)}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[var(--muted)]">신청 링크</dt>
                <dd className="text-right font-semibold text-[var(--foreground)]">
                  {contest.applyUrl ? "별도 링크 있음" : "공고 링크와 동일"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[var(--muted)]">공고 이미지</dt>
                <dd className="text-right font-semibold text-[var(--foreground)]">
                  {contest.posterImageUrl ? "입력됨" : "미입력"}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>
    </main>
  );
}
