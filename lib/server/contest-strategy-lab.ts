import "server-only";

import type { Contest, ContestStrategyLabResult } from "@/types/contest";
import type { CollectedStrategySource } from "@/lib/server/contest-source-collector";

const contestStrategyLabPromptVersion = "contest-strategy-lab-v5";
const STRATEGY_LAB_TIMEOUT_MS = 25000;
const PROMPT_CONTEST_DESCRIPTION_LIMIT = 1500;
const PROMPT_SOURCE_CONTENT_LIMIT = 1200;
const PROMPT_SOURCE_LIMIT = 4;

type StrategyLabOptions = {
  userIdea?: string;
};

function buildPendingResult(): ContestStrategyLabResult {
  return {
    overview: "브레인스토밍 생성 대기 중",
    recommendedDirection: "",
    ideas: [],
    researchPoints: [],
    draftTitle: "",
    draftSubtitle: "",
    draftSections: [],
    citations: [],
    promptVersion: contestStrategyLabPromptVersion,
    modelName: null,
    status: "pending",
  };
}

function buildFailedResult(modelName: string | null): ContestStrategyLabResult {
  return {
    overview: "브레인스토밍 생성 실패",
    recommendedDirection: "",
    ideas: [],
    researchPoints: [],
    draftTitle: "",
    draftSubtitle: "",
    draftSections: [],
    citations: [],
    promptVersion: contestStrategyLabPromptVersion,
    modelName,
    status: "failed",
  };
}

function buildCitations(sources: CollectedStrategySource[]) {
  return sources
    .filter((source) => source.contentText.trim().length > 0 && source.selectedForCitation)
    .map((source) => ({
      label: source.label,
      title: source.title,
      url: source.url ?? null,
      snippet: source.snippet,
      sourceType: source.sourceType,
      searchQuery: source.searchQuery ?? null,
      rankingScore: source.rankingScore,
      citationScore: source.citationScore,
      selectedForCitation: source.selectedForCitation,
    }));
}

function summarizeContestForPrompt(contest: Contest) {
  return {
    title: contest.title,
    organizer: contest.organizer,
    shortDescription: contest.shortDescription,
    description: contest.description.slice(0, PROMPT_CONTEST_DESCRIPTION_LIMIT),
    url: contest.url,
    sourceUrl: contest.sourceUrl ?? null,
    applyUrl: contest.applyUrl ?? null,
    deadline: contest.deadline ?? null,
    participationMode: contest.participationMode,
    eligibilityText: contest.eligibilityText,
    difficulty: contest.difficulty,
    teamAllowed: contest.teamAllowed,
    prizeSummary: contest.prizeSummary ?? null,
    submissionFormat: contest.submissionFormat ?? null,
    submissionItems: contest.submissionItems ?? [],
    judgingCriteria: contest.judgingCriteria ?? [],
    stageSchedule: contest.stageSchedule ?? [],
    pastWinners: contest.pastWinners ?? null,
    toolsAllowed: contest.toolsAllowed,
    categories: contest.aiCategories,
    tags: contest.tags,
    analysis: {
      summary: contest.analysis.summary,
      recommendReason: contest.analysis.recommendReason,
      winStrategy: contest.analysis.winStrategy,
      difficultyAnalysis: contest.analysis.difficultyAnalysis,
      judgingFocus: contest.analysis.judgingFocus,
    },
  };
}

function pickPromptSources(sources: CollectedStrategySource[]) {
  const prioritized = [...sources].sort(
    (left, right) =>
      Number(right.selectedForCitation) - Number(left.selectedForCitation) ||
      right.citationScore - left.citationScore ||
      right.rankingScore - left.rankingScore,
  );

  return prioritized.slice(0, PROMPT_SOURCE_LIMIT).map((source) => ({
    label: source.label,
    sourceType: source.sourceType,
    title: source.title,
    url: source.url ?? null,
    snippet: source.snippet,
    searchQuery: source.searchQuery ?? null,
    rankingScore: source.rankingScore,
    citationScore: source.citationScore,
    selectedForCitation: source.selectedForCitation,
    contentExcerpt: source.contentText.slice(0, PROMPT_SOURCE_CONTENT_LIMIT),
  }));
}

