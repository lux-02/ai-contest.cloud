import "server-only";

import { getContests } from "@/lib/queries";
import { getDaysUntil } from "@/lib/utils";
import { getContestIdeationSession } from "@/lib/server/contest-ideation";
import { getTeamSessionSnapshot } from "@/lib/server/contest-team";
import type {
  Contest,
  ContestCategory,
  ContestDifficulty,
  ContestOrganizerType,
  ContestRecommendation,
  ContestRecommendationSnapshot,
  ContestStrengthConfidence,
  ContestStrengthProfile,
  ContestTeamPreference,
  ContestTrackingState,
  TeamBootstrapResponse,
} from "@/types/contest";
import { difficultyOptions, getCategoryMeta, getOrganizerTypeMeta } from "@/types/contest";

type TrackedContestEntry = {
  contest: Contest;
  tracking: ContestTrackingState;
};

type RecommendationSignal = {
  contest: Contest;
  tracking: ContestTrackingState;
  ideationSessionId?: string | null;
  ideationProgressScore: number;
  teamReadinessScore: number;
  doneTaskCount: number;
  readyArtifactCount: number;
  signalWeight: number;
};

const MAX_SOURCE_CONTESTS = 8;
const statusWeights = {
  saved: 1,
  planning: 1.8,
  applied: 2.5,
} as const;

const difficultyOrder: ContestDifficulty[] = ["beginner", "intermediate", "advanced"];

function addWeight<T extends string>(bucket: Map<T, number>, key: T | null | undefined, weight: number) {
  if (!key || weight <= 0) {
    return;
  }

  bucket.set(key, (bucket.get(key) ?? 0) + weight);
}

function getTrackingWeight(tracking: ContestTrackingState) {
  const statusWeight = tracking.status ? statusWeights[tracking.status] : 0.8;
  const reminderWeight = tracking.reminderEnabled ? 0.3 : 0;
  return statusWeight + reminderWeight;
}

function getIdeationProgressScore(session: Awaited<ReturnType<typeof getContestIdeationSession>>) {
  if (!session) {
    return 0;
  }

  const progressAverage = (session.progress.strategy + session.progress.ideation + session.progress.team) / 3;
  const selectedIdeaBoost = session.selectedIdeaId ? 14 : 0;
  const alignmentBoost = session.selectedWhy && session.selectedHow ? 10 : 0;

  return Math.min(100, Math.round(progressAverage * 0.7 + selectedIdeaBoost + alignmentBoost));
}

function getTeamReadinessScore(snapshot: TeamBootstrapResponse | null) {
  if (!snapshot) {
    return 0;
  }

  const readiness = snapshot.teamSession.readinessScore;
  const doneTasks = snapshot.teamSession.tasks.filter((task) => task.status === "done").length;
  const readyArtifacts = snapshot.teamSession.artifacts.filter((artifact) => artifact.status === "ready").length;

  return Math.min(100, Math.round(readiness * 0.7 + doneTasks * 6 + readyArtifacts * 8));
}

function getContestExecutionScore(signal: RecommendationSignal) {
  const baseline = signal.tracking.status === "applied" ? 74 : signal.tracking.status === "planning" ? 58 : 40;
  return Math.min(
    100,
    Math.round(Math.max(baseline, signal.ideationProgressScore * 0.55 + signal.teamReadinessScore * 0.45)),
  );
}

function rankKeys<T extends string>(bucket: Map<T, number>) {
  return [...bucket.entries()].sort((left, right) => right[1] - left[1]).map(([key]) => key);
}

function buildConfidence(sourceContestCount: number, deepSignalCount: number): ContestStrengthConfidence {
  if (deepSignalCount >= 3 || sourceContestCount >= 5) {
    return "strong";
  }

  if (deepSignalCount >= 1 || sourceContestCount >= 2) {
    return "growing";
  }

  return "starter";
}

function buildProfileSummary(input: {
  sourceContestCount: number;
  topCategories: ContestCategory[];
  preferredDifficulty?: ContestDifficulty | null;
  preferredOrganizerType?: ContestOrganizerType | null;
  teamPreference: ContestTeamPreference;
  executionReadiness: number;
}) {
  const categoryLabels = input.topCategories.slice(0, 2).map((category) => getCategoryMeta(category).label);
  const difficultyLabel =
    difficultyOptions.find((option) => option.id === input.preferredDifficulty)?.label ?? "중급";
  const organizerLabel = input.preferredOrganizerType
    ? getOrganizerTypeMeta(input.preferredOrganizerType).label
    : "다양한 주최사";
  const teamLabel =
    input.teamPreference === "team"
      ? "팀 기반 대회"
      : input.teamPreference === "individual"
        ? "개인전"
        : "개인전과 팀전 모두";

  if (categoryLabels.length === 0) {
    return `최근 활동 ${input.sourceContestCount}건 기준으로 ${teamLabel} 쪽 성향이 보입니다. 현재 실행 준비도 ${input.executionReadiness}점 수준이라 ${difficultyLabel} 난이도 대회를 우선 추천합니다.`;
  }

  return `최근 활동 ${input.sourceContestCount}건 기준으로 ${categoryLabels.join(", ")} 주제에서 준비 깊이가 높고 ${teamLabel} 쪽 성향이 보입니다. 현재 실행 준비도 ${input.executionReadiness}점 수준이라 ${difficultyLabel} 난이도와 ${organizerLabel} 계열 대회를 우선 추천합니다.`;
}

