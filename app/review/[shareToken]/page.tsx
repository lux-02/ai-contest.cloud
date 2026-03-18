import Link from "next/link";
import { FaCheck, FaFileLines, FaUsers } from "react-icons/fa6";

import { submitSharedContestWorkspaceReviewAction } from "@/app/review/actions";
import { formatDate, formatDeadlineLabel } from "@/lib/utils";
import { getContestWorkspaceSnapshot } from "@/lib/server/contest-workspace";
import { listContestWorkspaceReviewsWithServiceRole } from "@/lib/server/contest-workspace-reviews";
import { resolveContestWorkspaceShareLink } from "@/lib/server/contest-workspace-shares";

type PageProps = {
  params: Promise<{
    shareToken: string;
  }>;
  searchParams: Promise<{
    submitted?: string;
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function SharedReviewPage({ params, searchParams }: PageProps) {
  const { shareToken } = await params;
  const { submitted, error } = await searchParams;
  const shareLink = await resolveContestWorkspaceShareLink(shareToken);

  if (!shareLink) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="surface-card rounded-[32px] p-8 md:p-10">
          <div className="eyebrow">공유 링크 만료</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
            이 리뷰 링크는 더 이상 사용할 수 없습니다.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            워크스페이스 소유자가 링크를 끊었거나 새 링크로 교체했습니다. 최신 링크를 다시 받아서 접속해주세요.
          </p>
        </section>
      </main>
    );
  }

  const [snapshot, reviews] = await Promise.all([
    getContestWorkspaceSnapshot(shareLink.contestId, shareLink.ideationSessionId, shareLink.ownerUserId),
    listContestWorkspaceReviewsWithServiceRole(shareLink.contestId, shareLink.ideationSessionId),
  ]);

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="surface-card rounded-[32px] p-8 md:p-10">
          <div className="eyebrow">워크스페이스 없음</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
            공유 대상 워크스페이스를 찾지 못했습니다.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            링크가 오래되었거나, 아직 아이디어 확정이 끝나지 않은 상태일 수 있습니다.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">
      <section className="surface-card rounded-[34px] p-8 md:p-10">
        <div className="eyebrow">Shared Review Workspace</div>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
          {snapshot.contest.title}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
          외부 멘토나 팀원이 로그인 없이 코멘트를 남길 수 있는 공유 리뷰 화면입니다. 제출 방향, 발표 구조, 데모 흐름에 대한
          피드백을 바로 남겨주세요.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">마감</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatDeadlineLabel(snapshot.contest.deadline)}</div>
          </div>
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">확정 아이디어</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {snapshot.handoff?.ideaTitle || snapshot.submissionPackage.subtitle}
            </div>
          </div>
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">현재 리뷰 수</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{reviews.length}개</div>
          </div>
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">팀 준비도</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {snapshot.teamSnapshot?.teamSession.readinessScore ?? snapshot.ideationSession.progress.team}%
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <div className="space-y-6">
          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">검토할 핵심 맥락</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
              {snapshot.submissionPackage.proposalTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{snapshot.submissionPackage.overview}</p>

            <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
              <div className="text-sm font-semibold text-[var(--foreground)]">확정 아이디어</div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {snapshot.handoff?.ideaDescription || snapshot.ideationSession.matrixSummary || "아이디어 설명이 아직 짧습니다."}
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <FaFileLines className="h-3.5 w-3.5" aria-hidden />
                  발표 아웃라인
                </div>
                <ol className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
                  {snapshot.submissionPackage.pitchOutline.slice(0, 5).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>

              <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <FaCheck className="h-3.5 w-3.5" aria-hidden />
                  제출 체크 포인트
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
                  {snapshot.submissionPackage.checklist.slice(0, 5).map((item) => (
                    <li key={item.label}>{item.label}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">이미 남겨진 코멘트</div>
            <div className="mt-5 space-y-3">
              {reviews.length ? (
                reviews.map((review) => (
                  <div key={review.id} className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                    <div className="text-sm font-semibold text-[var(--foreground)]">
                      {review.reviewerLabel}
                      {review.reviewerRole ? ` · ${review.reviewerRole}` : ""}
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      {review.focusArea} · {formatDate(review.createdAt)}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{review.note}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5 text-sm leading-6 text-[var(--muted)]">
                  아직 남겨진 리뷰가 없습니다. 첫 피드백을 남겨주세요.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">리뷰 남기기</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
              팀원이나 멘토 피드백을 바로 기록합니다.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              전략, 아이데이션, 팀 실행, 제출 패키지 중 어디를 수정해야 하는지 짧고 명확하게 남겨주세요.
            </p>

            {submitted === "1" ? (
              <div className="mt-5 rounded-[24px] border border-[rgba(126,211,170,0.18)] bg-[rgba(126,211,170,0.08)] px-4 py-3 text-sm text-[rgb(204,244,222)]">
                리뷰가 저장되었습니다. 같은 링크로 다시 들어오면 최신 코멘트를 확인할 수 있습니다.
              </div>
            ) : null}

            {error ? (
              <div className="mt-5 rounded-[24px] border border-[rgba(255,200,87,0.18)] bg-[rgba(255,200,87,0.08)] px-4 py-3 text-sm text-[rgb(255,224,163)]">
                입력값을 다시 확인해주세요. 만료된 링크일 수도 있습니다.
              </div>
            ) : null}

            <form action={submitSharedContestWorkspaceReviewAction} className="mt-6 grid gap-4">
              <input type="hidden" name="shareToken" value={shareToken} />

              <label className="space-y-2 text-sm text-[var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">이름</span>
                <input
                  name="reviewerLabel"
                  required
                  placeholder="예: 박OO 멘토, 디자인 팀원 민지"
                  className="w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                />
              </label>

              <label className="space-y-2 text-sm text-[var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">역할</span>
                <input
                  name="reviewerRole"
                  placeholder="예: PM 멘토, 개발 팀원"
                  className="w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                />
              </label>

              <label className="space-y-2 text-sm text-[var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">검토 영역</span>
                <select
                  name="focusArea"
                  defaultValue="submission"
                  className="w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                >
                  <option value="strategy">전략</option>
                  <option value="ideation">아이데이션</option>
                  <option value="team">팀 실행</option>
                  <option value="submission">제출 패키지</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-[var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">코멘트</span>
                <textarea
                  name="note"
                  required
                  rows={5}
                  placeholder="예: 발표 첫 장에서 문제 정의를 30초로 줄이고, 데모 결과 화면을 더 빨리 보여주는 편이 좋습니다."
                  className="w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none"
                />
              </label>

              <button type="submit" className="primary-button">
                <FaUsers className="h-3.5 w-3.5" aria-hidden />
                공유 리뷰 저장
              </button>
            </form>
          </section>

          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">안내</div>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              이 링크로 남긴 코멘트는 워크스페이스 소유자의 제출 패키지와 리뷰 기록에 함께 반영됩니다.
            </p>
            <div className="mt-5">
              <Link href="/" className="secondary-button">
                홈으로 이동
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
