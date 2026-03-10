import "server-only";

import {
  contestCategoryOptions,
  difficultyOptions,
  type ContestCategory,
  type ContestDifficulty,
  type ContestMode,
} from "@/types/contest";

export type ContestExtractionInput = {
  sourceUrl?: string | null;
  rawText: string;
};

export type ExtractedContestFields = {
  title: string | null;
  organizer: string | null;
  shortDescription: string | null;
  description: string | null;
  url: string | null;
  sourceUrl: string | null;
  applyUrl: string | null;
  startDate: string | null;
  deadline: string | null;
  eventDate: string | null;
  participationMode: ContestMode | null;
  location: string | null;
  eligibilityText: string | null;
  eligibilitySegments: string[];
  difficulty: ContestDifficulty | null;
  teamAllowed: boolean | null;
  minTeamSize: number | null;
  maxTeamSize: number | null;
  language: string | null;
  globalParticipation: boolean | null;
  prizePoolKrw: number | null;
  prizeSummary: string | null;
  submissionFormat: string | null;
  toolsAllowed: string[];
  datasetProvided: boolean | null;
  datasetSummary: string | null;
  aiCategories: ContestCategory[];
  tags: string[];
};

export type ContestExtractionPreviewItem = {
  label: string;
  value: string;
};

export type ContestExtractionResult = {
  fields: ExtractedContestFields;
  preview: ContestExtractionPreviewItem[];
  notes: string[];
  status: "completed" | "failed" | "pending";
  modelName: string | null;
  rawResponse: unknown;
};

const extractionPromptVersion = "contest-extract-v1";

function nullableStringSchema(description: string) {
  return {
    anyOf: [{ type: "string" }, { type: "null" }],
    description,
  } as const;
}

function nullableBooleanSchema(description: string) {
  return {
    anyOf: [{ type: "boolean" }, { type: "null" }],
    description,
  } as const;
}

function nullableNumberSchema(description: string) {
  return {
    anyOf: [{ type: "number" }, { type: "null" }],
    description,
  } as const;
}

function buildEmptyFields(input: ContestExtractionInput): ExtractedContestFields {
  return {
    title: null,
    organizer: null,
    shortDescription: null,
    description: input.rawText.trim() || null,
    url: input.sourceUrl?.trim() || null,
    sourceUrl: input.sourceUrl?.trim() || null,
    applyUrl: null,
    startDate: null,
    deadline: null,
    eventDate: null,
    participationMode: null,
    location: null,
    eligibilityText: null,
    eligibilitySegments: [],
    difficulty: null,
    teamAllowed: null,
    minTeamSize: null,
    maxTeamSize: null,
    language: null,
    globalParticipation: null,
    prizePoolKrw: null,
    prizeSummary: null,
    submissionFormat: null,
    toolsAllowed: [],
    datasetProvided: null,
    datasetSummary: null,
    aiCategories: [],
    tags: [],
  };
}

function buildPreview(fields: ExtractedContestFields): ContestExtractionPreviewItem[] {
  const categoryLabels = fields.aiCategories.map(
    (category) => contestCategoryOptions.find((option) => option.id === category)?.label ?? category,
  );

  return [
    { label: "제목 후보", value: fields.title || "직접 확인 필요" },
    { label: "한 줄 소개", value: fields.shortDescription || "직접 확인 필요" },
    { label: "마감일", value: fields.deadline || "직접 확인 필요" },
    { label: "신청 링크", value: fields.applyUrl || fields.url || "직접 확인 필요" },
    {
      label: "AI 카테고리",
      value: categoryLabels.length > 0 ? categoryLabels.join(", ") : "직접 선택 필요",
    },
  ];
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeToolsAllowed(values: string[]) {
  return Array.from(
    new Set(
      values.filter(
        (value) =>
          !/google form|구글폼|forms\.gle|youtube|유튜브|submit|submission|link|링크/i.test(value),
      ),
    ),
  ).slice(0, 6);
}

function normalizeMode(value: unknown): ContestMode | null {
  return value === "online" || value === "offline" || value === "hybrid" ? value : null;
}

function normalizeDifficulty(value: unknown): ContestDifficulty | null {
  return difficultyOptions.some((option) => option.id === value) ? (value as ContestDifficulty) : null;
}

function normalizeCategories(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (category): category is ContestCategory =>
      typeof category === "string" && contestCategoryOptions.some((option) => option.id === category),
  );
}