function buildStrengthProfile(signals: RecommendationSignal[]): ContestStrengthProfile | null {
  if (signals.length === 0) {
    return null;
  }

  const categoryWeights = new Map<ContestCategory, number>();
  const difficultyWeights = new Map<ContestDifficulty, number>();
  const organizerWeights = new Map<ContestOrganizerType, number>();

  let teamWeight = 0;
  let soloWeight = 0;
  let executionWeightedSum = 0;
  let totalWeight = 0;
  let deepSignalCount = 0;

  for (const signal of signals) {
    const executionScore = getContestExecutionScore(signal);
    const effectiveWeight = signal.signalWeight + executionScore / 100;
    const categoryWeightUnit = effectiveWeight / Math.max(signal.contest.aiCategories.length, 1);

    signal.contest.aiCategories.forEach((category) => addWeight(categoryWeights, category, categoryWeightUnit));
    addWeight(difficultyWeights, signal.contest.difficulty, effectiveWeight);
    addWeight(organizerWeights, signal.contest.organizerType, effectiveWeight * 0.75);

    if (signal.contest.teamAllowed) {
      teamWeight += effectiveWeight;
    } else {
      soloWeight += effectiveWeight;
    }

    executionWeightedSum += executionScore * effectiveWeight;
    totalWeight += effectiveWeight;

    if (signal.ideationProgressScore > 0 || signal.teamReadinessScore > 0) {
      deepSignalCount += 1;
    }
  }

  const topCategories = rankKeys(categoryWeights).slice(0, 3);
  const preferredDifficulty = rankKeys(difficultyWeights)[0] ?? null;
  const preferredOrganizerType = rankKeys(organizerWeights)[0] ?? null;
  const executionReadiness = totalWeight > 0 ? Math.round(executionWeightedSum / totalWeight) : 45;
  const teamPreference =
    teamWeight > soloWeight * 1.2
      ? "team"
      : soloWeight > teamWeight * 1.2
        ? "individual"
        : "mixed";

  return {
    sourceContestCount: signals.length,
    deepSignalCount,
    confidence: buildConfidence(signals.length, deepSignalCount),
    topCategories,
    preferredDifficulty,
    preferredOrganizerType,
    teamPreference,
    executionReadiness,
    summary: buildProfileSummary({
      sourceContestCount: signals.length,
      topCategories,
      preferredDifficulty,
      preferredOrganizerType,
      teamPreference,
      executionReadiness,
    }),
  };
}

function getDifficultyDistance(fromDifficulty: ContestDifficulty, toDifficulty: ContestDifficulty) {
  return Math.abs(difficultyOrder.indexOf(fromDifficulty) - difficultyOrder.indexOf(toDifficulty));
}

function resolveFitLabel(score: number) {
  if (score >= 34) {
    return "매우 잘 맞음";
  }

  if (score >= 24) {
    return "잘 맞음";
  }

  return "탐색해볼 만함";
}

