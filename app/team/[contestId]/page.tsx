import Link from "next/link";

import { getContestTeamHandoff } from "@/lib/server/contest-ideation";
import { requireViewerUser } from "@/lib/server/viewer-auth";

type PageProps = {
  params: Promise<{
    contestId: string;
  }>;
  searchParams: Promise<{
    session?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function TeamHandoffPage({ params, searchParams }: PageProps) {
  const { contestId } = await params;
  const { session } = await searchParams;
  const nextPath = session ? `/team/${contestId}?session=${session}` : `/team/${contestId}`;
  const user = await requireViewerUser(nextPath);

  if (!session) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="surface-card rounded-[32px] p-8 md:p-10">
          <div className="eyebrow">접근 정보 누락</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
            ideation session 정보가 필요합니다.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            공모전 상세 페이지에서 아이디어를 먼저 확정한 뒤, 팀 빌딩 버튼으로 들어오면 올바른 session이 함께 전달됩니다.
          </p>
          <Link href="/contests" className="primary-button mt-8">
            공모전 탐색으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const handoff = await getContestTeamHandoff(contestId, session, user.id);

  if (!handoff) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="surface-card rounded-[32px] p-8 md:p-10">
          <div className="eyebrow">접근 권한 없음</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
            이 팀 빌딩 handoff에는 접근할 수 없습니다.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            본인이 확정한 ideation session이 아니거나, 아직 아이디어 확정이 끝나지 않은 상태일 수 있습니다.
          </p>
          <Link href="/contests" className="primary-button mt-8">
            공모전 상세로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <section className="surface-card rounded-[34px] p-8 md:p-10">
        <div className="eyebrow">팀 빌딩 handoff</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
          확정한 아이디어 기준으로 팀 구성 준비를 시작합니다.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
          이번 단계에서는 ideation 결과를 팀 빌딩 페이지로 안전하게 넘기는 stub만 포함합니다. 실제 협업 대시보드와 AI 팀원 시뮬레이션은 다음 단계에서 연결합니다.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Why</div>
            <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{handoff.why}</p>
          </div>
          <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">How</div>
            <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{handoff.how}</p>
          </div>
          <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">선택 아이디어</div>
            <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{handoff.ideaTitle}</p>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-[var(--border)] bg-[var(--surface-muted)] p-6">
          <div className="text-sm font-semibold text-[var(--foreground)]">Matrix 1등 선정 이유</div>
          <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{handoff.matrixSummary}</p>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{handoff.ideaDescription}</p>
        </div>

        <div className="mt-6 rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-6">
          <div className="text-sm font-semibold text-[var(--foreground)]">다음 단계 안내</div>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{handoff.nextStep}</p>
          <div className="mt-5 rounded-[18px] border border-[rgba(245,241,232,0.1)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)]">
            팀 구성 시작 예정
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={`/contests`} className="secondary-button">
            다른 공모전 보기
          </Link>
          <Link href={`/contests`} className="primary-button">
            다음 단계 준비 계속하기
          </Link>
        </div>
      </section>
    </main>
  );
}
