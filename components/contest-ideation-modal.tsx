"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { FaArrowRight, FaCheck, FaChevronLeft, FaPlus, FaSpinner, FaUsers, FaXmark } from "react-icons/fa6";

import { decisionMatrixPresetWeights } from "@/lib/contest-ideation";
import { cn } from "@/lib/utils";
import type {
  ContestDecisionMatrixPreset,
  ContestIdeationSession,
  ContestIdeaCandidate,
} from "@/types/contest";

type VoteState = "liked" | "skipped" | "neutral";
type UiStep = "dream" | "ideas" | "final";

type CustomIdeaDraft = {
  id: string;
  title: string;
  description: string;
};

type ContestIdeationModalProps = {
  slug: string;
  contestId: string;
  contestTitle: string;
  isOpen: boolean;
  session: ContestIdeationSession;
  onClose: () => void;
  onSessionChange: (session: ContestIdeationSession) => void;
};

type LocalStateSeed = {
  activeStep: UiStep;
  selectedWhyId: string;
  whyText: string;
  userIdeaSeed: string;
  votes: Record<string, VoteState>;
  customIdeas: CustomIdeaDraft[];
  selectedPreset: ContestDecisionMatrixPreset;
  selectedIdeaId: string;
};

const uiSteps: Array<{ id: UiStep; label: string; shortLabel: string; emoji: string }> = [
  { id: "dream", label: "꿈꾸기", shortLabel: "1/3", emoji: "✨" },
  { id: "ideas", label: "아이디어 뽑기", shortLabel: "2/3", emoji: "💡" },
  { id: "final", label: "최종 선택 & 팀 짜기", shortLabel: "3/3", emoji: "🚀" },
];

const presetMeta: Array<{ id: ContestDecisionMatrixPreset; label: string; hint: string }> = [
  { id: "balanced", label: "균형", hint: "처음이면 무난" },
  { id: "impact", label: "상금 노리기", hint: "임팩트 크게" },
  { id: "deadline", label: "마감 우선", hint: "빨리 완성" },
];

function mapStageToUiStep(session: ContestIdeationSession): UiStep {
  if (session.currentStage === "what") {
    return "ideas";
  }

  if (session.currentStage === "matrix" || session.currentStage === "selected") {
    return "final";
  }

  return "dream";
}

function formatSavedAt(value?: string | null) {
  if (!value) {
    return "자동 저장 전";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function createLocalStateSeed(session: ContestIdeationSession): LocalStateSeed {
  return {
    activeStep: mapStageToUiStep(session),
    selectedWhyId: session.selectedWhyId ?? session.whyOptions[0]?.id ?? "",
    whyText:
      session.whyEditedText ??
      session.selectedWhy ??
      session.whyOptions.find((option) => option.isSelected)?.body ??
      session.whyOptions[0]?.body ??
      "",
    userIdeaSeed: session.userIdeaSeed ?? "",
    votes: Object.fromEntries(session.ideaCandidates.map((candidate) => [candidate.id, candidate.voteState])) as Record<string, VoteState>,
    customIdeas: session.ideaCandidates
      .filter((candidate) => candidate.source === "user")
      .map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        description: candidate.description,
      })),
    selectedPreset: session.selectedMatrixPreset ?? session.recommendedMatrixPreset,
    selectedIdeaId: session.selectedIdeaId ?? session.topRecommendations[0]?.id ?? session.matrixRows[0]?.id ?? "",
  };
}

