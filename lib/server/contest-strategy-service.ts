import "server-only";

import type { Contest, ContestStrategyLabResult } from "@/types/contest";

import type { CollectedStrategySource } from "./contest-source-collector";
import { callRemoteAiService, canUseRemoteAiService } from "./remote-ai-runtime";

type RemoteContestStrategyPayload = ContestStrategyLabResult & {
  sources: CollectedStrategySource[];
  searchQueries?: string[];
  researchSummary?: string;
  researchModel?: string | null;
};

const DEFAULT_TIMEOUT_MS = 45_000;

export function canUseRemoteContestStrategyService() {
  return canUseRemoteAiService();
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
  const response = await callRemoteAiService<{ contest: Contest }, RemoteContestStrategyPayload>({
    service: "contest-strategy",
    path: "/generate-contest-strategy",
    payload: { contest },
    timeoutMs: DEFAULT_TIMEOUT_MS,
    metadata: {
      contestSlug: contest.slug,
    },
  });
  const payload = response.payload;

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
