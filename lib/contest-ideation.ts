import type {
  Contest,
  ContestDecisionMatrixPreset,
  ContestDecisionMatrixRow,
  ContestDecisionMatrixScore,
  ContestDecisionMatrixWeights,
  ContestIdeationProgress,
  ContestIdeationSession,
  ContestIdeationStage,
  ContestIdeationStatus,
  ContestIdeaCandidate,
} from "@/types/contest";

import { getDaysUntil } from "@/lib/utils";

export const decisionMatrixPresetWeights: Record<ContestDecisionMatrixPreset, ContestDecisionMatrixWeights> = {
  balanced: {
    impact: 35,
    feasibility: 25,
    alignment: 25,
    speed: 15,
  },
  impact: {
    impact: 40,
    feasibility: 20,
    alignment: 30,
    speed: 10,
  },
  deadline: {
    impact: 25,
    feasibility: 30,
    alignment: 20,
    speed: 25,
  },
};

const ideationProgressByStage: Record<ContestIdeationStage, number> = {
  strategy: 0,
  why: 25,
  how: 50,
  what: 75,
  matrix: 90,
  selected: 100,
};

export function getRecommendedMatrixPreset(contest: Contest): ContestDecisionMatrixPreset {
  const daysUntilDeadline = getDaysUntil(contest.deadline);

  if (daysUntilDeadline !== null && daysUntilDeadline <= 7) {
    return "deadline";
  }

  if (
    (contest.prizePoolKrw ?? 0) >= 15_000_000 ||
    ["enterprise", "government", "foundation"].includes(contest.organizerType ?? "")
  ) {
    return "impact";
  }

  if (
    contest.difficulty === "beginner" ||
    contest.badges.includes("student_friendly") ||
    contest.organizerType === "university"
  ) {
    return "balanced";
  }

  return "balanced";
}

export function getDefaultMatrixWeights(preset: ContestDecisionMatrixPreset) {
  return decisionMatrixPresetWeights[preset];
}

export function calculateContestIdeationProgress(
  status: ContestIdeationStatus,
  currentStage: ContestIdeationStage,
  strategyReviewedAt?: string | null,
  teamProgress = 0,
): ContestIdeationProgress {
  return {
    strategy: strategyReviewedAt ? 100 : 0,
    ideation: status === "selected" ? 100 : ideationProgressByStage[currentStage] ?? 0,
    team: Math.max(0, Math.min(100, teamProgress)),
  };
}

export function calculateMatrixTotal(scores: Omit<ContestDecisionMatrixScore, "total" | "reason">, weights: ContestDecisionMatrixWeights) {
  const weighted =
    scores.impact * weights.impact +
    scores.feasibility * weights.feasibility +
    scores.alignment * weights.alignment +
    scores.speed * weights.speed;

  return Math.round((weighted / 100) * 10) / 10;
}

export function enrichMatrixRows(
  candidates: ContestIdeaCandidate[],
  weights: ContestDecisionMatrixWeights,
) {
  const rows = candidates
    .filter((candidate) => candidate.matrixScores)
    .map((candidate) => {
      const matrixScores = candidate.matrixScores as ContestDecisionMatrixScore;
      const total = calculateMatrixTotal(
        {
          impact: matrixScores.impact,
          feasibility: matrixScores.feasibility,
          alignment: matrixScores.alignment,
          speed: matrixScores.speed,
        },
        weights,
      );

      return {
        ...candidate,
        matrixScores: {
          ...matrixScores,
          total,
        },
      } satisfies ContestDecisionMatrixRow;
    })
    .sort((left, right) => right.matrixScores.total - left.matrixScores.total);

  return rows;
}

export function buildMatrixSummary(session: ContestIdeationSession | null) {
  if (!session || session.matrixRows.length === 0) {
    return null;
  }

  const topIdea = session.matrixRows[0];

  return `${topIdea.title}가 ${topIdea.matrixScores.total.toFixed(1)}점으로 가장 앞서 있습니다. ${topIdea.matrixScores.reason}`;
}

export function clampMatrixWeights(
  preset: ContestDecisionMatrixPreset,
  weights: ContestDecisionMatrixWeights,
): ContestDecisionMatrixWeights {
  const defaults = decisionMatrixPresetWeights[preset];

  const clamped: ContestDecisionMatrixWeights = {
    impact: clampWithinRange(weights.impact, defaults.impact),
    feasibility: clampWithinRange(weights.feasibility, defaults.feasibility),
    alignment: clampWithinRange(weights.alignment, defaults.alignment),
    speed: clampWithinRange(weights.speed, defaults.speed),
  };

  const total = clamped.impact + clamped.feasibility + clamped.alignment + clamped.speed;

  if (total === 100) {
    return clamped;
  }

  const diff = 100 - total;
  const keys: Array<keyof ContestDecisionMatrixWeights> = ["impact", "feasibility", "alignment", "speed"];
  const targetKey = keys
    .slice()
    .sort((left, right) => decisionMatrixPresetWeights[preset][right] - decisionMatrixPresetWeights[preset][left])[0];

  clamped[targetKey] = Math.max(0, clamped[targetKey] + diff);

  return clamped;
}

function clampWithinRange(value: number, baseline: number) {
  return Math.max(Math.max(0, baseline - 10), Math.min(baseline + 10, value));
}