function scoreContestAgainstProfile(contest: Contest, profile: ContestStrengthProfile): ContestRecommendation | null {
  const daysUntil = getDaysUntil(contest.deadline);

  if (daysUntil !== null && daysUntil < 0) {
    return null;
  }

  let score = 0;
  const reasons: string[] = [];
  const matchedCategories = contest.aiCategories.filter((category) => profile.topCategories.includes(category));

  if (matchedCategories.length > 0) {
    const categoryScore = matchedCategories.reduce(
      (sum, category) => sum + Math.max(4, 16 - profile.topCategories.indexOf(category) * 4),
      0,
    );
    score += categoryScore;
    reasons.push(`${matchedCategories.slice(0, 2).map((category) => getCategoryMeta(category).label).join(", ")} 주제 적합`);
  }

  if (profile.preferredDifficulty) {
    const distance = getDifficultyDistance(profile.preferredDifficulty, contest.difficulty);

    if (distance === 0) {
      score += 10;
      reasons.push("평소 준비 난이도와 맞음");
    } else if (distance === 1 && profile.executionReadiness >= 72) {
      score += 5;
    } else if (contest.difficulty === "advanced" && profile.executionReadiness < 58) {
      score -= 8;
    }
  }

  if (profile.preferredOrganizerType && contest.organizerType === profile.preferredOrganizerType) {
    score += 6;
    reasons.push(`${getOrganizerTypeMeta(profile.preferredOrganizerType).label} 계열 공고와 맞음`);
  }

  if (profile.teamPreference === "team" && contest.teamAllowed) {
    score += 6;
    reasons.push("팀 기반 준비 흐름과 맞음");
  } else if (profile.teamPreference === "individual" && !contest.teamAllowed) {
    score += 6;
    reasons.push("개인전 선호 흐름과 맞음");
  }

  if (daysUntil !== null) {
    if (daysUntil >= 7 && daysUntil <= 35) {
      score += 6;
      reasons.push("지금 준비하기 좋은 마감");
    } else if (daysUntil >= 3 && daysUntil < 7) {
      score += profile.executionReadiness >= 70 ? 3 : -2;
    } else if (daysUntil < 3) {
      score += profile.executionReadiness >= 82 ? 1 : -8;
    }
  }

  if (contest.provenance?.freshness.status === "fresh") {
    score += 2;
  }

  if (contest.provenance?.completeness.status === "complete") {
    score += 2;
  }

  if ((contest.judgingCriteria?.length ?? 0) > 0) {
    score += 2;
  }

  if (contest.analysis.analysisStatus === "completed") {
    score += 1;
  }

  if (contest.teamAllowed && contest.maxTeamSize >= 4 && profile.teamPreference === "team") {
    score += 2;
  }

  if (score <= 0) {
    return null;
  }

  return {
    contest,
    score,
    fitLabel: resolveFitLabel(score),
    reasons: reasons.slice(0, 3),
    matchedCategories,
  } satisfies ContestRecommendation;
}

async function buildSignal(entry: TrackedContestEntry, userId: string): Promise<RecommendationSignal> {
  let ideationProgressScore = 0;
  let teamReadinessScore = 0;
  let doneTaskCount = 0;
  let readyArtifactCount = 0;
  let ideationSessionId: string | null = null;

  const needsDeepSignal = entry.tracking.status === "planning" || entry.tracking.status === "applied";

  if (needsDeepSignal) {
    try {
      const ideationSession = await getContestIdeationSession(entry.contest, userId);
      ideationProgressScore = getIdeationProgressScore(ideationSession);
      ideationSessionId = ideationSession?.id ?? null;

      if (ideationSession?.id) {
        const teamSnapshot = await getTeamSessionSnapshot(entry.contest.id, ideationSession.id, userId);
        teamReadinessScore = getTeamReadinessScore(teamSnapshot);
        doneTaskCount = teamSnapshot?.teamSession.tasks.filter((task) => task.status === "done").length ?? 0;
        readyArtifactCount =
          teamSnapshot?.teamSession.artifacts.filter((artifact) => artifact.status === "ready").length ?? 0;
      }
    } catch (error) {
      console.warn("[recommendations] Skipping deep signal lookup:", error instanceof Error ? error.message : error);
    }
  }

  return {
    contest: entry.contest,
    tracking: entry.tracking,
    ideationSessionId,
    ideationProgressScore,
    teamReadinessScore,
    doneTaskCount,
    readyArtifactCount,
    signalWeight:
      getTrackingWeight(entry.tracking) +
      ideationProgressScore / 100 +
      teamReadinessScore / 120 +
      doneTaskCount * 0.08 +
      readyArtifactCount * 0.12,
  };
}

export async function getStrengthBasedContestRecommendations(
  entries: TrackedContestEntry[],
  userId: string,
): Promise<ContestRecommendationSnapshot> {
  if (entries.length === 0) {
    return {
      profile: null,
      recommendations: [],
    };
  }

  const sourceEntries = entries.slice(0, MAX_SOURCE_CONTESTS);
  const [signals, contests] = await Promise.all([
    Promise.all(sourceEntries.map((entry) => buildSignal(entry, userId))),
    getContests(),
  ]);

  const profile = buildStrengthProfile(signals);

  if (!profile) {
    return {
      profile: null,
      recommendations: [],
    };
  }

  const trackedContestIds = new Set(entries.map((entry) => entry.contest.id));
  const recommendations = contests
    .filter((contest) => !trackedContestIds.has(contest.id))
    .map((contest) => scoreContestAgainstProfile(contest, profile))
    .flatMap((recommendation) => (recommendation ? [recommendation] : []))
    .sort((left, right) => right.score - left.score || (right.contest.applyCount ?? 0) - (left.contest.applyCount ?? 0))
    .slice(0, 3);

  return {
    profile,
    recommendations,
  };
}
