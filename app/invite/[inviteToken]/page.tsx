import Link from "next/link";

import { acceptContestWorkspaceInviteAction } from "@/app/invite/actions";
import { getContestById } from "@/lib/queries";
import { getContestWorkspaceInviteByToken } from "@/lib/server/contest-workspace-access";
import { getViewerSession } from "@/lib/server/viewer-auth";
import { formatDate } from "@/lib/utils";

type PageProps = {
  params: Promise<{
    inviteToken: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

function resolveErrorMessage(error?: string) {
  if (error === "mismatch") {
    return "초대받은 이메일 계정으로 로그인해야 이 워크스페이스에 참여할 수 있습니다.";
  }

  if (error === "email") {
    return "현재 계정의 이메일 정보를 확인할 수 없습니다.";
  }

  if (error === "expired") {
    return "이 초대 링크는 만료되었거나 취소되었습니다.";
  }

  if (error === "invalid") {
    return "초대를 수락하지 못했습니다. 링크 상태를 다시 확인해주세요.";
  }

  return null;
}

export default async function WorkspaceInvitePage({ params, searchParams }: PageProps) {
  const { inviteToken } = await params;
  const { error } = await searchParams;
  const [invite, viewerSession] = await Promise.all([getContestWorkspaceInviteByToken(inviteToken), getViewerSession()]);

  if (!invite) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="surface-card rounded-[32px] p-8 md:p-10">
          <div className="eyebrow">초대 만료</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
            사용할 수 없는 초대 링크입니다.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            워크스페이스 소유자가 초대를 취소했거나 링크가 더 이상 유효하지 않습니다.
          </p>
          <Link href="/contests" className="primary-button mt-8">
            공모전 탐색으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const contest = await getContestById(invite.contestId);
  const errorMessage = resolveErrorMessage(error);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <section className="surface-card rounded-[32px] p-8 md:p-10">
        <div className="eyebrow">Workspace Invite</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
          {contest?.title ?? "공모전 워크스페이스"} 초대
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          {invite.inviteeEmail} 계정으로 초대된 워크스페이스입니다. 수락하면 이 공모전의 workspace를 열고 리뷰와 제출 패키지를 함께
          확인할 수 있습니다.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">역할</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{invite.role}</div>
          </div>
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">초대 상태</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{invite.status}</div>
          </div>
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">초대 생성일</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatDate(invite.createdAt)}</div>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-[24px] border border-[rgba(255,200,87,0.18)] bg-[rgba(255,200,87,0.08)] px-4 py-3 text-sm text-[rgb(255,224,163)]">
            {errorMessage}
          </div>
        ) : null}

        {!viewerSession.user ? (
          <div className="mt-8">
            <Link href={`/login?next=${encodeURIComponent(`/invite/${inviteToken}`)}`} className="primary-button">
              로그인 후 초대 수락하기
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--muted)]">
              현재 로그인: <span className="font-semibold text-[var(--foreground)]">{viewerSession.user.email ?? "이메일 없음"}</span>
            </div>

            {invite.status === "accepted" ? (
              <Link href={`/workspace/${invite.contestId}?session=${invite.ideationSessionId}`} className="primary-button">
                워크스페이스 열기
              </Link>
            ) : (
              <form action={acceptContestWorkspaceInviteAction}>
                <input type="hidden" name="inviteToken" value={inviteToken} />
                <button type="submit" className="primary-button">
                  초대 수락하고 워크스페이스 참여
                </button>
              </form>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