function deriveFallbackCategories(text: string) {
  const categories = new Set<ContestCategory>();
  const lower = text.toLowerCase();
  const modalityHits = ["이미지", "영상", "비디오", "음성", "텍스트", "audio", "speech"].filter((keyword) =>
    lower.includes(keyword.toLowerCase()),
  ).length;

  if (/llm|rag|agent|chatbot|language model|언어 모델/.test(lower)) {
    categories.add("llm-agents");
  }

  if (/생성형 ai|generative|text-to-image|text-to-video|image generation|video generation|광고/.test(lower)) {
    categories.add("generative-ai");
  }

  if (/computer vision|vision|이미지 분석|비전|영상 인식|object detection|recognition/.test(lower)) {
    categories.add("computer-vision");
  }

  if (modalityHits >= 2 || /multimodal/.test(lower)) {
    categories.add("multimodal-ai");
  }

  if (/prediction|classification|kaggle|dacon|예측|분류|시계열/.test(lower)) {
    categories.add("data-science");
  }

  if (/robot|embodied|autonomous|자율주행|로봇/.test(lower)) {
    categories.add("robotics");
  }

  if (/social good|climate|health|education|기후|의료|교육|사회 문제/.test(lower)) {
    categories.add("ai-for-social-good");
  }

  if (/infra|mlops|optimization|serving|inference|시스템|최적화|배포/.test(lower)) {
    categories.add("ai-infra-systems");
  }

  if (categories.size === 0 && lower.includes("ai")) {
    categories.add("generative-ai");
  }

  return Array.from(categories);
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function deriveFallbackToolsAllowed(text: string) {
  const tools = new Set<string>();
  const explicitToolMap: Array<[RegExp, string]> = [
    [/openai api|gpt[- ]?\d|chatgpt/i, "OpenAI API"],
    [/claude/i, "Claude"],
    [/gemini/i, "Gemini"],
    [/pytorch/i, "PyTorch"],
    [/tensorflow/i, "TensorFlow"],
    [/python/i, "Python"],
    [/c\+\+/i, "C++"],
    [/next\.js|nextjs/i, "Next.js"],
    [/react/i, "React"],
    [/supabase/i, "Supabase"],
    [/langchain/i, "LangChain"],
    [/llamaindex/i, "LlamaIndex"],
    [/runway/i, "Runway"],
    [/midjourney/i, "Midjourney"],
    [/stable diffusion/i, "Stable Diffusion"],
    [/comfyui/i, "ComfyUI"],
    [/figma/i, "Figma"],
  ];

  for (const [pattern, label] of explicitToolMap) {
    if (pattern.test(text)) {
      tools.add(label);
    }
  }

  if (/생성형 ai|generative/i.test(text)) {
    tools.add("생성형 AI");
  }

  if (/영상|비디오|video/i.test(text)) {
    tools.add("영상 생성 AI");
  }

  if (/이미지|image/i.test(text)) {
    tools.add("이미지 생성 AI");
  }

  if (/음성|voice|audio/i.test(text)) {
    tools.add("음성 생성 AI");
  }

  if (/텍스트|text/i.test(text)) {
    tools.add("텍스트 생성 AI");
  }

  return Array.from(tools).slice(0, 6);
}

function normalizeFields(input: ContestExtractionInput, payload: Record<string, unknown>): ExtractedContestFields {
  const sourceUrl = normalizeString(payload.sourceUrl) || input.sourceUrl?.trim() || null;
  const url = normalizeString(payload.url) || sourceUrl;
  const applyUrl = normalizeString(payload.applyUrl) || url;
  const teamAllowed = normalizeBoolean(payload.teamAllowed);
  const minTeamSize = normalizeNumber(payload.minTeamSize);
  const maxTeamSize = normalizeNumber(payload.maxTeamSize);
  const toolsAllowed = sanitizeToolsAllowed(normalizeStringArray(payload.toolsAllowed));
  const aiCategories = normalizeCategories(payload.aiCategories);

  return {
    title: normalizeString(payload.title),
    organizer: normalizeString(payload.organizer),
    shortDescription: normalizeString(payload.shortDescription),
    description: normalizeString(payload.description) || input.rawText.trim() || null,
    url,
    sourceUrl,
    applyUrl,
    startDate: normalizeString(payload.startDate),
    deadline: normalizeString(payload.deadline),
    eventDate: normalizeString(payload.eventDate),
    participationMode: normalizeMode(payload.participationMode),
    location: normalizeString(payload.location),
    eligibilityText: normalizeString(payload.eligibilityText),
    eligibilitySegments: normalizeStringArray(payload.eligibilitySegments),
    difficulty: normalizeDifficulty(payload.difficulty),
    teamAllowed,
    minTeamSize: minTeamSize ?? (teamAllowed === false ? 1 : null),
    maxTeamSize: maxTeamSize ?? (teamAllowed === false ? 1 : null),
    language: normalizeString(payload.language),
    globalParticipation: normalizeBoolean(payload.globalParticipation),
    prizePoolKrw: normalizeNumber(payload.prizePoolKrw),
    prizeSummary: normalizeString(payload.prizeSummary),
    submissionFormat: normalizeString(payload.submissionFormat),
    toolsAllowed: toolsAllowed.length > 0 ? toolsAllowed : deriveFallbackToolsAllowed(input.rawText),
    datasetProvided: normalizeBoolean(payload.datasetProvided),
    datasetSummary: normalizeString(payload.datasetSummary),
    aiCategories: aiCategories.length > 0 ? aiCategories : deriveFallbackCategories(input.rawText),
    tags: normalizeStringArray(payload.tags),
  };
}

function buildPendingResult(input: ContestExtractionInput): ContestExtractionResult {
  const fields = buildEmptyFields(input);

  return {
    fields,
    preview: buildPreview(fields),
    notes: ["OPENAI_API_KEY가 없어 AI 추출을 실행하지 못했습니다."],
    status: "pending",
    modelName: null,
    rawResponse: {
      status: "pending",
      reason: "OPENAI_API_KEY not configured",
      promptVersion: extractionPromptVersion,
    },
  };
}

function buildFailedResult(
  input: ContestExtractionInput,
  modelName: string | null,
  rawResponse: unknown,
  note = "AI 추출 결과를 파싱하지 못했습니다.",
): ContestExtractionResult {
  const fields = buildEmptyFields(input);

  return {
    fields,
    preview: buildPreview(fields),
    notes: [note],
    status: "failed",
    modelName,
    rawResponse,
  };
}

function getExtractionPrompt(input: ContestExtractionInput) {
  return [
    "You extract structured admin registration fields for an AI contest platform.",
    "Return facts only. If a field is not stated or cannot be inferred with high confidence, return null or an empty array.",
    "Never invent URLs, dates, or prizes.",
    "Use concise Korean for title, shortDescription, description, prizeSummary, submissionFormat, and eligibilityText.",
    "Use these exact enums when available:",
    `- participationMode: ${JSON.stringify(["online", "offline", "hybrid"])}`,
    `- difficulty: ${JSON.stringify(difficultyOptions.map((option) => option.id))}`,
    `- aiCategories: ${JSON.stringify(contestCategoryOptions.map((option) => option.id))}`,
    "Use short English tokens for eligibilitySegments and tags when appropriate. Example: student, developer, creator.",
    "For description, write a cleaned admin-ready summary in Korean that preserves key dates, eligibility, submission method, judging points, and notable rewards.",
    "If the source URL is a community or aggregator page and no official URL is present in the source text, keep url/sourceUrl as the provided source URL.",
    "If only an application form URL is explicit, set applyUrl to that form URL and keep url as the provided source URL unless an official detail page is present.",
    "For prizePoolKrw, return the total comparable cash prize in Korean won when explicit. Convert 만원/억원 into integer won. If only travel, goods, experience, or mixed non-cash rewards are listed, you may return null.",
    "Populate toolsAllowed with 3 to 6 concise tool or stack signals that matter for submission. Prefer explicit tools; otherwise use conservative stack labels like 생성형 AI, 영상 생성 AI, PyTorch, Supabase.",
    "Do not include submission channels such as Google Form, forms.gle, YouTube upload, Notion, or generic links inside toolsAllowed.",
    "Write reviewNotes in concise Korean.",
    "Add reviewNotes for anything inferred, ambiguous, or worth checking before publishing.",
    "",
    "Input JSON:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}

export async function extractContestFields(input: ContestExtractionInput): Promise<ContestExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    return buildPendingResult(input);
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
          name: "contest_registration_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: nullableStringSchema("Public-facing contest title in Korean."),
              organizer: nullableStringSchema("Organizer or host name."),
              shortDescription: nullableStringSchema("One-line teaser in Korean, around 50-90 characters."),
              description: nullableStringSchema("Cleaned Korean summary for admin storage."),
              url: nullableStringSchema("Primary detail page URL."),
              sourceUrl: nullableStringSchema("Source URL where this notice was found."),
              applyUrl: nullableStringSchema("Application or submission URL."),
              startDate: nullableStringSchema("Application start date in YYYY-MM-DD."),
              deadline: nullableStringSchema("Deadline date in YYYY-MM-DD."),
              eventDate: nullableStringSchema("Announcement or main event date in YYYY-MM-DD."),
              participationMode: {
                anyOf: [{ type: "string", enum: ["online", "offline", "hybrid"] }, { type: "null" }],
              },
              location: nullableStringSchema("Location if explicit."),
              eligibilityText: nullableStringSchema("Eligibility summary in Korean."),
              eligibilitySegments: {
                type: "array",
                items: { type: "string" },
              },
              difficulty: {
                anyOf: [{ type: "string", enum: difficultyOptions.map((option) => option.id) }, { type: "null" }],
              },
              teamAllowed: nullableBooleanSchema("Whether team participation is allowed."),
              minTeamSize: nullableNumberSchema("Minimum team size."),
              maxTeamSize: nullableNumberSchema("Maximum team size."),
              language: nullableStringSchema("Primary language. Example: Korean, English."),
              globalParticipation: nullableBooleanSchema("Whether international participation is explicitly allowed."),
              prizePoolKrw: nullableNumberSchema("Total comparable prize pool in Korean won when explicit."),
              prizeSummary: nullableStringSchema("Korean prize summary."),
              submissionFormat: nullableStringSchema("Korean submission requirement summary."),
              toolsAllowed: {
                type: "array",
                items: { type: "string" },
              },
              datasetProvided: nullableBooleanSchema("Whether a dataset is explicitly provided."),
              datasetSummary: nullableStringSchema("Dataset details if explicit."),
              aiCategories: {
                type: "array",
                items: { type: "string", enum: contestCategoryOptions.map((option) => option.id) },
              },
              tags: {
                type: "array",
                items: { type: "string" },
              },
              reviewNotes: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "title",
              "organizer",
              "shortDescription",
              "description",
              "url",
              "sourceUrl",
              "applyUrl",
              "startDate",
              "deadline",
              "eventDate",
              "participationMode",
              "location",
              "eligibilityText",
              "eligibilitySegments",
              "difficulty",
              "teamAllowed",
              "minTeamSize",
              "maxTeamSize",
              "language",
              "globalParticipation",
              "prizePoolKrw",
              "prizeSummary",
              "submissionFormat",
              "toolsAllowed",
              "datasetProvided",
              "datasetSummary",
              "aiCategories",
              "tags",
              "reviewNotes",
            ],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You extract structured registration data for an AI contest admin tool. Be factual, concise, and conservative. Output JSON only.",
        },
        {
          role: "user",
          content: getExtractionPrompt(input),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return buildFailedResult(input, model, { status: "failed", error: errorText }, "AI 추출 요청에 실패했습니다.");
  }

  const rawResponse = await response.json();
  const content = rawResponse?.choices?.[0]?.message?.content;

  if (!content) {
    return buildFailedResult(input, model, rawResponse);
  }

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const fields = normalizeFields(input, parsed);
    const notes = normalizeStringArray(parsed.reviewNotes);

    return {
      fields,
      preview: buildPreview(fields),
      notes,
      status: "completed",
      modelName: model,
      rawResponse: {
        promptVersion: extractionPromptVersion,
        response: rawResponse,
      },
    };
  } catch (error) {
    return buildFailedResult(input, model, {
      rawResponse,
      parseError: error instanceof Error ? error.message : "Unknown JSON parse error",
    });
  }
}
