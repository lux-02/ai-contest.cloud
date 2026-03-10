import type {
  ContestAnalysisStatus,
  ContestCategory,
  ContestDifficulty,
  ContestMode,
  ContestStatus,
} from "@/types/contest";

export type ContestDraft = {
  slug: string;
  title: string;
  organizer: string;
  shortDescription: string | null;
  description: string;
  url: string;
  sourceUrl: string | null;
  posterImageUrl: string | null;
  applyUrl: string | null;
  startDate: string | null;
  deadline: string | null;
  eventDate: string | null;
  participationMode: ContestMode;
  location: string | null;
  eligibilityText: string;
  eligibilitySegments: string[];
  difficulty: ContestDifficulty;
  teamAllowed: boolean;
  minTeamSize: number;
  maxTeamSize: number;
  language: string;
  globalParticipation: boolean;
  prizePoolKrw: number | null;
  prizeSummary: string | null;
  submissionFormat: string | null;
  toolsAllowed: string[];
  datasetProvided: boolean;
  datasetSummary: string | null;
  aiCategories: ContestCategory[];
  tags: string[];
  status: ContestStatus;
};

export type GeneratedAnalysis = {
  summary: string;
  recommendReason: string;
  winStrategy: string;
  difficultyAnalysis: string;
  judgingFocus: string;
  promptVersion: string;
  modelName: string | null;
  analysisStatus: ContestAnalysisStatus;
  rawResponse: unknown;
};

export const contestAnalysisPromptVersion = "contest-v1";

function buildPendingAnalysis(draft: ContestDraft): GeneratedAnalysis {
  return {
    summary: draft.shortDescription ?? "분석 대기 중",
    recommendReason: "",
    winStrategy: "",
    difficultyAnalysis: "",
    judgingFocus: "",
    promptVersion: contestAnalysisPromptVersion,
    modelName: null,
    analysisStatus: "pending",
    rawResponse: {
      status: "pending",
      reason: "OPENAI_API_KEY not configured",
      prompt: getAnalysisPrompt(draft),
    },
  };
}

function buildFailedAnalysis(draft: ContestDraft, modelName: string | null, rawResponse: unknown): GeneratedAnalysis {
  return {
    summary: draft.shortDescription ?? "분석 생성 실패",
    recommendReason: "",
    winStrategy: "",
    difficultyAnalysis: "",
    judgingFocus: "",
    promptVersion: contestAnalysisPromptVersion,
    modelName,
    analysisStatus: "failed",
    rawResponse,
  };
}

export function getAnalysisPrompt(draft: ContestDraft) {
  return [
    "You are an analyst for an AI contest discovery platform targeting Korean university students.",
    "Read the contest information and generate concise Korean output for the fields below.",
    "Be practical, specific, and helpful for students deciding whether to join.",
    "",
    "Required fields:",
    "1. summary",
    "2. recommendReason",
    "3. winStrategy",
    "4. difficultyAnalysis",
    "5. judgingFocus",
    "",
    "Contest JSON:",
    JSON.stringify(draft, null, 2),
  ].join("\n");
}

export async function generateContestAnalysis(draft: ContestDraft): Promise<GeneratedAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    return buildPendingAnalysis(draft);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
          name: "contest_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              recommendReason: { type: "string" },
              winStrategy: { type: "string" },
              difficultyAnalysis: { type: "string" },
              judgingFocus: { type: "string" },
            },
            required: ["summary", "recommendReason", "winStrategy", "difficultyAnalysis", "judgingFocus"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You analyze AI contests for Korean university students. Keep output concise, practical, and in Korean.",
        },
        {
          role: "user",
          content: getAnalysisPrompt(draft),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return buildFailedAnalysis(draft, model, {
      status: "failed",
      error: errorText,
    });
  }

  const rawResponse = await response.json();
  const content = rawResponse?.choices?.[0]?.message?.content;

  if (!content) {
    return buildFailedAnalysis(draft, model, rawResponse);
  }

  try {
    const parsed = JSON.parse(
      content,
    ) as Omit<GeneratedAnalysis, "promptVersion" | "modelName" | "analysisStatus" | "rawResponse">;

    return {
      ...parsed,
      promptVersion: contestAnalysisPromptVersion,
      modelName: model,
      analysisStatus: "completed",
      rawResponse,
    };
  } catch (error) {
    return buildFailedAnalysis(draft, model, {
      rawResponse,
      parseError: error instanceof Error ? error.message : "Unknown JSON parse error",
    });
  }
}
