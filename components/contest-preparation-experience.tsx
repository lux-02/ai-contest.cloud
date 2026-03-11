"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FaArrowRight, FaCheck, FaSpinner, FaUsers, FaXmark } from "react-icons/fa6";

import { ContestIdeationModal } from "@/components/contest-ideation-modal";
import { InsightPanel } from "@/components/insight-panel";
import { formatCompactNumber } from "@/lib/utils";
import { getViewerContinueActionLabel, getViewerReturnDescription } from "@/lib/viewer-next-path";
import type { Contest, ContestIdeationSession } from "@/types/contest";

type ContestPreparationExperienceProps = {
  contest: Contest;
  isLoggedIn: boolean;
  initialSession: ContestIdeationSession | null;
};

function ProgressCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</div>
        <div className="text-sm font-semibold text-[var(--foreground)]">{value}%</div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <div className="h-full rounded-full bg-[var(--foreground)] transition-all" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </div>
  );
}

function buildPrimaryLabel(session: ContestIdeationSession | null) {
  if (!session) {
    return "이 공모전 준비 시작하기";
  }

  if (session.status === "selected") {
    return "확정한 아이디어 보기";
  }

  return "이전 작업 이어서 보기";
}

function buildIdeationStatus(session: ContestIdeationSession | null) {
  if (!session) {
    return {
      title: "아직 시작 전",
      description: "준비 시작하기를 누르면 AI가 방향을 잡고, 아이디어 후보를 뽑아준 뒤, 최종 추천까지 이어서 보여줍니다.",
    };
  }

  if (session.status === "selected") {
    return {
      title: "아이디어 확정 완료",
      description: session.matrixSummary ?? "이제 바로 팀 빌딩으로 넘겨서 역할 분담을 시작하면 됩니다.",
    };
  }

  if (session.currentStage === "what") {
    return {
      title: "아이디어 뽑기 진행 중",
      description: "좋아요만 눌러도 충분합니다. AI가 그 선택을 바탕으로 최종 추천 순위를 정리해줍니다.",
    };
  }

  if (session.currentStage === "matrix") {
    return {
      title: "최종 선택 직전",
      description: session.matrixSummary ?? "이제 추천 순위를 보고 하나만 확정하면 됩니다.",
    };
  }

  return {
    title: "꿈꾸기 진행 중",
    description: "이 공모전으로 무엇을 이루고 싶은지만 고르면 다음 단계 아이디어는 AI가 바로 이어서 만들어줍니다.",
  };
}

