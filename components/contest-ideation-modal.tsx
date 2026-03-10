"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaChevronLeft,
  FaPlus,
  FaSpinner,
  FaTrash,
  FaXmark,
} from "react-icons/fa6";

import { decisionMatrixPresetWeights } from "@/lib/contest-ideation";
import { cn } from "@/lib/utils";
import type {
  ContestDecisionMatrixPreset,
  ContestDecisionMatrixWeights,
  ContestIdeationSession,
  ContestIdeaCandidate,
} from "@/types/contest";

const stageOrder = ["why", "how", "what", "matrix", "selected"] as const;

type StageKey = (typeof stageOrder)[number];

type CustomIdeaDraft = {
  id: string;
  title: string;
  description: string;
  prosText: string;
  consText: string;
  fitReason: string;
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
  activeStage: StageKey;
  selectedWhyId: string;
  whyText: string;
  selectedHowId: string;
  howText: string;
  userIdeaSeed: string;
  votes: Record<string, "liked" | "skipped" | "neutral">;
  customIdeas: CustomIdeaDraft[];
  selectedPreset: ContestDecisionMatrixPreset;
  weights: ContestDecisionMatrixWeights;
  selectedIdeaId: string;
};

function stageLabel(stage: StageKey) {
  if (stage === "why") return "Why";
  if (stage === "how") return "How";
  if (stage === "what") return "What";
  if (stage === "matrix") return "Decision Matrix";
  return "아이디어 확정";
}

function normalizeStage(stage: ContestIdeationSession["currentStage"]): StageKey {
  if (stage === "strategy") {
    return "why";
  }

  if (stage === "selected") {
    return "selected";
  }

  return stage;
}

function splitCommaText(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSavedAt(value?: string | null) {
  if (!value) {
    return "아직 저장되지 않음";
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
    activeStage: normalizeStage(session.currentStage),
    selectedWhyId: session.selectedWhyId ?? session.whyOptions[0]?.id ?? "",
    whyText:
      session.whyEditedText ??
      session.selectedWhy ??
      session.whyOptions.find((option) => option.isSelected)?.body ??
      session.whyOptions[0]?.body ??
      "",
    selectedHowId: session.selectedHowId ?? session.howHypotheses[0]?.id ?? "",
    howText:
      session.howEditedText ??
      session.selectedHow ??
      session.howHypotheses.find((hypothesis) => hypothesis.isSelected)?.body ??
      session.howHypotheses[0]?.body ??
      "",
    userIdeaSeed: session.userIdeaSeed ?? "",
    votes: Object.fromEntries(session.ideaCandidates.map((candidate) => [candidate.id, candidate.voteState])) as Record<
      string,
      "liked" | "skipped" | "neutral"
    >,
    customIdeas: session.ideaCandidates
      .filter((candidate) => candidate.source === "user")
      .map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        description: candidate.description,
        prosText: candidate.pros.join(", "),
        consText: candidate.cons.join(", "),
        fitReason: candidate.fitReason,
      })),
    selectedPreset: session.selectedMatrixPreset ?? session.recommendedMatrixPreset,
    weights: session.matrixWeights,
    selectedIdeaId: session.selectedIdeaId ?? session.matrixRows[0]?.id ?? "",
  };
}

function adjustWeights(
  preset: ContestDecisionMatrixPreset,
  previous: ContestDecisionMatrixWeights,
  key: keyof ContestDecisionMatrixWeights,
  nextValue: number,
) {
  const defaults = decisionMatrixPresetWeights[preset];
  const minimum = Math.max(0, defaults[key] - 10);
  const maximum = defaults[key] + 10;
  const clamped = Math.max(minimum, Math.min(maximum, nextValue));

  const updated = {
    ...previous,
    [key]: clamped,
  };

  let diff = Object.values(updated).reduce((sum, value) => sum + value, 0) - 100;

  if (diff === 0) {
    return updated;
  }

  const otherKeys = (Object.keys(updated) as Array<keyof ContestDecisionMatrixWeights>).filter((item) => item !== key);

  while (diff !== 0) {
    let changed = false;

    for (const otherKey of otherKeys) {
      const min = Math.max(0, defaults[otherKey] - 10);
      const max = defaults[otherKey] + 10;

      if (diff > 0 && updated[otherKey] > min) {
        updated[otherKey] -= 1;
        diff -= 1;
        changed = true;
      }

      if (diff < 0 && updated[otherKey] < max) {
        updated[otherKey] += 1;
        diff += 1;
        changed = true;
      }

      if (diff === 0) {
        break;
      }
    }

    if (!changed) {
      updated[key] -= diff;
      diff = 0;
    }
  }

  return updated;
}

