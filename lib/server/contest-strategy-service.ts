import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import type { Contest, ContestStrategyLabResult } from "@/types/contest";

import type { CollectedStrategySource } from "./contest-source-collector";

type RemoteContestStrategyPayload = ContestStrategyLabResult & {
  sources: CollectedStrategySource[];
  searchQueries?: string[];
  researchSummary?: string;
  researchModel?: string | null;
};

const DEFAULT_TIMEOUT_MS = 45_000;

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

export function canUseRemoteContestStrategyService() {
  return getRemoteConfig() !== null;
}

function normalizeRemoteSource(source: CollectedStrategySource): CollectedStrategySource {
  return {
    label: source.label,
    sourceType: source.sourceType,
    url: source.url ?? null,
    title: source.title,
    snippet: source.snippet,
    contentText: source.contentText,
    httpStatus: source.httpStatus ?? null,
    searchQuery: source.searchQuery ?? null,
    rankingScore: Number(source.rankingScore ?? 0),
    citationScore: Number(source.citationScore ?? 0),
    selectedForCitation: Boolean(source.selectedForCitation),
  };
}

export async function generateContestStrategyWithRemoteService(contest: Contest): Promise<{
  result: ContestStrategyLabResult;
  sources: CollectedStrategySource[];
}> {
  const config = getRemoteConfig();

  if (!config) {
    throw new Error("Remote contest strategy service is not configured.");
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

  const response = await fetch(`${config.baseUrl}/generate-contest-strategy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contest }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Remote contest strategy service failed.");
  }

  const payload = (await response.json()) as RemoteContestStrategyPayload;

  return {
    result: {
      overview: payload.overview,
      recommendedDirection: payload.recommendedDirection,
      ideas: payload.ideas,
      researchPoints: payload.researchPoints,
      draftTitle: payload.draftTitle,
      draftSubtitle: payload.draftSubtitle,
      draftSections: payload.draftSections,
      citations: payload.citations,
      promptVersion: payload.promptVersion ?? null,
      modelName: payload.modelName ?? null,
      status: payload.status,
    },
    sources: (payload.sources ?? []).map(normalizeRemoteSource),
  };
}