export function ContestPreparationExperience({
  contest,
  isLoggedIn,
  initialSession,
}: ContestPreparationExperienceProps) {
  const [session, setSession] = useState(initialSession);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSeedVersion, setModalSeedVersion] = useState(0);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextPath = `/contests/${contest.slug}`;
  const primaryLabel = buildPrimaryLabel(session);
  const teamHref = session ? `/team/${contest.id}?session=${session.id}` : "#";
  const loginActionLabel = getViewerContinueActionLabel(nextPath);
  const returnDescription = getViewerReturnDescription(nextPath);
  const ideationStatus = buildIdeationStatus(session);
  const openingStatus = session
    ? {
        title: "저장된 준비 흐름을 불러오는 중",
        body: "마지막으로 보던 단계와 선택값을 다시 붙이고 있습니다.",
      }
    : {
        title: "브레인스토밍 세션을 여는 중",
        body: "공고 정보와 전략 리포트를 묶어서 바로 이어갈 수 있게 준비하고 있습니다.",
      };

  function closeLoginModal() {
    setIsLoginModalOpen(false);
  }

  function openLoginModal() {
    setIsLoginModalOpen(true);
  }

  function handleOpenIdeation() {
    setError(null);

    if (!isLoggedIn) {
      openLoginModal();
      return;
    }

    if (session && session.currentStage !== "strategy") {
      setModalSeedVersion((current) => current + 1);
      setIsModalOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/contests/${contest.slug}/ideation/start`, {
          method: "POST",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? "브레인스토밍 세션을 시작하지 못했습니다.");
          return;
        }

        const payload = (await response.json()) as { session: ContestIdeationSession };
        setSession(payload.session);
        setModalSeedVersion((current) => current + 1);
        setIsModalOpen(true);
      } catch {
        setError("브레인스토밍 세션을 시작하지 못했습니다.");
      }
    });
  }

  return (
    <>
      <section className="mt-8 grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
        <div className="surface-card rounded-[32px] p-7 md:p-8">
          <div className="eyebrow">준비 플로우</div>
          <h2 className="text-balance mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-4xl">
            전략 읽고, 아이디어 고르고, 팀 짜기까지 여기서 바로 이어집니다.
          </h2>
          <p className="text-pretty mt-4 text-sm leading-7 text-[var(--muted)]">
            공고를 읽고 끝나는 게 아니라, AI가 방향을 같이 잡아주고 최종 아이디어까지 골라준 뒤 팀 빌딩으로 넘깁니다.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <ProgressCard
              label="전략 분석"
              value={session?.progress.strategy ?? 0}
              description={session?.progress.strategy ? "전략 리포트를 읽고 준비 흐름을 시작했습니다." : "먼저 대회 감을 빠르게 잡는 단계입니다."}
            />
            <ProgressCard
              label="브레인스토밍"
              value={session?.progress.ideation ?? 0}
              description={
                session?.status === "selected"
                  ? "꿈꾸기, 아이디어 뽑기, 최종 선택까지 끝냈습니다."
                  : session
                    ? session.currentStage === "what"
                      ? "아이디어 후보를 고르는 중입니다."
                      : session.currentStage === "matrix"
                        ? "AI가 추천 순위를 정리해뒀습니다."
                        : "지금은 방향만 고르면 다음 단계로 바로 넘어갑니다."
                    : "3단계로 가볍게 끝나는 흐름입니다."
              }
            />
            <ProgressCard
              label="팀 빌딩"
              value={session?.progress.team ?? 0}
              description={
                session?.status === "selected"
                  ? session.progress.team === 100
                    ? "팀 빌딩 진입 페이지를 이미 열었습니다."
                    : "아이디어가 확정되어 팀 빌딩 CTA가 활성화됐습니다."
                  : "아이디어 확정 후에만 팀 빌딩으로 넘길 수 있습니다."
              }
            />
          </div>

          <div className="mt-6 rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">현재 상태</div>
            <div className="mt-3 text-lg font-semibold text-[var(--foreground)]">{ideationStatus.title}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{ideationStatus.description}</p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={handleOpenIdeation} className="primary-button flex-1" disabled={isPending}>
              {isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FaArrowRight className="h-3.5 w-3.5" aria-hidden />}
              {primaryLabel}
            </button>

            {session?.status === "selected" ? (
              <Link href={teamHref} className="secondary-button flex-1">
                <FaUsers className="h-3.5 w-3.5" aria-hidden />
                AI 팀 빌딩 시작하기
              </Link>
            ) : (
              <button type="button" className="secondary-button flex-1" disabled>
                <FaCheck className="h-3.5 w-3.5" aria-hidden />
                아이디어 확정 후 팀 빌딩
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            <span className="chip-nowrap rounded-full border border-[var(--border)] px-3 py-1.5">조회 {formatCompactNumber(contest.viewCount)}</span>
            <span className="chip-nowrap rounded-full border border-[var(--border)] px-3 py-1.5">
              상금 {contest.prizePoolKrw ? "크게" : "미정"}
            </span>
            <span className="chip-nowrap rounded-full border border-[var(--border)] px-3 py-1.5">
              {contest.teamAllowed ? "팀전 가능" : "개인전"}
            </span>
          </div>

          {isPending ? (
            <div className="loading-note mt-5">
              <span className="loading-note-spinner" aria-hidden />
              <div className="min-w-0">
                <div className="loading-note-title">{openingStatus.title}</div>
                <div className="loading-note-body">{openingStatus.body}</div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-[20px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}
        </div>

        <InsightPanel
          contest={contest}
          ideationSession={session}
          isLoggedIn={isLoggedIn}
          isOpening={isPending}
          onOpenIdeation={handleOpenIdeation}
        />
      </section>

      {session ? (
        <ContestIdeationModal
          key={`${session.id}:${modalSeedVersion}`}
          slug={contest.slug}
          contestId={contest.id}
          contestTitle={contest.title}
          isOpen={isModalOpen}
          session={session}
          onClose={() => setIsModalOpen(false)}
          onSessionChange={setSession}
        />
      ) : null}

      {isLoginModalOpen ? (
        <div className="login-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="contest-ideation-login-title">
          <div className="login-modal-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow">로그인 필요</div>
                <h3 id="contest-ideation-login-title" className="mt-3 text-xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  로그인 후 지금 흐름을 그대로 이어서 준비할 수 있습니다.
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {returnDescription} 지금 고른 방향과 확정 아이디어도 자동으로 이어집니다.
                </p>
              </div>
              <button type="button" onClick={closeLoginModal} className="hero-action-button shrink-0" aria-label="닫기">
                <FaXmark className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href={`/auth/google?next=${encodeURIComponent(nextPath)}`} className="primary-button flex-1">
                {loginActionLabel}
              </a>
              <button type="button" onClick={closeLoginModal} className="secondary-button flex-1">
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
