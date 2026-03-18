import Link from "next/link";
import { FaArrowLeft, FaCheck, FaDownload, FaFileLines, FaUsers, FaWandMagicSparkles } from "react-icons/fa6";

import {
  addContestWorkspaceReviewAction,
  createContestWorkspaceInviteAction,
  createContestWorkspaceShareLinkAction,
  deleteContestWorkspaceReviewAction,
  revokeContestWorkspaceInviteAction,
  revokeContestWorkspaceShareLinkAction,
} from "@/app/workspace/actions";
import { formatDate, formatDeadlineLabel } from "@/lib/utils";
import {
  listContestWorkspaceCollaborators,
  listContestWorkspaceInvites,
  resolveContestWorkspaceAccess,
} from "@/lib/server/contest-workspace-access";
import { getContestWorkspaceSnapshot } from "@/lib/server/contest-workspace";
import { getActiveContestWorkspaceShareLink } from "@/lib/server/contest-workspace-shares";
import { requireViewerUser } from "@/lib/server/viewer-auth";
import type { ContestWorkspaceAccessRole } from "@/types/contest";

type PageProps = {
  params: Promise<{
    contestId: string;
  }>;
  searchParams: Promise<{
    session?: string;
  }>;
};

function ChecklistBadge({ state }: { state: "ready" | "todo" | "warning" }) {
  const label = state === "ready" ? "준비됨" : state === "warning" ? "재확인" : "할 일";
  const className =
    state === "ready"
      ? "border-[rgba(126,211,170,0.18)] bg-[rgba(126,211,170,0.08)] text-[rgb(204,244,222)]"
      : state === "warning"
        ? "border-[rgba(255,200,87,0.18)] bg-[rgba(255,200,87,0.08)] text-[rgb(255,224,163)]"
        : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)]";

  return <span className={`chip-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function formatWorkspaceRole(role: ContestWorkspaceAccessRole) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "member") {
    return "Member";
  }

  return "Reviewer";
}

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params, searchParams }: PageProps) {
  const { contestId } = await params;
  const { session } = await searchParams;
  const nextPath = session ? `/workspace/${contestId}?session=${session}` : `/workspace/${contestId}`;
  const user = await requireViewerUser(nextPath);

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="surface-card rounded-[32px] p-8 md:p-10">
          <div className="eyebrow">접근 정보 누락</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
            workspace session 정보가 필요합니다.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            공모전 상세 또는 팀 대시보드에서 워크스페이스 버튼으로 들어오면, 지금까지 만든 전략과 제출 패키지가 한 화면으로 열립니다.
          </p>
          <Link href="/contests" className="primary-button mt-8">
            공모전 탐색으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const access = await resolveContestWorkspaceAccess(contestId, session, user.id);

  if (!access) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="surface-card rounded-[32px] p-8 md:p-10">
          <div className="eyebrow">접근 권한 없음</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
            이 워크스페이스에는 접근할 수 없습니다.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            초대를 수락하지 않았거나, 본인 소유 세션이 아닌 상태일 수 있습니다.
          </p>
          <Link href="/contests" className="primary-button mt-8">
            공모전 탐색으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const [snapshot, shareLink, collaborators, invites] = await Promise.all([
    getContestWorkspaceSnapshot(contestId, session, user.id),
    access.canManage
      ? getActiveContestWorkspaceShareLink({
          contestId,
          ideationSessionId: session,
          ownerUserId: access.ownerUserId,
        })
      : Promise.resolve(null),
    access.canManage
      ? listContestWorkspaceCollaborators({
          contestId,
          ideationSessionId: session,
          ownerUserId: access.ownerUserId,
        })
      : Promise.resolve([]),
    access.canManage
      ? listContestWorkspaceInvites({
          contestId,
          ideationSessionId: session,
          ownerUserId: access.ownerUserId,
        })
      : Promise.resolve([]),
  ]);

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="surface-card rounded-[32px] p-8 md:p-10">
          <div className="eyebrow">접근 권한 없음</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
            이 워크스페이스에는 접근할 수 없습니다.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            본인 세션이 아니거나, 아직 아이디어 선택이 완료되지 않았을 수 있습니다.
          </p>
          <Link href="/contests" className="primary-button mt-8">
            공모전 탐색으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const readyCount = snapshot.submissionPackage.checklist.filter((item) => item.state === "ready").length;
  const warningCount = snapshot.submissionPackage.checklist.filter((item) => item.state === "warning").length;

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-10">
      <section className="surface-card rounded-[34px] p-8 md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <Link href={`/contests/${snapshot.contest.slug}`} className="hero-action-button shrink-0" aria-label="공모전 상세로 돌아가기">
              <FaArrowLeft className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <div>
              <div className="eyebrow">Contest Workspace</div>
              <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
                {snapshot.contest.title}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                전략 리포트, 확정 아이디어, 팀 작업물, 제출 체크리스트를 한 번에 다시 들어올 수 있는 재진입 워크스페이스입니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-[rgba(85,122,87,0.18)] bg-[rgba(85,122,87,0.08)] px-3 py-1.5 font-semibold text-[var(--success)]">
                  {formatWorkspaceRole(access.role)}
                </span>
                {!access.canManage ? (
                  <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[var(--foreground)]">
                    소유자가 초대한 협업 권한으로 접근 중
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={`/api/workspace/${snapshot.contest.id}/package?session=${snapshot.ideationSession.id}`} className="primary-button">
              <FaDownload className="h-3.5 w-3.5" aria-hidden />
              제출 패키지 내려받기
            </a>
            {access.canUseTeamDashboard ? (
              <Link href={`/team/${snapshot.contest.id}?session=${snapshot.ideationSession.id}`} className="secondary-button">
                <FaUsers className="h-3.5 w-3.5" aria-hidden />
                팀 대시보드 열기
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">마감</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatDeadlineLabel(snapshot.contest.deadline)}</div>
          </div>
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">준비된 체크</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{readyCount}개</div>
          </div>
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">재확인 필요</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{warningCount}개</div>
          </div>
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">팀 준비도</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {snapshot.teamSnapshot?.teamSession.readinessScore ?? snapshot.ideationSession.progress.team}%
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-6">
          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">전략 요약</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
              지금 제출 방향은 이렇게 정리됩니다.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">
              {snapshot.strategyReport?.overview || snapshot.submissionPackage.overview}
            </p>
            <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">확정 아이디어</div>
              <div className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {snapshot.handoff?.ideaTitle || snapshot.submissionPackage.subtitle}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {snapshot.handoff?.ideaDescription || snapshot.ideationSession.matrixSummary || "선택한 아이디어 설명이 아직 짧습니다."}
              </p>
            </div>
          </section>

          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">제안서 초안</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
              {snapshot.submissionPackage.proposalTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{snapshot.submissionPackage.proposalSubtitle}</p>
            <div className="mt-6 space-y-4">
              {snapshot.submissionPackage.proposalSections.map((section) => (
                <article key={section.title} className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-sm font-semibold text-[var(--foreground)]">{section.title}</div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted)]">{section.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">발표와 데모</div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <FaFileLines className="h-3.5 w-3.5" aria-hidden />
                  발표 아웃라인
                </div>
                <ol className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
                  {snapshot.submissionPackage.pitchOutline.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
              <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                  <FaWandMagicSparkles className="h-3.5 w-3.5" aria-hidden />
                  데모 시나리오
                </div>
                <ol className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
                  {snapshot.submissionPackage.demoScenario.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          {access.canManage ? (
            <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">공유 리뷰 링크</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
              로그인 없이 멘토와 팀원 피드백을 받습니다.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              아래 링크를 보내면 외부 멘토나 팀원이 별도 계정 없이 이 워크스페이스에 리뷰를 남길 수 있습니다.
            </p>

            {shareLink ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-sm font-semibold text-[var(--foreground)]">활성 공유 링크</div>
                  <p className="mt-2 break-all text-sm leading-6 text-[var(--muted)]">{shareLink.shareUrl}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    생성 {formatDate(shareLink.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a href={shareLink.shareUrl} target="_blank" rel="noreferrer" className="secondary-button">
                    공유 페이지 열기
                  </a>
                  <form action={revokeContestWorkspaceShareLinkAction}>
                    <input type="hidden" name="shareLinkId" value={shareLink.id} />
                    <input type="hidden" name="contestId" value={snapshot.contest.id} />
                    <input type="hidden" name="ideationSessionId" value={snapshot.ideationSession.id} />
                    <input type="hidden" name="next" value={nextPath} />
                    <button type="submit" className="secondary-button">
                      링크 끊기
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <form action={createContestWorkspaceShareLinkAction} className="mt-6">
                <input type="hidden" name="contestId" value={snapshot.contest.id} />
                <input type="hidden" name="ideationSessionId" value={snapshot.ideationSession.id} />
                <input type="hidden" name="next" value={nextPath} />
                <button type="submit" className="primary-button">
                  공유 리뷰 링크 만들기
                </button>
              </form>
            )}
            </section>
          ) : null}

          {access.canManage ? (
            <section className="surface-card rounded-[32px] p-7">
              <div className="eyebrow">협업 멤버 초대</div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
                로그인 기반 협업 권한을 부여합니다.
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                member는 워크스페이스에 들어와 코멘트를 남길 수 있고, reviewer는 검토 중심으로 참여합니다.
              </p>

              <form action={createContestWorkspaceInviteAction} className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                <input type="hidden" name="contestId" value={snapshot.contest.id} />
                <input type="hidden" name="ideationSessionId" value={snapshot.ideationSession.id} />
                <input type="hidden" name="next" value={nextPath} />

                <input
                  name="inviteeEmail"
                  type="email"
                  required
                  placeholder="collaborator@example.com"
                  className="w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                />

                <select
                  name="role"
                  defaultValue="member"
                  className="w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                >
                  <option value="member">member</option>
                  <option value="reviewer">reviewer</option>
                </select>

                <button type="submit" className="primary-button">
                  초대 만들기
                </button>
              </form>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-sm font-semibold text-[var(--foreground)]">참여 중인 멤버</div>
                  <div className="mt-4 space-y-3">
                    {collaborators.length ? (
                      collaborators.map((collaborator) => (
                        <div key={collaborator.id} className="rounded-[18px] border border-[var(--border)] px-4 py-3">
                          <div className="text-sm font-semibold text-[var(--foreground)]">
                            {collaborator.memberEmail ?? collaborator.memberUserId}
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                            {collaborator.role} · 합류 {formatDate(collaborator.createdAt)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm leading-6 text-[var(--muted)]">아직 수락된 협업 멤버가 없습니다.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-sm font-semibold text-[var(--foreground)]">대기 중인 초대</div>
                  <div className="mt-4 space-y-3">
                    {invites.filter((invite) => invite.status === "pending").length ? (
                      invites
                        .filter((invite) => invite.status === "pending")
                        .map((invite) => (
                          <div key={invite.id} className="rounded-[18px] border border-[var(--border)] px-4 py-3">
                            <div className="text-sm font-semibold text-[var(--foreground)]">{invite.inviteeEmail}</div>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                              {invite.role} · 생성 {formatDate(invite.createdAt)}
                            </p>
                            <p className="mt-2 break-all text-xs leading-5 text-[var(--muted)]">{invite.inviteUrl}</p>
                            <form action={revokeContestWorkspaceInviteAction} className="mt-3">
                              <input type="hidden" name="inviteId" value={invite.id} />
                              <input type="hidden" name="contestId" value={snapshot.contest.id} />
                              <input type="hidden" name="ideationSessionId" value={snapshot.ideationSession.id} />
                              <input type="hidden" name="next" value={nextPath} />
                              <button type="submit" className="secondary-button">
                                초대 취소
                              </button>
                            </form>
                          </div>
                        ))
                    ) : (
                      <div className="text-sm leading-6 text-[var(--muted)]">현재 대기 중인 초대가 없습니다.</div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">멘토/팀 리뷰</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-3xl">
              실제 피드백을 남기고 다음 제출에 재사용하세요.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              팀원, 멘토, 심사 연습에서 나온 피드백을 남기면 이 워크스페이스와 export 패키지에 같이 포함됩니다.
            </p>

            <form action={addContestWorkspaceReviewAction} className="mt-6 grid gap-4 md:grid-cols-2">
              <input type="hidden" name="contestId" value={snapshot.contest.id} />
              <input type="hidden" name="ideationSessionId" value={snapshot.ideationSession.id} />
              <input type="hidden" name="next" value={nextPath} />

              <label className="space-y-2 text-sm text-[var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">리뷰어 이름</span>
                <input
                  name="reviewerLabel"
                  required
                  placeholder="예: 팀원 민지, 멘토 박OO"
                  defaultValue={user.email?.split("@")[0] ?? ""}
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

              <label className="space-y-2 text-sm text-[var(--muted)] md:col-span-2">
                <span className="font-semibold text-[var(--foreground)]">리뷰 메모</span>
                <textarea
                  name="note"
                  required
                  rows={4}
                  placeholder="예: 발표 첫 장에서 문제 정의가 길고, 데모 결과 화면을 더 빨리 보여주는 편이 좋습니다."
                  className="w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none"
                />
              </label>

              <div className="md:col-span-2">
                <button type="submit" className="primary-button">
                  리뷰 노트 저장
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-3">
              {snapshot.reviewNotes.length ? (
                snapshot.reviewNotes.map((review) => (
                  <div key={review.id} className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-[var(--foreground)]">
                          {review.reviewerLabel}
                          {review.reviewerRole ? ` · ${review.reviewerRole}` : ""}
                        </div>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                          {review.focusArea} · {formatDate(review.createdAt)}
                        </p>
                      </div>

                      {access.canManage ? (
                        <form action={deleteContestWorkspaceReviewAction}>
                          <input type="hidden" name="reviewId" value={review.id} />
                          <input type="hidden" name="contestId" value={snapshot.contest.id} />
                          <input type="hidden" name="ideationSessionId" value={snapshot.ideationSession.id} />
                          <input type="hidden" name="next" value={nextPath} />
                          <button type="submit" className="secondary-button">
                            삭제
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{review.note}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5 text-sm leading-6 text-[var(--muted)]">
                  아직 저장된 리뷰 노트가 없습니다. 멘토나 팀원 피드백을 남기면 다음 제출 패키지에도 그대로 실립니다.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">제출 체크리스트</div>
            <div className="mt-5 space-y-3">
              {snapshot.submissionPackage.checklist.map((item) => (
                <div key={item.label} className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--foreground)]">{item.label}</div>
                    <ChecklistBadge state={item.state} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">팀 작업 현황</div>
            {snapshot.teamSnapshot ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-sm font-semibold text-[var(--foreground)]">{snapshot.teamSnapshot.teamSession.teamName}</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{snapshot.teamSnapshot.teamSession.teamIntro}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    마지막 업데이트 {formatDate(snapshot.teamSnapshot.teamSession.updatedAt)}
                  </p>
                </div>

                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-sm font-semibold text-[var(--foreground)]">최근 작업물</div>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
                    {snapshot.teamSnapshot.teamSession.artifacts.slice(-4).map((artifact) => (
                      <li key={artifact.id}>
                        {artifact.title} · {artifact.status === "ready" ? "준비 완료" : "작성 중"}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-sm font-semibold text-[var(--foreground)]">현재 급한 일</div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {snapshot.teamSnapshot.teamSession.currentFocus || "첫 킥오프를 고르면 급한 일이 정리됩니다."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <p className="text-sm leading-6 text-[var(--muted)]">
                  아직 팀 세션이 없습니다. 먼저 아이디어를 확정하고 팀 빌딩을 시작하면 작업물과 태스크가 이 워크스페이스에 함께 쌓입니다.
                </p>
              </div>
            )}
          </section>

          <section className="surface-card rounded-[32px] p-7">
            <div className="eyebrow">근거 자료</div>
            <div className="mt-5 space-y-3">
              {snapshot.strategySources.length ? (
                snapshot.strategySources.slice(0, 5).map((source) => (
                  <a
                    key={`${source.label}-${source.title}`}
                    href={source.url ?? undefined}
                    target={source.url ? "_blank" : undefined}
                    rel={source.url ? "noreferrer" : undefined}
                    className="block rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 transition hover:bg-[rgba(255,255,255,0.05)]"
                  >
                    <div className="text-sm font-semibold text-[var(--foreground)]">{source.title}</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{source.snippet}</p>
                  </a>
                ))
              ) : (
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm leading-6 text-[var(--muted)]">
                  저장된 전략 근거가 아직 없습니다.
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
