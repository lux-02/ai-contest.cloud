import { DeleteContestButton } from "@/components/admin/delete-contest-button";
import { LogoutButton } from "@/components/admin/logout-button";
import Link from "next/link";

import { ContestForm } from "@/components/admin/contest-form";
import {
  createContestAction,
  deleteContestAction,
  getAdminContestRows,
  getAdminStats,
  retryContestAnalysisAction,
} from "@/lib/server/contest-admin";
import { requireAdminSession } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

function formatAdminDate(value: string | null) {
  if (!value) {
    return "미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function AdminContestsPage() {
  await requireAdminSession("/admin/contests");

  const [rows, stats] = await Promise.all([getAdminContestRows(), getAdminStats()]);
  const analysisReady = Boolean(process.env.OPENAI_API_KEY);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-20 pt-10">
      <section className="surface-card rounded-[34px] p-8 md:p-10">
        <div className="eyebrow">관리자 등록</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)] md:text-6xl">
              외부 공고 본문을 붙여 넣고, 검수 후 바로 등록.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
              원문 링크와 상세 본문을 넣으면 핵심 필드가 먼저 채워지고, 운영자는 아래에서 제목·마감일·카테고리만 검수하면 됩니다.
            </p>
          </div>
          <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-5 py-4 text-sm text-[var(--muted)]">
            <div>GPT 자동 분석: {analysisReady ? "ON" : "OFF"}</div>
            <div className="mt-3 flex justify-end">
              <LogoutButton />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-5">
          <div className="hero-metric">
            <div className="text-3xl font-semibold tracking-[-0.04em]">{stats.total}</div>
            <div className="mt-2 text-sm text-[var(--muted)]">전체 대회</div>
          </div>
          <div className="hero-metric">
            <div className="text-3xl font-semibold tracking-[-0.04em]">{stats.published}</div>
            <div className="mt-2 text-sm text-[var(--muted)]">공개 대회</div>
          </div>
          <div className="hero-metric">
            <div className="text-3xl font-semibold tracking-[-0.04em]">{stats.drafts}</div>
            <div className="mt-2 text-sm text-[var(--muted)]">초안 대회</div>
          </div>
          <div className="hero-metric">
            <div className="text-3xl font-semibold tracking-[-0.04em]">{stats.pending_analysis}</div>
            <div className="mt-2 text-sm text-[var(--muted)]">분석 대기</div>
          </div>
          <div className="hero-metric">
            <div className="text-3xl font-semibold tracking-[-0.04em]">{stats.failed_analysis}</div>
            <div className="mt-2 text-sm text-[var(--muted)]">분석 실패</div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <ContestForm action={createContestAction} analysisReady={analysisReady} />
        </div>

        <aside className="space-y-6">
          <div className="surface-card rounded-[30px] p-6">
            <div className="eyebrow">최근 등록 대회</div>
            <div className="mt-4 space-y-3">
              {rows.map((contest) => {
                const retryAction = retryContestAnalysisAction.bind(null, contest.id);
                const deleteAction = deleteContestAction.bind(null, contest.id);

                return (
                  <div
                    key={contest.id}
                    className="rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 transition hover:border-[rgba(245,241,232,0.18)] hover:bg-[rgba(255,255,255,0.04)]"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/admin/contests/${contest.slug}`} className="text-sm font-semibold text-[var(--foreground)]">
                        {contest.title}
                      </Link>
                      <div className="mt-1 text-sm text-[var(--muted)]">{contest.organizer}</div>
                    </div>
                    <div className="text-right text-xs text-[var(--muted)]">
                      <div>{formatAdminDate(contest.deadline)}</div>
                      <div className="mt-1 uppercase">{contest.status}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="badge-pill border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)]">
                      analysis: {contest.analysis_status ?? "missing"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/admin/contests/${contest.slug}`} className="secondary-button">
                      수정
                    </Link>
                    <Link href={`/contests/${contest.slug}`} className="secondary-button">
                      공개 보기
                    </Link>
                    {analysisReady && contest.analysis_status !== "completed" ? (
                      <form action={retryAction}>
                        <button type="submit" className="secondary-button">
                          분석 재실행
                        </button>
                      </form>
                    ) : null}
                    <DeleteContestButton action={deleteAction} subject={contest.title} />
                  </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="surface-card rounded-[30px] p-6">
            <div className="eyebrow">입력 팁</div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--foreground)]">
              <li>짧은 소개는 카드 한 줄 요약이라서 70자 안팎이 가장 보기 좋습니다.</li>
              <li>태그는 `LLM, RAG, Student`처럼 쉼표로 구분하면 됩니다.</li>
              <li>카테고리는 최소 1개 선택해야 배지와 필터에서 잘 동작합니다.</li>
              <li>공고 이미지는 URL을 붙여 넣거나 파일 업로드로 올리면 상세 페이지 포스터에 바로 반영됩니다.</li>
              <li>OPENAI API 키를 넣으면 저장 시 분석이 자동으로 completed로 들어갑니다.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
