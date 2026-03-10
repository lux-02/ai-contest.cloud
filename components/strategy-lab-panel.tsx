"use client";

import { startTransition, useState, useTransition } from "react";

import type { ContestStrategyLabResult } from "@/types/contest";

type StrategyLabPanelProps = {
  slug: string;
  title: string;
};

function formatSourceType(sourceType: string) {
  if (sourceType.startsWith("search_result:")) {
    return `외부 검색 · ${sourceType.replace("search_result:", "")}`;
  }

  if (sourceType === "stored_brief") {
    return "저장된 공고";
  }

  if (sourceType === "original_notice") {
    return "원문 공고";
  }

  if (sourceType === "source_page") {
    return "수집 소스";
  }

  if (sourceType === "apply_page") {
    return "신청 페이지";
  }

  return sourceType;
}

export function StrategyLabPanel({ slug, title }: StrategyLabPanelProps) {
  const [result, setResult] = useState<ContestStrategyLabResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ideaInput, setIdeaInput] = useState("");
  const [lastIdea, setLastIdea] = useState<string | null>(null);
  const [isPending, startLoading] = useTransition();

  async function handleGenerate() {
    setError(null);
    const trimmedIdea = ideaInput.trim();

    startLoading(async () => {
      try {
        const response = await fetch(`/api/contests/${slug}/strategy-lab`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refresh: Boolean(result) && !trimmedIdea,
            userIdea: trimmedIdea || undefined,
          }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? "브레인스토밍 생성에 실패했습니다.");
          return;
        }

        const data = (await response.json()) as ContestStrategyLabResult;
        startTransition(() => {
          setResult(data);
          setLastIdea(trimmedIdea || null);
        });
      } catch {
        setError("브레인스토밍 생성에 실패했습니다.");
      }
    });
  }

  return (
    <div className="mt-6 rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">브레인스토밍 랩</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            공고와 전략 리포트를 바탕으로 아이디어 리스트, 딥 리서치 메모, 기획/전략 초안을 한 번에 생성합니다.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={handleGenerate} disabled={isPending}>
          {isPending ? "생성 중..." : ideaInput.trim() ? "아이디어 맞춤 초안 만들기" : result ? "다시 브레인스토밍" : "브레인스토밍"}
        </button>
      </div>

      <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <label htmlFor={`strategy-idea-${slug}`} className="text-sm font-semibold text-[var(--foreground)]">
          내 아이디어 초안
        </label>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          한 줄 아이디어나 방향만 적어도 됩니다. 심사 기준과 준비 항목에 맞춰 더 설득력 있는 전략 초안으로 다시 정리합니다.
        </p>
        <textarea
          id={`strategy-idea-${slug}`}
          value={ideaInput}
          onChange={(event) => setIdeaInput(event.target.value)}
          rows={4}
          placeholder="예: 골프 GTI의 퍼포먼스를 젊은 세대 감성으로 보여주는 30초 AI 광고를 만들고 싶어요."
          className="mt-3 min-h-[112px] w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[rgba(245,241,232,0.24)]"
        />
      </div>

      {error ? (
        <div className="mt-4 rounded-[20px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {isPending ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="h-4 w-32 rounded-full bg-[rgba(255,255,255,0.08)]" />
                <div className="mt-3 h-3 w-full rounded-full bg-[rgba(255,255,255,0.08)]" />
                <div className="mt-2 h-3 w-5/6 rounded-full bg-[rgba(255,255,255,0.08)]" />
              </div>
            ))}
          </div>
          <div className="rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
            <div className="h-4 w-40 rounded-full bg-[rgba(255,255,255,0.08)]" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-3 rounded-full bg-[rgba(255,255,255,0.08)]" />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {result?.status === "completed" ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">추천 방향</div>
            {lastIdea ? (
              <div className="mt-3 rounded-[18px] border border-[rgba(245,241,232,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-6 text-[var(--foreground)]">
                입력한 아이디어: {lastIdea}
              </div>
            ) : null}
            <p className="mt-3 text-base leading-7 text-[var(--foreground)]">{result.overview}</p>
            <div className="mt-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
              추천 콘셉트: {result.recommendedDirection}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">아이디어 리스트업</div>
                <div className="mt-4 space-y-3">
                  {result.ideas.map((idea, index) => (
                    <div key={idea.title} className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[#090b0f]">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--foreground)]">{idea.title}</div>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{idea.concept}</p>
                          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                            상위권 포인트: {idea.winningEdge}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                            실행 포커스: {idea.executionFocus}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">딥 리서치 메모</div>
                <div className="mt-4 space-y-3">
                  {result.researchPoints.map((point) => (
                    <div key={point.title} className="rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                      <div className="text-sm font-semibold text-[var(--foreground)]">{point.title}</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{point.insight}</p>
                      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">실행 액션: {point.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5 md:p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">기획 / 전략 초안</div>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">{result.draftTitle}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{result.draftSubtitle}</p>

              <div className="mt-6 space-y-5">
                {result.draftSections.map((section) => (
                  <section key={section.title} className="border-t border-[var(--border)] pt-5 first:border-none first:pt-0">
                    <div className="text-sm font-semibold text-[var(--foreground)]">{section.title}</div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">{section.body}</p>
                  </section>
                ))}
              </div>

              <div className="mt-6 rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-xs leading-5 text-[var(--muted)]">
                {title} 공고와 AI 전략 리포트를 바탕으로 정리한 초안입니다. 실제 제출 전에는 팀 구성, 자료 수급, 저작권 조건을 다시 확인하는 편이 안전합니다.
              </div>
            </div>
          </div>

          {result.citations.length > 0 ? (
            <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">참고한 소스</div>
              <div className="mt-4 space-y-3">
                {result.citations.map((citation) => (
                  <div key={citation.label} className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[#090b0f]">
                        {citation.label}
                      </span>
                      <div className="text-sm font-semibold text-[var(--foreground)]">{citation.title}</div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{citation.snippet}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      <span>{formatSourceType(citation.sourceType)}</span>
                      {typeof citation.rankingScore === "number" ? <span>랭킹 {citation.rankingScore.toFixed(2)}</span> : null}
                      {typeof citation.citationScore === "number" ? (
                        <span>인용 적합도 {citation.citationScore.toFixed(2)}</span>
                      ) : null}
                      {citation.searchQuery ? <span>검색어: {citation.searchQuery}</span> : null}
                      {citation.url ? (
                        <a href={citation.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                          원문 보기
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {result?.status === "pending" ? (
        <div className="mt-4 rounded-[20px] border border-[rgba(255,200,87,0.18)] bg-[rgba(255,200,87,0.08)] px-4 py-3 text-sm leading-6 text-[var(--warning)]">
          OpenAI 연결이 아직 준비되지 않아 브레인스토밍 결과를 바로 만들지 못했습니다.
        </div>
      ) : null}
    </div>
  );
}