function getStrategyLabPrompt(contest: Contest, sources: CollectedStrategySource[], options: StrategyLabOptions = {}) {
  const userIdea = options.userIdea?.trim();

  return [
    "You are an AI contest strategist for Korean university students.",
    "Generate a practical Korean brainstorming pack for this contest.",
    "All string values in the JSON must be written in Korean.",
    "Use Korean even when the contest brand name is in English.",
    "Base your reasoning only on the contest data, judging criteria, submission items, and existing AI analysis provided.",
    "When submissionItems or judgingCriteria exist, reflect them directly in the planning advice and draft.",
    userIdea
      ? "The user already has a draft idea. Strengthen it to fit the judging criteria, submission requirements, and winning patterns instead of ignoring it."
      : "If there is no user idea, propose the most competitive directions from scratch.",
    "Use the collected sources only as supporting context. Do not print source labels in the generated text.",
    "Do not claim that you researched anything beyond the provided sources.",
    "Keep every item actionable and specific enough to use in a planning meeting.",
    "",
    "Return these fields:",
    "1. overview: one concise paragraph explaining what kind of submission is likely to place highly",
    "2. recommendedDirection: one sentence naming the strongest direction",
    "3. ideas: 4 distinct concept ideas",
    "4. researchPoints: 4 deep-research style notes derived from the brief and judging focus",
    "5. draftTitle",
    "6. draftSubtitle",
    "7. draftSections: 5 sections for a proposal or strategy draft",
    "",
    `Prompt version: ${contestStrategyLabPromptVersion}`,
    userIdea ? `User idea:\n${userIdea}` : "User idea:\n없음",
    "Contest JSON:",
    JSON.stringify(summarizeContestForPrompt(contest), null, 2),
    "",
    "Collected sources JSON:",
    JSON.stringify(pickPromptSources(sources), null, 2),
  ].join("\n");
}

export async function generateContestStrategyLab(
  contest: Contest,
  sources: CollectedStrategySource[],
  options: StrategyLabOptions = {},
): Promise<ContestStrategyLabResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const citations = buildCitations(sources);

  if (!apiKey) {
    return buildPendingResult();
  }

  let response: Response;

  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "contest_strategy_lab",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                overview: { type: "string" },
                recommendedDirection: { type: "string" },
                ideas: {
                  type: "array",
                  minItems: 4,
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      concept: { type: "string" },
                      winningEdge: { type: "string" },
                      executionFocus: { type: "string" },
                    },
                    required: ["title", "concept", "winningEdge", "executionFocus"],
                  },
                },
                researchPoints: {
                  type: "array",
                  minItems: 4,
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      insight: { type: "string" },
                      action: { type: "string" },
                    },
                    required: ["title", "insight", "action"],
                  },
                },
                draftTitle: { type: "string" },
                draftSubtitle: { type: "string" },
                draftSections: {
                  type: "array",
                  minItems: 5,
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      body: { type: "string" },
                    },
                    required: ["title", "body"],
                  },
                },
              },
              required: [
                "overview",
                "recommendedDirection",
                "ideas",
                "researchPoints",
                "draftTitle",
                "draftSubtitle",
                "draftSections",
              ],
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "You create Korean brainstorming packs for AI contests. Every field value must be in Korean. Use the supplied contest brief, judging criteria, and submission requirements directly, but do not print source labels in the generated text.",
          },
          {
            role: "user",
            content: getStrategyLabPrompt(contest, sources, options),
          },
        ],
      }),
      signal: AbortSignal.timeout(STRATEGY_LAB_TIMEOUT_MS),
    });
  } catch {
    return buildFailedResult(model);
  }

  if (!response.ok) {
    return buildFailedResult(model);
  }

  const rawResponse = await response.json();
  const content = rawResponse?.choices?.[0]?.message?.content;

  if (!content) {
    return buildFailedResult(model);
  }

  try {
    const parsed = JSON.parse(content) as Omit<ContestStrategyLabResult, "status" | "modelName" | "citations">;

    return {
      ...parsed,
      citations,
      promptVersion: contestStrategyLabPromptVersion,
      modelName: model,
      status: "completed",
    };
  } catch {
    return buildFailedResult(model);
  }
}