function SessionProgress({ activeStage }: { activeStage: StageKey }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {stageOrder.map((stage, index) => {
        const isDone = stageOrder.indexOf(activeStage) > index;
        const isActive = activeStage === stage;

        return (
          <div
            key={stage}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              isActive
                ? "border-[rgba(245,241,232,0.22)] bg-[rgba(245,241,232,0.14)] text-[var(--foreground)]"
                : isDone
                  ? "border-[rgba(54,179,126,0.24)] bg-[rgba(54,179,126,0.12)] text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)]",
            )}
          >
            {index + 1}. {stageLabel(stage)}
          </div>
        );
      })}
    </div>
  );
}

function MatrixTable({
  candidates,
  selectedIdeaId,
  onSelectIdea,
}: {
  candidates: ContestIdeationSession["matrixRows"];
  selectedIdeaId: string;
  onSelectIdea: (ideaId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[22px] border border-[var(--border)]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[rgba(255,255,255,0.03)] text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3 font-medium">아이디어</th>
            <th className="px-4 py-3 font-medium">Impact</th>
            <th className="px-4 py-3 font-medium">Feasibility</th>
            <th className="px-4 py-3 font-medium">Alignment</th>
            <th className="px-4 py-3 font-medium">Speed</th>
            <th className="px-4 py-3 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr
              key={candidate.id}
              className={cn(
                "border-t border-[var(--border)] cursor-pointer transition hover:bg-[rgba(255,255,255,0.03)]",
                selectedIdeaId === candidate.id && "bg-[rgba(245,241,232,0.08)]",
              )}
              onClick={() => onSelectIdea(candidate.id)}
            >
              <td className="px-4 py-4 align-top">
                <div className="font-semibold text-[var(--foreground)]">{candidate.title}</div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{candidate.matrixScores.reason}</p>
              </td>
              <td className="px-4 py-4 text-[var(--foreground)]">{candidate.matrixScores.impact}</td>
              <td className="px-4 py-4 text-[var(--foreground)]">{candidate.matrixScores.feasibility}</td>
              <td className="px-4 py-4 text-[var(--foreground)]">{candidate.matrixScores.alignment}</td>
              <td className="px-4 py-4 text-[var(--foreground)]">{candidate.matrixScores.speed}</td>
              <td className="px-4 py-4 font-semibold text-[var(--foreground)]">{candidate.matrixScores.total.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const [activeStage, setActiveStage] = useState<StageKey>(initialSeed.activeStage);
  const [selectedWhyId, setSelectedWhyId] = useState(initialSeed.selectedWhyId);
  const [whyText, setWhyText] = useState(initialSeed.whyText);
  const [selectedHowId, setSelectedHowId] = useState(initialSeed.selectedHowId);
  const [howText, setHowText] = useState(initialSeed.howText);
  const [userIdeaSeed, setUserIdeaSeed] = useState(initialSeed.userIdeaSeed);
  const [votes, setVotes] = useState<Record<string, "liked" | "skipped" | "neutral">>(initialSeed.votes);
  const [customIdeas, setCustomIdeas] = useState<CustomIdeaDraft[]>(initialSeed.customIdeas);
  const [selectedPreset, setSelectedPreset] = useState<ContestDecisionMatrixPreset>(initialSeed.selectedPreset);
  const [weights, setWeights] = useState<ContestDecisionMatrixWeights>(initialSeed.weights);
  const [selectedIdeaId, setSelectedIdeaId] = useState(initialSeed.selectedIdeaId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentIndex = stageOrder.indexOf(activeStage);
  const canGoBack = currentIndex > 0;
  const canGoForward = activeStage === "why" || activeStage === "how" || activeStage === "what";
  const teamHref = `/team/${contestId}?session=${session.id}`;
  const aiIdeaCandidates = useMemo(() => session.ideaCandidates.filter((candidate) => candidate.source === "ai"), [session.ideaCandidates]);

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

  function updateCustomIdea(id: string, field: keyof CustomIdeaDraft, value: string) {
    setCustomIdeas((current) => current.map((idea) => (idea.id === id ? { ...idea, [field]: value } : idea)));
  }

  function addCustomIdea() {
    setCustomIdeas((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        title: "",
        description: "",
        prosText: "",
        consText: "",
        fitReason: "",
      },
    ]);
  }

  function removeCustomIdea(id: string) {
    setCustomIdeas((current) => current.filter((idea) => idea.id !== id));
  }

  function handleVote(candidate: ContestIdeaCandidate, voteState: "liked" | "skipped" | "neutral") {
    setVotes((current) => ({
      ...current,
      [candidate.id]: voteState,
    }));
  }

  function handlePresetChange(preset: ContestDecisionMatrixPreset) {
    setSelectedPreset(preset);
    setWeights(decisionMatrixPresetWeights[preset]);
  }

  function handleWeightChange(key: keyof ContestDecisionMatrixWeights, value: number) {
    setWeights((current) => adjustWeights(selectedPreset, current, key, value));
  }

  function handlePrevious() {
    if (!canGoBack) {
      return;
    }

    setActiveStage(stageOrder[currentIndex - 1]);
    setError(null);
  }

  function handleNext() {
    setError(null);

    startTransition(async () => {
      try {
        if (activeStage === "why") {
          if (!selectedWhyId) {
            setError("먼저 WHY를 하나 선택해 주세요.");
            return;
          }

          const nextSession = await requestSession("why", {
            selectedCandidateId: selectedWhyId,
            editedText: whyText,
          });
          setActiveStage(normalizeStage(nextSession.currentStage));
          return;
        }

        if (activeStage === "how") {
          if (!selectedHowId) {
            setError("먼저 HOW 가설을 하나 선택해 주세요.");
            return;
          }

          const nextSession = await requestSession("how", {
            selectedCandidateId: selectedHowId,
            editedText: howText,
          });
          setActiveStage(normalizeStage(nextSession.currentStage));
          return;
        }

        if (activeStage === "what") {
          await requestSession("what", {
            votes: Object.entries(votes).map(([candidateId, voteState]) => ({
              candidateId,
              voteState,
            })),
            customIdeas: customIdeas.map((idea) => ({
              title: idea.title,
              description: idea.description,
              pros: splitCommaText(idea.prosText),
              cons: splitCommaText(idea.consText),
              fitReason: idea.fitReason,
            })),
            userIdeaSeed,
          });
          const nextSession = await requestSession("matrix", {
            preset: selectedPreset,
            weights,
          });
          setSelectedIdeaId(nextSession.selectedIdeaId ?? nextSession.matrixRows[0]?.id ?? "");
          setActiveStage("matrix");
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "브레인스토밍 저장에 실패했습니다.");
      }
    });
  }

  function handleRecalculateMatrix() {
    setError(null);

    startTransition(async () => {
      try {
        const nextSession = await requestSession("matrix", {
          preset: selectedPreset,
          weights,
        });
        setSelectedIdeaId(nextSession.selectedIdeaId ?? nextSession.matrixRows[0]?.id ?? "");
        setActiveStage("matrix");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Matrix 계산에 실패했습니다.");
      }
    });
  }

  function handleSelectIdea() {
    if (!selectedIdeaId) {
      setError("먼저 확정할 아이디어를 선택해 주세요.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const nextSession = await requestSession("select", {
          ideaId: selectedIdeaId,
        });
        setActiveStage(normalizeStage(nextSession.currentStage));
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
      <div className="relative flex h-[min(90vh,920px)] w-[min(1180px,calc(100vw-24px))] flex-col overflow-hidden rounded-[32px] border border-[var(--border)] bg-[#090b0f] shadow-[0_24px_120px_rgba(0,0,0,0.45)]">
        <header className="border-b border-[var(--border)] px-5 py-4 md:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">브레인스토밍</div>
              <h2 id="ideation-modal-title" className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {contestTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Why → How → What → Matrix 순서로 우승 가능성이 높은 아이디어를 좁혀 갑니다.
              </p>
            </div>
            <button type="button" onClick={onClose} className="hero-action-button shrink-0" aria-label="닫기">
              <FaXmark className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <SessionProgress activeStage={activeStage} />
            <div className="text-xs leading-5 text-[var(--muted)]">임시 저장: {formatSavedAt(session.updatedAt)}</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
          {activeStage === "why" ? (
            <div className="space-y-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Step 1</div>
                <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">이 공모전의 Why를 먼저 정리합니다.</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                  공모전 주제와 전략 요약을 바탕으로, 심사위원이 납득할 수 있는 목적 문장을 먼저 고릅니다.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {session.whyOptions.map((option) => (
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
                        ? "border-[rgba(245,241,232,0.24)] bg-[rgba(245,241,232,0.1)]"
                        : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.05)]",
                    )}
                  >
                    <div className="text-sm font-semibold text-[var(--foreground)]">{option.title}</div>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{option.body}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <label htmlFor="ideation-why-text" className="text-sm font-semibold text-[var(--foreground)]">
                  선택한 Why 문장 다듬기
                </label>
                <textarea
                  id="ideation-why-text"
                  value={whyText}
                  onChange={(event) => setWhyText(event.target.value)}
                  rows={4}
                  className="mt-3 min-h-[120px] w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--foreground)] outline-none transition focus:border-[rgba(245,241,232,0.24)]"
                />
              </div>
            </div>
          ) : null}

          {activeStage === "how" ? (
            <div className="space-y-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Step 2</div>
                <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">How 가설로 심사 포인트를 역산합니다.</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                  WHY가 맞다면, 심사위원이 어떤 결과를 기대할지부터 가설을 세우고 그 결과가 측정 가능해야 합니다.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {session.howHypotheses.map((hypothesis) => (
                  <button
                    key={hypothesis.id}
                    type="button"
                    onClick={() => {
                      setSelectedHowId(hypothesis.id);
                      setHowText(hypothesis.body);
                    }}
                    className={cn(
                      "rounded-[24px] border p-5 text-left transition",
                      selectedHowId === hypothesis.id
                        ? "border-[rgba(245,241,232,0.24)] bg-[rgba(245,241,232,0.1)]"
                        : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.05)]",
                    )}
                  >
                    <div className="text-sm font-semibold text-[var(--foreground)]">{hypothesis.title}</div>
                    <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{hypothesis.body}</p>
                    <div className="mt-4 space-y-1 text-xs leading-5 text-[var(--muted)]">
                      <div>Impact target: {hypothesis.impactTarget}</div>
                      <div>Judge appeal: {hypothesis.judgeAppeal}</div>
                      <div>Measurable outcome: {hypothesis.measurableOutcome}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <label htmlFor="ideation-how-text" className="text-sm font-semibold text-[var(--foreground)]">
                  선택한 How 가설 다듬기
                </label>
                <textarea
                  id="ideation-how-text"
                  value={howText}
                  onChange={(event) => setHowText(event.target.value)}
                  rows={4}
                  className="mt-3 min-h-[120px] w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--foreground)] outline-none transition focus:border-[rgba(245,241,232,0.24)]"
                />
              </div>
            </div>
          ) : null}

          {activeStage === "what" ? (
            <div className="space-y-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Step 3</div>
                <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">실행 가능한 아이디어 후보를 넓게 뽑습니다.</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                  마음에 드는 아이디어는 좋아요로 남기고, 빼고 싶은 후보는 제외해 둔 뒤 Matrix 단계에서 객관적으로 점수를 비교합니다.
                </p>
              </div>

              <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <label htmlFor="ideation-user-seed" className="text-sm font-semibold text-[var(--foreground)]">
                  이미 떠오른 아이디어 한 줄
                </label>
                <textarea
                  id="ideation-user-seed"
                  value={userIdeaSeed}
                  onChange={(event) => setUserIdeaSeed(event.target.value)}
                  rows={3}
                  placeholder="예: 골프 GTI 퍼포먼스를 게임 예고편처럼 보이게 만드는 AI 광고"
                  className="mt-3 min-h-[96px] w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-7 text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[rgba(245,241,232,0.24)]"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {aiIdeaCandidates.map((idea) => (
                  <div key={idea.id} className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--foreground)]">{idea.title}</div>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{idea.description}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-xs leading-5 text-[var(--muted)] md:grid-cols-2">
                      <div>
                        <div className="font-semibold text-[var(--foreground)]">장점</div>
                        <div className="mt-2">{idea.pros.join(" · ")}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--foreground)]">리스크</div>
                        <div className="mt-2">{idea.cons.join(" · ")}</div>
                      </div>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-[var(--muted)]">공고 적합도: {idea.fitReason}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {[
                        { id: "liked", label: "좋아요" },
                        { id: "neutral", label: "보류" },
                        { id: "skipped", label: "제외" },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleVote(idea, option.id as "liked" | "skipped" | "neutral")}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                            votes[idea.id] === option.id
                              ? "border-[rgba(245,241,232,0.24)] bg-[rgba(245,241,232,0.12)] text-[var(--foreground)]"
                              : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)]",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--foreground)]">직접 추가한 아이디어</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      AI가 제안한 후보 외에 넣고 싶은 아이디어가 있으면 직접 적어두고 Matrix에 같이 넣을 수 있습니다.
                    </p>
                  </div>
                  <button type="button" onClick={addCustomIdea} className="secondary-button">
                    <FaPlus className="h-3.5 w-3.5" aria-hidden />
                    직접 추가
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {customIdeas.map((idea) => (
                    <div key={idea.id} className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                      <div className="flex justify-end">
                        <button type="button" onClick={() => removeCustomIdea(idea.id)} className="hero-action-button" aria-label="직접 추가한 아이디어 삭제">
                          <FaTrash className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={idea.title}
                          onChange={(event) => updateCustomIdea(idea.id, "title", event.target.value)}
                          placeholder="아이디어 제목"
                          className="rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                        />
                        <input
                          value={idea.fitReason}
                          onChange={(event) => updateCustomIdea(idea.id, "fitReason", event.target.value)}
                          placeholder="이 공고와 맞는 이유"
                          className="rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                        />
                      </div>
                      <textarea
                        value={idea.description}
                        onChange={(event) => updateCustomIdea(idea.id, "description", event.target.value)}
                        rows={3}
                        placeholder="아이디어 설명"
                        className="mt-3 w-full rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] outline-none"
                      />
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <input
                          value={idea.prosText}
                          onChange={(event) => updateCustomIdea(idea.id, "prosText", event.target.value)}
                          placeholder="장점 2-3개"
                          className="rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                        />
                        <input
                          value={idea.consText}
                          onChange={(event) => updateCustomIdea(idea.id, "consText", event.target.value)}
                          placeholder="리스크 1-2개"
                          className="rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeStage === "matrix" ? (
            <div className="space-y-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Step 4</div>
                <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">Decision Matrix로 객관적으로 고릅니다.</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                  공모전 메타데이터를 기준으로 추천 프리셋을 먼저 잡고, 필요하면 범위 안에서만 미세조정해 최종 순위를 봅니다.
                </p>
              </div>

              <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                    <div className="text-sm font-semibold text-[var(--foreground)]">프리셋 선택</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {([
                        { id: "balanced", label: "균형형" },
                        { id: "impact", label: "임팩트형" },
                        { id: "deadline", label: "마감압박형" },
                      ] as const).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handlePresetChange(preset.id)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm font-semibold transition",
                            selectedPreset === preset.id
                              ? "border-[rgba(245,241,232,0.24)] bg-[rgba(245,241,232,0.12)] text-[var(--foreground)]"
                              : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)]",
                          )}
                        >
                          {preset.label}
                          {session.recommendedMatrixPreset === preset.id ? " · 추천" : ""}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                    <div className="text-sm font-semibold text-[var(--foreground)]">가중치 미세조정</div>
                    <div className="mt-4 space-y-4">
                      {(Object.keys(weights) as Array<keyof ContestDecisionMatrixWeights>).map((key) => (
                        <div key={key}>
                          <div className="mb-2 flex items-center justify-between text-sm text-[var(--foreground)]">
                            <span>{key[0].toUpperCase() + key.slice(1)}</span>
                            <span>{weights[key]}%</span>
                          </div>
                          <input
                            type="range"
                            min={Math.max(0, decisionMatrixPresetWeights[selectedPreset][key] - 10)}
                            max={decisionMatrixPresetWeights[selectedPreset][key] + 10}
                            step={1}
                            value={weights[key]}
                            onChange={(event) => handleWeightChange(key, Number(event.target.value))}
                            className="w-full accent-[var(--foreground)]"
                          />
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={handleRecalculateMatrix} className="secondary-button mt-5">
                      {isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FaArrowRight className="h-3.5 w-3.5" aria-hidden />}
                      가중치로 다시 계산
                    </button>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                    <div className="text-sm font-semibold text-[var(--foreground)]">Top 3 추천</div>
                    <div className="mt-4 space-y-3">
                      {session.topRecommendations.map((candidate, index) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => setSelectedIdeaId(candidate.id)}
                          className={cn(
                            "w-full rounded-[20px] border p-4 text-left transition",
                            selectedIdeaId === candidate.id
                              ? "border-[rgba(245,241,232,0.24)] bg-[rgba(245,241,232,0.12)]"
                              : "border-[var(--border)] bg-[var(--surface-muted)]",
                          )}
                        >
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Top {index + 1}</div>
                          <div className="mt-2 text-base font-semibold text-[var(--foreground)]">
                            {candidate.title} · {candidate.matrixScores.total.toFixed(1)}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{candidate.matrixScores.reason}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <MatrixTable candidates={session.matrixRows} selectedIdeaId={selectedIdeaId} onSelectIdea={setSelectedIdeaId} />
                </div>
              </div>
            </div>
          ) : null}

          {activeStage === "selected" ? (
            <div className="space-y-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">완료</div>
                <h3 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">아이디어를 확정했습니다.</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                  이제 이 Why / How / 아이디어 조합을 기준으로 팀 역할과 산출물을 나누면 됩니다.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Why</div>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{session.selectedWhy}</p>
                </div>
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">How</div>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{session.selectedHow}</p>
                </div>
                <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">선택한 아이디어</div>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                    {session.ideaCandidates.find((candidate) => candidate.id === session.selectedIdeaId)?.title}
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <div className="text-sm font-semibold text-[var(--foreground)]">팀 빌딩 handoff</div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  선택한 WHY/HOW/아이디어를 기반으로 팀 빌딩 진입 페이지를 열고, 역할 분담과 산출물 기준을 이어서 정리할 수 있습니다.
                </p>
                <Link href={teamHref} className="primary-button mt-5 w-full">
                  AI 팀 빌딩 시작하기
                </Link>
              </div>
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
              현재 단계: <span className="font-semibold text-[var(--foreground)]">{stageLabel(activeStage)}</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {canGoBack ? (
                <button type="button" onClick={handlePrevious} className="secondary-button">
                  <FaChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  이전
                </button>
              ) : null}

              {canGoForward ? (
                <button type="button" onClick={handleNext} className="primary-button" disabled={isPending}>
                  {isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FaArrowRight className="h-3.5 w-3.5" aria-hidden />}
                  다음
                </button>
              ) : null}

              {activeStage === "matrix" ? (
                <button type="button" onClick={handleSelectIdea} className="primary-button" disabled={isPending || !selectedIdeaId}>
                  {isPending ? <FaSpinner className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FaCheck className="h-3.5 w-3.5" aria-hidden />}
                  이 아이디어로 확정
                </button>
              ) : null}

              {activeStage === "selected" ? (
                <Link href={teamHref} className="primary-button">
                  <FaArrowLeft className="h-3.5 w-3.5 rotate-180" aria-hidden />
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