function ProgressPills({ activeStep }: { activeStep: UiStep }) {
  const activeIndex = uiSteps.findIndex((step) => step.id === activeStep);

  return (
    <div className="flex flex-wrap gap-2">
      {uiSteps.map((step, index) => {
        const isActive = step.id === activeStep;
        const isDone = index < activeIndex;

        return (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
              isActive
                ? "border-[rgba(245,241,232,0.28)] bg-[rgba(245,241,232,0.12)] text-[var(--foreground)]"
                : isDone
                  ? "border-[rgba(54,179,126,0.28)] bg-[rgba(54,179,126,0.12)] text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)]",
            )}
          >
            <span>{step.emoji}</span>
            <span>{step.shortLabel}</span>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RankingLabel({ index }: { index: number }) {
  const labels = ["🔥 1위 예상", "👍 2위", "🤔 3위"];
  return <span>{labels[index] ?? `후보 ${index + 1}`}</span>;
}

function summarizeHow(session: ContestIdeationSession) {
  return session.selectedHow ?? session.howHypotheses[0]?.body ?? "AI가 심사 포인트를 읽고 바로 다음 단계 아이디어를 뽑아줄게요.";
}

function trimLine(text: string, fallback: string) {
  const value = text.trim();

  if (!value) {
    return fallback;
  }

  const [firstLine] = value.split(/\n+/);
  return firstLine.trim();
}

export function ContestIdeationModal({
  slug,
  contestId,
  contestTitle,
  isOpen,
  session,
  onClose,
  onSessionChange,
}: ContestIdeationModalProps) {
  const initialSeed = createLocalStateSeed(session);
  const [activeStep, setActiveStep] = useState<UiStep>(initialSeed.activeStep);
  const [selectedWhyId, setSelectedWhyId] = useState(initialSeed.selectedWhyId);
  const [whyText, setWhyText] = useState(initialSeed.whyText);
  const [userIdeaSeed, setUserIdeaSeed] = useState(initialSeed.userIdeaSeed);
  const [votes, setVotes] = useState<Record<string, VoteState>>(initialSeed.votes);
  const [customIdeas, setCustomIdeas] = useState<CustomIdeaDraft[]>(initialSeed.customIdeas);
  const [selectedPreset, setSelectedPreset] = useState<ContestDecisionMatrixPreset>(initialSeed.selectedPreset);
  const [selectedIdeaId, setSelectedIdeaId] = useState(initialSeed.selectedIdeaId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastOpenRef = useRef(isOpen);
  const lastSessionIdRef = useRef(session.id);

  const aiIdeaCandidates = session.ideaCandidates.filter((candidate) => candidate.source === "ai");
  const rankingCandidates = session.topRecommendations.length > 0 ? session.topRecommendations : session.matrixRows.slice(0, 3);
  const teamHref = `/team/${contestId}?session=${session.id}`;
  const canGoBack = (activeStep === "ideas" || (activeStep === "final" && session.status !== "selected")) && !isPending;

  useEffect(() => {
    const shouldHydrate = (isOpen && !lastOpenRef.current) || session.id !== lastSessionIdRef.current;

    lastOpenRef.current = isOpen;
    lastSessionIdRef.current = session.id;

    if (!shouldHydrate) {
      return;
    }

    const nextSeed = createLocalStateSeed(session);
    setActiveStep(nextSeed.activeStep);
    setSelectedWhyId(nextSeed.selectedWhyId);
    setWhyText(nextSeed.whyText);
    setUserIdeaSeed(nextSeed.userIdeaSeed);
    setVotes(nextSeed.votes);
    setCustomIdeas(nextSeed.customIdeas);
    setSelectedPreset(nextSeed.selectedPreset);
    setSelectedIdeaId(nextSeed.selectedIdeaId);
    setError(null);
  }, [isOpen, session]);

  async function requestSession(path: string, body?: Record<string, unknown>) {
    const response = await fetch(`/api/contests/${slug}/ideation/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : "{}",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "브레인스토밍 저장에 실패했습니다.");
    }

    const payload = (await response.json()) as { session: ContestIdeationSession };
    onSessionChange(payload.session);
    return payload.session;
  }

  function addCustomIdea() {
    setCustomIdeas((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        title: "",
        description: "",
      },
    ]);
  }

  function updateCustomIdea(id: string, field: keyof CustomIdeaDraft, value: string) {
    setCustomIdeas((current) => current.map((idea) => (idea.id === id ? { ...idea, [field]: value } : idea)));
  }

  function removeCustomIdea(id: string) {
    setCustomIdeas((current) => current.filter((idea) => idea.id !== id));
  }

  function handleVote(candidateId: string, voteState: VoteState) {
    setVotes((current) => ({
      ...current,
      [candidateId]: current[candidateId] === voteState ? "neutral" : voteState,
    }));
  }

  function handlePrevious() {
    if (activeStep === "ideas") {
      setActiveStep("dream");
      setError(null);
      return;
    }

    if (activeStep === "final" && session.status !== "selected") {
      setActiveStep("ideas");
      setError(null);
    }
  }

  function handleDreamNext() {
    if (!selectedWhyId) {
      setError("먼저 마음에 드는 방향을 하나 골라 주세요.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const whySession = await requestSession("why", {
          selectedCandidateId: selectedWhyId,
          editedText: whyText,
        });

        const nextHow = whySession.howHypotheses[0];

        if (!nextHow) {
          throw new Error("다음 단계 아이디어 방향을 만들지 못했습니다.");
        }

        const whatSession = await requestSession("how", {
          selectedCandidateId: nextHow.id,
          editedText: nextHow.body,
        });

        setSelectedIdeaId(whatSession.selectedIdeaId ?? whatSession.ideaCandidates.find((candidate) => candidate.source === "ai")?.id ?? "");
        setActiveStep("ideas");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "다음 단계로 넘어가지 못했습니다.");
      }
    });
  }

  function handleIdeasNext() {
    setError(null);

    startTransition(async () => {
      try {
        await requestSession("what", {
          votes: Object.entries(votes).map(([candidateId, voteState]) => ({
            candidateId,
            voteState,
          })),
          customIdeas: customIdeas
            .filter((idea) => idea.title.trim() || idea.description.trim())
            .map((idea) => ({
              title: trimLine(idea.title, "직접 추가한 아이디어"),
              description: idea.description.trim(),
              pros: [],
              cons: [],
              fitReason: trimLine(idea.description, "직접 떠올린 방향"),
            })),
          userIdeaSeed,
        });

        const matrixSession = await requestSession("matrix", {
          preset: selectedPreset,
          weights: decisionMatrixPresetWeights[selectedPreset],
        });

        setSelectedIdeaId(matrixSession.selectedIdeaId ?? matrixSession.topRecommendations[0]?.id ?? matrixSession.matrixRows[0]?.id ?? "");
        setActiveStep("final");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "추천 순위를 만들지 못했습니다.");
      }
    });
  }

  function handlePresetRecalculate(preset: ContestDecisionMatrixPreset) {
    setSelectedPreset(preset);
    setError(null);

    startTransition(async () => {
      try {
        const matrixSession = await requestSession("matrix", {
          preset,
          weights: decisionMatrixPresetWeights[preset],
        });
        setSelectedIdeaId(matrixSession.selectedIdeaId ?? matrixSession.topRecommendations[0]?.id ?? matrixSession.matrixRows[0]?.id ?? "");
        setActiveStep("final");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "추천 순위를 다시 계산하지 못했습니다.");
      }
    });
  }

  function handleSelectIdea() {
    if (!selectedIdeaId) {
      setError("먼저 최종 후보 하나를 골라 주세요.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const nextSession = await requestSession("select", {
          ideaId: selectedIdeaId,
        });
        setSelectedIdeaId(nextSession.selectedIdeaId ?? selectedIdeaId);
        setActiveStep("final");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "아이디어 확정에 실패했습니다.");
      }
    });
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="login-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="ideation-modal-title">
      <div className="relative flex h-[min(92vh,920px)] w-[min(1120px,calc(100vw-20px))] flex-col overflow-hidden rounded-[32px] border border-[var(--border)] bg-[#090b0f] shadow-[0_24px_120px_rgba(0,0,0,0.45)]">
        <header className="border-b border-[var(--border)] px-5 py-4 md:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">AI 코치</div>
              <h2 id="ideation-modal-title" className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {contestTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                3단계만 따라가면, 이 공모전에 맞는 아이디어를 빠르게 고를 수 있어요.
              </p>
            </div>
            <button type="button" onClick={onClose} className="hero-action-button shrink-0" aria-label="닫기">
              <FaXmark className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <ProgressPills activeStep={activeStep} />
            <div className="text-xs leading-5 text-[var(--muted)]">임시 저장됨 · {formatSavedAt(session.updatedAt)}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
          {activeStep === "dream" ? (
            <div className="space-y-6">
              <div className="max-w-3xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">1/3 꿈꾸기</div>
                <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  이 공모전으로 제일 이루고 싶은 건 뭐야?
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  AI가 먼저 방향을 몇 개 골라놨어요. 마음에 드는 걸 하나 고르면, 다음 단계 아이디어는 우리가 바로 뽑아줄게요.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {session.whyOptions.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setSelectedWhyId(option.id);
                      setWhyText(option.body);
                    }}
                    className={cn(
                      "rounded-[24px] border p-5 text-left transition",
                      selectedWhyId === option.id
                        ? "border-[rgba(245,241,232,0.28)] bg-[rgba(245,241,232,0.1)]"
                        : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.05)]",
                    )}
                  >
                    <div className="text-xl">{["🌱", "🏁", "🎯"][index] ?? "✨"}</div>
                    <div className="mt-3 text-sm font-semibold text-[var(--foreground)]">{option.title}</div>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{option.body}</p>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                  <label htmlFor="ideation-dream-text" className="text-sm font-semibold text-[var(--foreground)]">
                    한 줄 메모만 남겨도 충분해요
                  </label>
                  <textarea
                    id="ideation-dream-text"
                    value={whyText}
                    onChange={(event) => setWhyText(event.target.value)}
                    rows={4}
                    placeholder="예: 포트폴리오로도 남고, 면접에서 설명하기 쉬운 방향이면 좋겠어."
                    className="mt-3 min-h-[120px] w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[rgba(245,241,232,0.24)]"
                  />
                </div>

                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-sm font-semibold text-[var(--foreground)]">AI가 바로 이어서 해주는 일</div>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                    <p>1. 네가 고른 방향을 심사 포인트에 맞게 정리해줘요.</p>
                    <p>2. 그 방향으로 갈 만한 아이디어를 6~8개 뽑아줘요.</p>
                    <p>3. 마지막엔 뭐가 제일 유리한지 순위까지 정리해줘요.</p>
                  </div>
                  <div className="mt-5 rounded-[18px] border border-[rgba(245,241,232,0.1)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)]">
                    3분 안에 끝내는 흐름으로 맞춰뒀어요.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === "ideas" ? (
            <div className="space-y-6">
              <div className="max-w-3xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">2/3 아이디어 뽑기</div>
                <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  이런 아이디어 어때?
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  마음에 드는 건 좋아요만 눌러두세요. AI가 그걸 바탕으로 바로 순위를 매길게요.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">네가 고른 방향</div>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{trimLine(whyText, session.selectedWhy ?? "방향을 다시 골라보세요.")}</p>
                </div>
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">AI가 본 승부 포인트</div>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{summarizeHow(session)}</p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {aiIdeaCandidates.map((idea) => {
                  const vote = votes[idea.id] ?? "neutral";

                  return (
                    <div key={idea.id} className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-[var(--foreground)]">{idea.title}</div>
                          <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{trimLine(idea.description, idea.title)}</p>
                        </div>
                        <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">AI 추천</div>
                      </div>
                      {idea.fitReason ? (
                        <p className="mt-4 text-xs leading-6 text-[var(--muted)]">왜 괜찮냐면: {trimLine(idea.fitReason, "공고와 잘 맞아요.")}</p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleVote(idea.id, "liked")}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                            vote === "liked"
                              ? "border-[rgba(54,179,126,0.32)] bg-[rgba(54,179,126,0.12)] text-[var(--foreground)]"
                              : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)]",
                          )}
                        >
                          👍 좋아요
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVote(idea.id, "skipped")}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                            vote === "skipped"
                              ? "border-[rgba(245,241,232,0.24)] bg-[rgba(245,241,232,0.1)] text-[var(--foreground)]"
                              : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)]",
                          )}
                        >
                          👀 패스
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">직접 떠오른 아이디어도 넣어둘래?</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">제목이랑 설명만 적으면 같이 순위에 올려줄게요.</p>
                  </div>
                  <button type="button" onClick={addCustomIdea} className="secondary-button">
                    <FaPlus className="h-3.5 w-3.5" aria-hidden />
                    직접 추가
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {customIdeas.map((idea) => (
                    <div key={idea.id} className="rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                      <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
                        <input
                          value={idea.title}
                          onChange={(event) => updateCustomIdea(idea.id, "title", event.target.value)}
                          placeholder="아이디어 제목"
                          className="rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                        />
                        <textarea
                          value={idea.description}
                          onChange={(event) => updateCustomIdea(idea.id, "description", event.target.value)}
                          rows={2}
                          placeholder="한두 줄 설명"
                          className="w-full rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none"
                        />
                      </div>
                      <button type="button" onClick={() => removeCustomIdea(idea.id)} className="mt-3 text-xs font-semibold text-[var(--muted)]">
                        이 아이디어 빼기
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-sm font-semibold text-[var(--foreground)]">AI가 순위 매길 때 더 크게 볼 기준</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {presetMeta.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPreset(preset.id)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-semibold transition",
                        selectedPreset === preset.id
                          ? "border-[rgba(245,241,232,0.28)] bg-[rgba(245,241,232,0.12)] text-[var(--foreground)]"
                          : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)]",
                      )}
                    >
                      {preset.label}
                      {session.recommendedMatrixPreset === preset.id ? " · 추천" : ""}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
                  {presetMeta.find((preset) => preset.id === selectedPreset)?.hint}
                </p>
              </div>

              <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-5">
                <label htmlFor="ideation-user-seed" className="text-sm font-semibold text-[var(--foreground)]">
                  이미 떠오른 방향이 있으면 한 줄만 적어줘
                </label>
                <textarea
                  id="ideation-user-seed"
                  value={userIdeaSeed}
                  onChange={(event) => setUserIdeaSeed(event.target.value)}
                  rows={3}
                  placeholder="예: 면접에서 설명하기 쉬운 데모형 서비스로 가고 싶어"
                  className="mt-3 min-h-[96px] w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[rgba(245,241,232,0.24)]"
                />
              </div>
            </div>
          ) : null}

          {activeStep === "final" ? (
            <div className="space-y-6">
              {session.status === "selected" ? (
                <div className="space-y-6">
                  <div className="max-w-3xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">3/3 완료</div>
                    <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                      좋아, 이제 방향 잡혔어. 팀만 붙이면 돼.
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                      확정한 아이디어를 기준으로 바로 팀 빌딩 화면으로 넘길 수 있어요.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">꿈</div>
                      <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{session.selectedWhy}</p>
                    </div>
                    <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">AI 추천 방향</div>
                      <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{session.selectedHow}</p>
                    </div>
                    <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">확정 아이디어</div>
                      <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                        {session.ideaCandidates.find((candidate) => candidate.id === session.selectedIdeaId)?.title}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                    <div className="text-sm font-semibold text-[var(--foreground)]">다음은 팀 짜기</div>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                      AI가 정리한 방향을 그대로 팀 빌딩 화면에 넘겨서 역할 분담, 산출물 우선순위를 이어서 잡을 수 있어요.
                    </p>
                    <Link href={teamHref} className="primary-button mt-5 w-full">
                      <FaUsers className="h-3.5 w-3.5" aria-hidden />
                      AI 팀 짜기 시작하기
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="max-w-3xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">3/3 최종 선택</div>
                    <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                      이걸로 가자!
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                      복잡한 표는 걷어냈어요. 지금은 가장 유리한 후보만 빠르게 보면 됩니다.
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                    <div className="text-sm font-semibold text-[var(--foreground)]">정렬 기준 바꾸기</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {presetMeta.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handlePresetRecalculate(preset.id)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm font-semibold transition",
                            selectedPreset === preset.id
                              ? "border-[rgba(245,241,232,0.28)] bg-[rgba(245,241,232,0.12)] text-[var(--foreground)]"
                              : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)]",
                          )}
                        >
                          {preset.label}
                          {session.recommendedMatrixPreset === preset.id ? " · 추천" : ""}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {rankingCandidates.map((candidate, index) => (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSelectedIdeaId(candidate.id)}
                        className={cn(
                          "w-full rounded-[24px] border p-5 text-left transition",
                          selectedIdeaId === candidate.id
                            ? "border-[rgba(245,241,232,0.28)] bg-[rgba(245,241,232,0.1)]"
                            : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.05)]",
                        )}
                      >
                        <div className="text-sm font-semibold text-[var(--foreground)]">
                          <RankingLabel index={index} />
                        </div>
                        <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                          {candidate.title} <span className="text-sm text-[var(--muted)]">({candidate.matrixScores.total.toFixed(1)}점)</span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{trimLine(candidate.matrixScores.reason, "심사 포인트와 잘 맞아요.")}</p>
                      </button>
                    ))}
                  </div>

                  {session.matrixSummary ? (
                    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                      <div className="text-sm font-semibold text-[var(--foreground)]">AI 한 줄 요약</div>
                      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{session.matrixSummary}</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-[20px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}
        </div>

        <footer className="border-t border-[var(--border)] px-5 py-4 md:px-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs leading-5 text-[var(--muted)]">
              지금은 <span className="font-semibold text-[var(--foreground)]">{uiSteps.find((step) => step.id === activeStep)?.label}</span> 단계예요.
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {canGoBack ? (
                <button type="button" onClick={handlePrevious} className="secondary-button">
                  <FaChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  이전
                </button>
              ) : null}

              {activeStep === "dream" ? (
                <button type="button" onClick={handleDreamNext} className="primary-button" disabled={isPending}>
                  {isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FaArrowRight className="h-3.5 w-3.5" aria-hidden />}
                  다음으로
                </button>
              ) : null}

              {activeStep === "ideas" ? (
                <button type="button" onClick={handleIdeasNext} className="primary-button" disabled={isPending}>
                  {isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FaArrowRight className="h-3.5 w-3.5" aria-hidden />}
                  순위 보기
                </button>
              ) : null}

              {activeStep === "final" && session.status !== "selected" ? (
                <button type="button" onClick={handleSelectIdea} className="primary-button" disabled={isPending || !selectedIdeaId}>
                  {isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FaCheck className="h-3.5 w-3.5" aria-hidden />}
                  이걸로 확정
                </button>
              ) : null}

              {activeStep === "final" && session.status === "selected" ? (
                <Link href={teamHref} className="primary-button">
                  <FaUsers className="h-3.5 w-3.5" aria-hidden />
                  팀 빌딩으로 이동
                </Link>
              ) : null}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
