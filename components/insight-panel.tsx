import { StrategyLabPanel } from "@/components/strategy-lab-panel";
import { formatCategory, formatDifficulty, getDaysUntil } from "@/lib/utils";
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

function splitJudgingFocus(text: string) {
  return text
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildStackSignals(contest: Contest) {
  return Array.from(new Set([...contest.toolsAllowed, ...contest.aiCategories.map(formatCategory), ...contest.tags])).slice(0, 6);
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

  if ((getDaysUntil(contest.deadline) ?? 99) <= 7) {
    baseItems.push("마감 직전 업로드 이슈를 피하려고 제출 하루 전 내부 마감 시점을 따로 잡기");
  }

  if (contest.language === "English") {
    baseItems.push("영문 발표 스크립트와 데모 설명 문장을 미리 준비하기");
  }

  return Array.from(new Set(baseItems)).slice(0, 5);
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
  const strategyLines = splitReportLines(analysis.winStrategy);
  const judgingPoints = splitJudgingFocus(analysis.judgingFocus);
  const stackSignals = buildStackSignals(contest);
  const checklist = buildChecklist(contest);

  return (
    <section className="surface-card rounded-[32px] p-7 md:p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="eyebrow">AI 전략 리포트</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-4xl">
            공고를 읽기 전에, 상위권 전략부터 먼저 봅니다.
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            이 리포트는 추천 이유, 심사 포인트, 준비 순서를 한 번에 정리한 전략 요약본입니다. 대학생 팀이 바로 실행으로 옮길 수
            있게 체크리스트까지 같이 붙였습니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[360px] xl:grid-cols-1">
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">난도</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatDifficulty(contest.difficulty)}</div>
          </div>
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">팀 구성</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {contest.teamAllowed ? `${contest.minTeamSize}-${contest.maxTeamSize}명 팀 참가` : "개인 참가"}
            </div>
          </div>
          <div className="report-card">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">언어 / 리포트</div>
            <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {contest.language} · {analysis.modelName ?? "GPT"}
            </div>
          </div>
        </div>
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
          <div className="mt-6 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-5">
              <div className="insight-card">
                <div className="insight-label">핵심 요약</div>
                <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{analysis.summary}</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="insight-card">
                  <div className="insight-label">왜 이 대회인가</div>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{analysis.recommendReason}</p>
                </div>

                <div className="insight-card">
                  <div className="insight-label">난도 해석</div>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{analysis.difficultyAnalysis}</p>
                </div>
              </div>

              <div className="insight-card">
                <div className="insight-label">상위권 전략</div>
                <div className="mt-4 space-y-3">
                  {strategyLines.map((line, index) => (
                    <div key={line} className="report-step">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-sm font-semibold text-[var(--foreground)]">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-7 text-[var(--foreground)]">{line}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="insight-card">
                <div className="insight-label">추천 기술 스택</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {stackSignals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)]"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              <div className="insight-card">
                <div className="insight-label">심사 포인트</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {judgingPoints.map((point) => (
                    <span
                      key={point}
                      className="rounded-full border border-[rgba(139,164,216,0.22)] bg-[rgba(139,164,216,0.1)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)]"
                    >
                      {point}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                  Generated by {analysis.modelName ?? "GPT"} · prompt {analysis.promptVersion ?? "contest-v1"}
                </p>
              </div>

              <div className="insight-card">
                <div className="insight-label">지원 전 체크리스트</div>
                <div className="mt-4 space-y-3">
                  {checklist.map((item) => (
                    <div key={item} className="report-step">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(88,239,191,0.12)] text-sm font-semibold text-[var(--success)]">
                        ✓
                      </div>
                      <p className="text-sm leading-7 text-[var(--foreground)]">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <StrategyLabPanel slug={contest.slug} title={contest.title} />
        </>
      )}
    </section>
  );
}
