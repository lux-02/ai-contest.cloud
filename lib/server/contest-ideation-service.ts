import "server-only";

import type {
  Contest,
  ContestDecisionMatrixScore,
  ContestDecisionMatrixWeights,
  ContestHowHypothesis,
  ContestIdeaCandidate,
  ContestWhyOption,
} from "@/types/contest";
import { callRemoteAiService, canUseRemoteAiService } from "./remote-ai-runtime";

const DEFAULT_TIMEOUT_MS = 45_000;

type IdeationStep = "why" | "how" | "what" | "matrix";

type RemoteIdeationPayload = {
  step: IdeationStep;
  whyOptions?: Array<{
    title: string;
    body: string;
  }>;
  howHypotheses?: Array<{
    title: string;
    body: string;
    impactTarget: string;
    judgeAppeal: string;
    measurableOutcome: string;
  }>;
  ideaCandidates?: Array<{
    title: string;
    description: string;
    pros: string[];
    cons: string[];
    fitReason: string;
  }>;
  matrixRows?: Array<{
    candidateId: string;
    impact: number;
    feasibility: number;
    alignment: number;
    speed: number;
    reason: string;
  }>;
  matrixSummary?: string | null;
  promptVersion?: string | null;
  modelName?: string | null;
  status: "pending" | "completed" | "failed";
};

type RemoteSessionContext = {
  selectedWhy?: string | null;
  selectedHow?: string | null;
  whyEditedText?: string | null;
  howEditedText?: string | null;
  userIdeaSeed?: string | null;
  supportingSources?: string[];
  ideaCandidates?: Array<{
    id: string;
    title: string;
    description: string;
    pros: string[];
    cons: string[];
    fitReason: string;
    source: "ai" | "user";
    voteState: "liked" | "skipped" | "neutral";
  }>;
};

export function canUseRemoteContestIdeationService() {
  return canUseRemoteAiService();
}

function mapWhyOptions(payload: RemoteIdeationPayload): ContestWhyOption[] {
  return (payload.whyOptions ?? []).map((option, index) => ({
    id: `why-${index + 1}`,
    title: option.title,
    body: option.body,
    source: "ai",
    isSelected: false,
    displayOrder: index,
  }));
}

function mapHowHypotheses(payload: RemoteIdeationPayload): ContestHowHypothesis[] {
  return (payload.howHypotheses ?? []).map((hypothesis, index) => ({
    id: `how-${index + 1}`,
    title: hypothesis.title,
    body: hypothesis.body,
    impactTarget: hypothesis.impactTarget,
    judgeAppeal: hypothesis.judgeAppeal,
    measurableOutcome: hypothesis.measurableOutcome,
    source: "ai",
    isSelected: false,
    displayOrder: index,
  }));
}

function mapIdeaCandidates(payload: RemoteIdeationPayload): ContestIdeaCandidate[] {
  return (payload.ideaCandidates ?? []).map((idea, index) => ({
    id: `what-${index + 1}`,
    title: idea.title,
    description: idea.description,
    pros: idea.pros,
    cons: idea.cons,
    fitReason: idea.fitReason,
    source: "ai",
    voteState: "neutral",
    isSelected: false,
    displayOrder: index,
  }));
}

export async function generateContestIdeationWithRemoteService(input: {
  contest: Contest;
  strategySummary: string;
  step: IdeationStep;
  sessionContext: RemoteSessionContext;
  userInput?: string | null;
  matrixWeights?: ContestDecisionMatrixWeights | null;
}) {
  const response = await callRemoteAiService<typeof input, RemoteIdeationPayload>({
    service: `contest-ideation:${input.step}`,
    path: "/generate-contest-ideation",
    payload: input,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    metadata: {
      contestSlug: input.contest.slug,
      step: input.step,
    },
  });
  const payload = response.payload;

  return {
    step: payload.step,
    whyOptions: mapWhyOptions(payload),
    howHypotheses: mapHowHypotheses(payload),
    ideaCandidates: mapIdeaCandidates(payload),
    matrixRows:
      payload.matrixRows?.map((row) => ({
        candidateId: row.candidateId,
        scores: {
          impact: row.impact,
          feasibility: row.feasibility,
          alignment: row.alignment,
          speed: row.speed,
          total: 0,
          reason: row.reason,
        } satisfies ContestDecisionMatrixScore,
      })) ?? [],
    matrixSummary: payload.matrixSummary ?? null,
    promptVersion: payload.promptVersion ?? null,
    modelName: payload.modelName ?? null,
    status: payload.status,
  };
}
