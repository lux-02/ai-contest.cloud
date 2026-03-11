import Link from "next/link";

import { TeamSimulationDashboard } from "@/components/team-simulation-dashboard";
import { getContestById } from "@/lib/queries";
import { getContestTeamHandoff } from "@/lib/server/contest-ideation";
import { getTeamSessionSnapshot } from "@/lib/server/contest-team";
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

function resolveViewerLabel(user: Awaited<ReturnType<typeof requireViewerUser>>) {
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "";

  if (metadataName.trim()) {
    return metadataName.trim();
  }

  const emailName = user.email?.split("@")[0]?.trim();
  return emailName || "나";
}

export default async function TeamPage({ params, searchParams }: PageProps) {
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
            공모전 상세 페이지에서 아이디어를 확정한 뒤 팀 빌딩 버튼으로 들어오면, 지금 화면이 자동으로 이어집니다.
          </p>
          <Link href="/contests" className="primary-button mt-8">
            공모전 탐색으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const [contest, handoff, snapshot] = await Promise.all([
    getContestById(contestId),
    getContestTeamHandoff(contestId, session, user.id),
    getTeamSessionSnapshot(contestId, session, user.id),
  ]);

  if (!contest || !handoff) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="surface-card rounded-[32px] p-8 md:p-10">
          <div className="eyebrow">접근 권한 없음</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
            이 팀 빌딩 세션에는 접근할 수 없습니다.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            본인이 확정한 ideation session이 아니거나, 아직 아이디어 확정이 끝나지 않은 상태일 수 있습니다.
          </p>
          <Link href="/contests" className="primary-button mt-8">
            공모전 탐색으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <TeamSimulationDashboard
      contest={contest}
      viewerLabel={resolveViewerLabel(user)}
      ideationSessionId={session}
      initialHandoff={handoff}
      initialData={snapshot}
    />
  );
}
