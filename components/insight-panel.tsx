"use client";

import type { Contest, ContestIdeationSession } from "@/types/contest";

interface InsightPanelProps {
  contest: Contest;
  ideationSession: ContestIdeationSession | null;
  isLoggedIn: boolean;
  isOpening: boolean;
  onOpenIdeation: () => void;
}

function splitReportLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function summarizeSubmissionItems(contest: Contest) {
  const items = (contest.submissionItems ?? [])
    .map((item) => item.replace(/^•\s*/, "").trim())
    .filter(Boolean);

  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    return items[0];
  }

  return `${items.length}개 접수 항목`;
}

function buildExecutionPlan(contest: Contest) {
  const lines = splitReportLines(contest.analysis.winStrategy);
  const items = [
    lines[0],
    lines[1],
    contest.judgingCriteria?.[0]?.label ? `${contest.judgingCriteria[0].label} 기준을 데모에 직접 드러내기` : null,
    summarizeSubmissionItems(contest) ? `${summarizeSubmissionItems(contest)}을 제출 직전에 다시 점검하기` : null,
  ];

  return items.filter((item): item is string => Boolean(item)).slice(0, 4);
}

function buildStrategyCtaLabel(session: ContestIdeationSession | null) {
  if (!session) {
    return "이 전략 기반으로 아이디어 brainstorm 해볼까요?";
  }

  if (session.status === "selected") {
    return "확정한 아이디어와 Matrix 다시 보기";
  }

  return "이전 브레인스토밍 이어서 보기";
}

function StatusNotice({ contest }: { contest: Contest }) {
  if (contest.analysis.analysisStatus === "pending") {
    return (
      <div className="rounded-[24px] border border-[rgba(255,200,87,0.18)] bg-[rgba(255,200,87,0.08)] p-5">
        <div className="text-sm font-semibold text-[var(--foreground)]">리포트 생성 대기 중</div>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          대회는 저장됐고 분석 row도 생성됐습니다. 자동 분석이 아직 돌지 않았거나 OpenAI 연결이 끝나지 않은 상태입니다.
        </p>
      </div>
    );
  }

  if (contest.analysis.analysisStatus === "failed") {
    return (
      <div className="rounded-[24px] border border-[rgba(255,125,136,0.18)] bg-[rgba(255,125,136,0.08)] p-5">
        <div className="text-sm font-semibold text-[var(--foreground)]">리포트 생성 실패</div>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          대회 저장은 완료됐지만 분석 응답을 만들지 못했습니다. API 응답이나 키 설정을 확인한 뒤 다시 생성하면 됩니다.
        </p>
      </div>
    );
  }

  return null;
}

export function InsightPanel({ contest, ideationSession, isLoggedIn, isOpening, onOpenIdeation }: InsightPanelProps) {
  const executionPlan = buildExecutionPlan(contest);
  const ctaLabel = buildStrategyCtaLabel(ideationSession);

  return (
    <section className="surface-card rounded-[32px] p-7 md:p-8">
      <div className="max-w-3xl">
        <div className="eyebrow">AI 전략 리포트</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-4xl">
          심사 기준과 제출 요건을 기준으로, 바로 실행할 전략만 남겼습니다.
        </h2>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          공고 내용과 겹치는 설명은 걷어내고, 상위권 설계에 직접 필요한 판단만 짧게 정리했습니다.
        </p>
      </div>

      {contest.analysis.analysisStatus !== "completed" ? (
        <div className="mt-6">
          <StatusNotice contest={contest} />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-5">
            <div className="insight-card">
              <div className="insight-label">핵심 메모</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{contest.analysis.recommendReason}</p>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{contest.analysis.summary}</p>
            </div>

            <div className="insight-card">
              <div className="insight-label">상위권 실행 플랜</div>
              <div className="mt-4 space-y-3">
                {executionPlan.map((item, index) => (
                  <div key={item} className="report-step">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-sm font-semibold text-[var(--foreground)]">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-7 text-[var(--foreground)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">다음 단계</div>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              전략을 읽었다면, 이제 Why → How → What → Matrix 순서로 아이디어를 좁히면 됩니다.
            </h3>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {isLoggedIn
                ? "선택지 3개에서 WHY를 고르고, 영향 가설을 세운 뒤, 아이디어 후보를 Matrix로 객관적으로 추릴 수 있습니다."
                : "로그인 후 브레인스토밍을 시작하면 단계별 draft가 자동 저장되고, 나중에 이어서 볼 수 있습니다."}
            </p>

            {ideationSession ? (
              <div className="mt-5 rounded-[20px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">현재 저장 상태</div>
                <div className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                  {ideationSession.status === "selected"
                    ? "아이디어 확정 완료"
                    : `현재 단계: ${ideationSession.currentStage === "why"
                        ? "Why"
                        : ideationSession.currentStage === "how"
                          ? "How"
                          : ideationSession.currentStage === "what"
                            ? "What"
                            : ideationSession.currentStage === "matrix"
                              ? "Decision Matrix"
                              : "전략 분석"}`}
                </div>
                {ideationSession.matrixSummary ? (
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{ideationSession.matrixSummary}</p>
                ) : null}
              </div>
            ) : null}

            <button type="button" onClick={onOpenIdeation} className="primary-button mt-6 w-full" disabled={isOpening}>
              {isOpening ? "불러오는 중..." : ctaLabel}
            </button>
            <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
              Generated by {contest.analysis.modelName ?? "GPT"} · prompt {contest.analysis.promptVersion ?? "contest-v1"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
