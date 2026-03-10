import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import type {
  Contest,
  ContestDecisionMatrixScore,
  ContestDecisionMatrixWeights,
  ContestHowHypothesis,
  ContestIdeaCandidate,
  ContestWhyOption,
} from "@/types/contest";

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

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const headerSegment = base64UrlEncode(JSON.stringify(header));
  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");

  return `${signingInput}.${signature}`;
}

function getRemoteConfig() {
  const baseUrl = process.env.NULL_TO_FULL_API_BASE_URL?.replace(/\/$/, "") ?? "";
  const jwtSecret = process.env.NULL_TO_FULL_API_JWT_SECRET ?? "";

  if (!baseUrl || !jwtSecret) {
    return null;
  }

  return {
    baseUrl,
    jwtSecret,
    issuer: process.env.NULL_TO_FULL_API_JWT_ISSUER ?? "ai-contest.cloud",
    audience: process.env.NULL_TO_FULL_API_JWT_AUDIENCE ?? "null-to-full",
    scope: process.env.NULL_TO_FULL_API_SCOPE ?? "contest_strategy.generate",
    timeoutMs: Number(process.env.NULL_TO_FULL_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  };
}

export function canUseRemoteContestIdeationService() {
  return getRemoteConfig() !== null;
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
  const config = getRemoteConfig();

  if (!config) {
    throw new Error("Remote contest ideation service is not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signJwt(
    {
      iss: config.issuer,
      aud: config.audience,
      iat: now,
      nbf: now - 5,
      exp: now + 60,
      jti: randomUUID(),
      scope: config.scope,
    },
    config.jwtSecret,
  );

  const response = await fetch(`${config.baseUrl}/generate-contest-ideation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Remote contest ideation service failed.");
  }

  const payload = (await response.json()) as RemoteIdeationPayload;

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
