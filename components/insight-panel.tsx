import { StrategyLabPanel } from "@/components/strategy-lab-panel";
import { getDaysUntil } from "@/lib/utils";
import type { Contest } from "@/types/contest";

interface InsightPanelProps {
  contest: Contest;
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

  return `${items.length}개 항목`;
}

function buildChecklist(contest: Contest) {
  const baseItems = [
    contest.eligibilityText
      ? "참가 자격과 제출 전 필요한 증빙 서류를 먼저 체크하기"
      : "참가 자격, 제출 계정, 연락처 정보를 먼저 정리하기",
    contest.applyUrl
      ? "신청 링크와 제출 폼 항목을 미리 열어 보고, 마지막 업로드 방식까지 확인하기"
      : "원문 공고에서 접수 경로와 마감 직전 제출 절차를 다시 확인하기",
    contest.submissionFormat
      ? `제출 형식 요건을 기준으로 결과물 포맷과 파일 용량을 미리 맞춰 두기`
      : "결과물 포맷, 분량, 제출 파일 이름 규칙을 먼저 정리하기",
    contest.teamAllowed
      ? "팀 역할 분담과 피드백 일정을 먼저 고정하고, 데모·발표·제출 담당을 나누기"
      : "개인 참가 기준에 맞게 제작 범위를 줄이고 데모 완성도를 우선순위에 두기",
  ];

  if (contest.datasetProvided) {
    baseItems.push("제공 자료와 데이터셋의 사용 범위, 저작권 조건, 평가 기준을 먼저 읽기");
  }

  const submissionItemSummary = summarizeSubmissionItems(contest);

  if (submissionItemSummary) {
    baseItems.push(`접수 항목과 필수 증빙을 미리 체크리스트로 정리하기 (${submissionItemSummary})`);
  }

  if ((getDaysUntil(contest.deadline) ?? 99) <= 7) {
    baseItems.push("마감 직전 업로드 이슈를 피하려고 제출 하루 전 내부 마감 시점을 따로 잡기");
  }

  if (contest.language === "English") {
    baseItems.push("영문 발표 스크립트와 데모 설명 문장을 미리 준비하기");
  }

  return Array.from(new Set(baseItems)).slice(0, 5);
}

function buildExecutionPlan(contest: Contest) {
  return Array.from(new Set([...splitReportLines(contest.analysis.winStrategy), ...buildChecklist(contest)])).slice(0, 6);
}

function buildSignalSummary(contest: Contest) {
  if (contest.judgingCriteria?.length) {
    return contest.judgingCriteria
      .slice(0, 3)
      .map((criterion) => (criterion.weight ? `${criterion.label} ${criterion.weight}%` : criterion.label))
      .join(" · ");
  }

  return contest.analysis.judgingFocus;
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

export function InsightPanel({ contest }: InsightPanelProps) {
  const { analysis } = contest;
  const executionPlan = buildExecutionPlan(contest);
  const signalSummary = buildSignalSummary(contest);

  return (
    <section className="surface-card rounded-[32px] p-7 md:p-8">
      <div className="max-w-3xl">
        <div className="eyebrow">AI 전략 리포트</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-4xl">
          공고와 심사 기준을 기준으로, 바로 실행할 플랜만 추렸습니다.
        </h2>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          공고 정보와 겹치는 설명은 빼고, 상위권에 가까워지는 실행 순서만 간단하게 정리했습니다.
        </p>
      </div>

      {analysis.analysisStatus !== "completed" ? (
        <>
          <div className="mt-6">
            <StatusNotice contest={contest} />
          </div>
          <StrategyLabPanel slug={contest.slug} title={contest.title} />
        </>
      ) : (
        <>
          <div className="mt-6 space-y-5">
            <div className="insight-card">
              <div className="insight-label">핵심 메모</div>
              <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{analysis.recommendReason}</p>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{analysis.summary}</p>
              {signalSummary ? (
                <p className="mt-4 text-xs leading-6 text-[var(--muted)]">심사 기준 포인트: {signalSummary}</p>
              ) : null}
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
              <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                Generated by {analysis.modelName ?? "GPT"} · prompt {analysis.promptVersion ?? "contest-v1"}
              </p>
            </div>
          </div>

          <StrategyLabPanel slug={contest.slug} title={contest.title} />
        </>
      )}
    </section>
  );
}
