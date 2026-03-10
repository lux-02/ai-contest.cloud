"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useActionState, useDeferredValue, useRef, useState } from "react";

import {
  contestCategoryOptions,
  difficultyOptions,
  organizerTypeOptions,
  type ContestCategory,
  type ContestDifficulty,
  type ContestJudgingCriterion,
  type ContestMode,
  type ContestOrganizerType,
  type ContestStage,
  type ContestStatus,
} from "@/types/contest";
import type { CreateContestState } from "@/lib/server/contest-admin";
import { formatDeadlineLabel, formatMode } from "@/lib/utils";

const initialState: CreateContestState = {
  status: "idle",
};

const fieldClassName =
  "w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[rgba(245,241,232,0.18)] focus:bg-[rgba(255,255,255,0.05)]";

const sectionHeadingAliases = {
  overview: ["공모 개요", "대회 개요", "모집 개요", "프로그램 개요", "행사 개요", "소개"],
  awards: ["시상 내역", "시상 내용", "혜택", "리워드", "시상"],
  requirements: ["작품 요건", "참여 요건", "제출 요건", "작품 규격", "출품 규격", "참가 요건"],
  methods: ["출품 방법", "접수 방법", "신청 방법", "지원 방법", "참여 방법"],
  materials: ["제출 자료", "제출 서류", "제출 항목"],
  judging: ["심사 기준", "평가 기준", "심사 항목", "평가 항목"],
  notices: ["유의사항", "안내사항", "참고사항", "주의사항"],
} as const;
const allSectionHeadings = Object.values(sectionHeadingAliases).flat();
const datePattern = /(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일/g;

export type ContestFormInitialData = {
  slug: string;
  title: string;
  organizer: string;
  organizerType?: ContestOrganizerType | null;
  shortDescription?: string | null;
  description: string;
  url: string;
  sourceUrl?: string | null;
  posterImageUrl?: string | null;
  applyUrl?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  eventDate?: string | null;
  participationMode: ContestMode;
  location?: string | null;
  eligibilityText: string;
  eligibilitySegments: string[];
  difficulty: ContestDifficulty;
  teamAllowed: boolean;
  minTeamSize: number;
  maxTeamSize: number;
  language: string;
  globalParticipation: boolean;
  prizePoolKrw?: number | null;
  prizeSummary?: string | null;
  submissionFormat?: string | null;
  submissionItems?: string[];
  judgingCriteria?: ContestJudgingCriterion[];
  stageSchedule?: ContestStage[];
  pastWinners?: string | null;
  toolsAllowed: string[];
  datasetProvided: boolean;
  datasetSummary?: string | null;
  aiCategories: ContestCategory[];
  tags: string[];
  status: ContestStatus;
};

type ContestFormProps = {
  action: (state: CreateContestState, formData: FormData) => Promise<CreateContestState>;
  analysisReady: boolean;
  initialData?: ContestFormInitialData;
  mode?: "create" | "edit";
};

type QuickFillFields = {
  title?: string;
  organizer?: string;
  organizerType?: ContestOrganizerType | null;
  shortDescription?: string;
  description?: string;
  url?: string;
  sourceUrl?: string;
  applyUrl?: string;
  startDate?: string;
  deadline?: string;
  eventDate?: string;
  participationMode?: ContestMode;
  location?: string;
  eligibilityText?: string;
  eligibilitySegments?: string[];
  difficulty?: ContestDifficulty;
  teamAllowed?: boolean;
  minTeamSize?: number;
  maxTeamSize?: number;
  language?: string;
  globalParticipation?: boolean;
  prizePoolKrw?: number | null;
  prizeSummary?: string;
  submissionFormat?: string;
  submissionItems?: string[];
  judgingCriteria?: ContestJudgingCriterion[];
  stageSchedule?: ContestStage[];
  pastWinners?: string | null;
  toolsAllowed?: string[];
  datasetProvided?: boolean | null;
  datasetSummary?: string | null;
  aiCategories?: ContestCategory[];
  tags?: string[];
};

type QuickFillPreviewItem = {
  label: string;
  value: string;
};

type QuickFillResult = {
  fields: QuickFillFields;
  preview: QuickFillPreviewItem[];
  notes: string[];
};

type AiQuickFillSuccess = QuickFillResult & {
  status: "completed" | "pending";
  modelName: string | null;
};

type AiQuickFillError = {
  error?: string;
  notes?: string[];
};

function isAiQuickFillSuccess(payload: AiQuickFillSuccess | AiQuickFillError): payload is AiQuickFillSuccess {
  return "fields" in payload;
}

function InputShell({
  label,
  name,
  required,
  helper,
  children,
}: {
  label: string;
  name?: string;
  required?: boolean;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-[var(--foreground)]">
        {label}
        {required ? <span className="ml-1 text-[var(--danger)]">*</span> : null}
      </span>
      {children}
      {helper ? <p className="text-xs leading-5 text-[var(--muted)]">{helper}</p> : null}
      {name ? <input type="hidden" name={`${name}__field`} value={name} /> : null}
    </label>
  );
}

function joinList(values?: string[] | null) {
  return values?.join(", ") ?? "";
}

function joinSubmissionItems(values?: string[] | null) {
  return values?.join("\n") ?? "";
}

function joinStageSchedule(values?: ContestStage[] | null) {
  return values?.map((item) => [item.label, item.date ?? "", item.note ?? ""].join(" | ")).join("\n") ?? "";
}

function joinJudgingCriteria(values?: ContestJudgingCriterion[] | null) {
  return values?.map((item) => [item.label, item.weight ?? "", item.description ?? ""].join(" | ")).join("\n") ?? "";
}

function formatCategoryLabels(categories?: ContestCategory[] | null) {
  if (!categories?.length) {
    return "카테고리 자동 추천";
  }

  return categories
    .map((category) => contestCategoryOptions.find((option) => option.id === category)?.label ?? category)
    .join(", ");
}

function toDateInputValue(value?: string | Date | null) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function trimText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function stripListPrefix(line: string) {
  return line.replace(/^[•\-*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
}

function normalizeSourceText(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/•\s*/g, "\n• ")
    .replace(
      /(\d+\.\s*(?:공모 개요|시상 내역|작품 요건|출품 방법|제출 자료|심사 기준))/g,
      "\n$1",
    )
    .replace(/(\[유의사항\])/g, "\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractUrls(raw: string, sourceUrl: string) {
  const matches = `${sourceUrl}\n${raw}`.match(/https?:\/\/[^\s)<>"']+/g) ?? [];
  return Array.from(new Set(matches.map((url) => url.replace(/[.,]$/, ""))));
}

function extractLineValue(lines: string[], labels: string[]) {
  for (const line of lines) {
    const cleaned = stripListPrefix(line);

    for (const label of labels) {
      if (!cleaned.includes(label)) {
        continue;
      }

      const colonIndex = Math.max(cleaned.indexOf(":"), cleaned.indexOf("："));

      if (colonIndex >= 0) {
        return cleaned.slice(colonIndex + 1).trim();
      }
    }
  }

  return "";
}

function extractSectionLines(lines: string[], startHeadings: string[]) {
  const startIndex = lines.findIndex((line) => startHeadings.some((heading) => line.includes(heading)));

  if (startIndex === -1) {
    return [];
  }

  const output: string[] = [];
  const startHeadingSet = new Set(startHeadings);

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (allSectionHeadings.some((heading) => !startHeadingSet.has(heading) && line.includes(heading))) {
      break;
    }

    const cleaned = stripListPrefix(line);

    if (cleaned) {
      output.push(cleaned);
    }
  }

  return output;
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateRange(value: string) {
  const matches = Array.from(value.matchAll(datePattern));

  if (matches.length === 0) {
    return {
      startDate: undefined,
      endDate: undefined,
    };
  }

  const baseYear = Number(matches[0]?.[1] ?? new Date().getFullYear());
  const [firstMatch, secondMatch] = matches;
  const firstYear = Number(firstMatch?.[1] ?? baseYear);
  const secondYear = Number(secondMatch?.[1] ?? firstYear);

  return {
    startDate: firstMatch ? toIsoDate(firstYear, Number(firstMatch[2]), Number(firstMatch[3])) : undefined,
    endDate: secondMatch ? toIsoDate(secondYear, Number(secondMatch[2]), Number(secondMatch[3])) : undefined,
  };
}

function parseFirstDate(value: string, fallbackYear?: number) {
  const match = value.match(datePattern);

  if (!match?.length) {
    return undefined;
  }

  const parsed = Array.from(value.matchAll(datePattern))[0];

  if (!parsed) {
    return undefined;
  }

  const resolvedYear = Number(parsed[1] ?? fallbackYear ?? new Date().getFullYear());
  return toIsoDate(resolvedYear, Number(parsed[2]), Number(parsed[3]));
}

function detectOrganizer(text: string, lines: string[]) {
  const labeled = extractLineValue(lines, ["주최/주관", "주최 기관", "주최", "주관"]);

  if (labeled) {
    return trimText(labeled, 40);
  }

  const officialBlogMatch = text.match(/([A-Za-z0-9가-힣&·().\-\s]{2,30})\s*공식 블로그/);

  if (officialBlogMatch?.[1]) {
    return trimText(officialBlogMatch[1], 40);
  }

  const corporationMatch = text.match(
    /([A-Za-z0-9가-힣&·().\-\s]{2,30}(?:코리아|재단|협회|진흥원|연구원|대학교|대학|센터|위원회|공사))/,
  );

  if (corporationMatch?.[1]) {
    return trimText(corporationMatch[1], 40);
  }

  return "";
}

function buildFallbackTitle(subject: string, organizer: string) {
  const anniversary = subject.match(/\d+주년/)?.[0];
  const uppercaseToken = subject.match(/\b[A-Z]{2,}(?:\s*[A-Z0-9]{1,})?\b/)?.[0];
  const titleTokens = [
    uppercaseToken,
    anniversary,
    /영상 광고|광고 영상|광고/.test(subject) ? "AI 영상 광고" : /영상/.test(subject) ? "AI 영상" : "",
  ].filter(Boolean);

  if (titleTokens.length > 0) {
    return trimText([organizer, ...titleTokens, "공모전"].filter(Boolean).join(" "), 48);
  }

  const compactSubject = trimText(subject.replace(/^공모 주제[:：]?\s*/, "").replace(/\s+/g, " "), 34);

  if (!compactSubject) {
    return "";
  }

  const suffix = /공모전|챌린지|해커톤|콘테스트/.test(compactSubject) ? "" : " 공모전";
  return trimText([organizer, `${compactSubject}${suffix}`].filter(Boolean).join(" "), 48);
}

function deriveParticipationMode(text: string, location: string) {
  const lower = text.toLowerCase();
  const hasOffline = /오프라인|현장|오프라인 행사|시상식|현장 발표|현장 심사/.test(text) || Boolean(location);
  const hasOnline = /온라인|google form|forms\.gle|업로드 링크|유튜브/.test(lower);

  if (hasOffline && hasOnline) {
    return "hybrid";
  }

  if (hasOffline) {
    return "offline";
  }

  return "online";
}

function deriveDifficulty(text: string) {
  const lower = text.toLowerCase();

  if (/논문|research|fine[- ]?tuning|benchmark|최적화|대규모 학습/.test(lower)) {
    return "advanced";
  }

  if (/생성형 ai|generative|영상 제작|해커톤|프로토타입|데모|광고/.test(lower)) {
    return "intermediate";
  }

  return "beginner";
}

function deriveAiCategories(text: string) {
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

function deriveToolsAllowed(text: string) {
  const lower = text.toLowerCase();
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

  if (/생성형 ai|generative/.test(lower)) {
    tools.add("생성형 AI");
  }

  if (/영상|비디오|video/.test(lower)) {
    tools.add("영상 생성 AI");
  }

  if (/이미지|image/.test(lower)) {
    tools.add("이미지 생성 AI");
  }

  if (/음성|voice|audio/.test(lower)) {
    tools.add("음성 생성 AI");
  }

  if (/텍스트|text/.test(lower)) {
    tools.add("텍스트 생성 AI");
  }

  return Array.from(tools).slice(0, 6);
}

function deriveTags({
  text,
  sourceUrl,
  applyUrl,
  teamAllowed,
  globalParticipation,
}: {
  text: string;
  sourceUrl: string;
  applyUrl: string;
  teamAllowed: boolean;
  globalParticipation: boolean;
}) {
  const tags = new Set<string>();

  if (/대학생|휴학생|졸업 예정자/.test(text)) {
    tags.add("Student");
  }

  if (/영상|비디오/.test(text)) {
    tags.add("Video");
  }

  if (/광고|브랜드/.test(text)) {
    tags.add("Brand");
  }

  if (!teamAllowed) {
    tags.add("Individual");
  }

  if (globalParticipation) {
    tags.add("Global");
  }

  if (/forms\.gle|docs\.google\.com\/forms/.test(applyUrl)) {
    tags.add("Google Form");
  }

  if (/forms\.gle|docs\.google\.com\/forms/.test(sourceUrl)) {
    tags.add("External Form");
  }

  return Array.from(tags);
}

function buildPrizeSummary(lines: string[]) {
  if (lines.length === 0) {
    return "";
  }

  return trimText(lines.slice(0, 3).join(" / "), 150);
}

function buildSubmissionSummary(requirements: string[], methods: string[]) {
  const keyLines = [...requirements, ...methods].filter((line) =>
    /파일 형식|해상도|화면 비율|영상 길이|용량|업로드|제출|코드|발표|유튜브|링크/.test(line),
  );

  const target = keyLines.length > 0 ? keyLines : [...requirements, ...methods];
  return trimText(target.slice(0, 4).join(" / "), 160);
}

function buildQuickFill(rawSourceText: string, sourceUrl: string): QuickFillResult {
  const normalizedText = normalizeSourceText(rawSourceText);
  const lines = normalizedText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const overviewLines = extractSectionLines(lines, [...sectionHeadingAliases.overview]);
  const awardLines = extractSectionLines(lines, [...sectionHeadingAliases.awards]);
  const requirementLines = extractSectionLines(lines, [...sectionHeadingAliases.requirements]);
  const methodLines = extractSectionLines(lines, [...sectionHeadingAliases.methods]);
  const judgingLines = extractSectionLines(lines, [...sectionHeadingAliases.judging]);
  const subject = extractLineValue(lines, ["공모 주제", "주제", "미션", "과제"]);
  const explicitTitle = extractLineValue(lines, ["대회명", "공모전명", "공모명", "행사명", "프로그램명", "이벤트명"]);
  const organizer = detectOrganizer(normalizedText, lines);
  const title = explicitTitle || buildFallbackTitle(subject, organizer);
  const recruitingLine = extractLineValue(lines, ["모집 대상", "참가 대상", "지원 대상", "응모 자격", "참가 자격", "참가 대상자"]);
  const participationLine = extractLineValue(lines, ["참가 유형", "참가 형태", "참여 형태", "참가 방식"]);
  const receptionLine = extractLineValue(lines, ["접수 기간", "모집 기간", "신청 기간", "접수 일정", "참가 접수"]);
  const announcementLine = extractLineValue(lines, ["수상자 발표", "발표 일정", "결과 발표", "최종 발표", "선정 발표", "시상식 일정"]);
  const sourceUrls = extractUrls(normalizedText, sourceUrl);
  const applyUrl =
    sourceUrls.find((url) => /forms\.gle|docs\.google\.com\/forms/.test(url)) ??
    extractLineValue(lines, ["구글폼 링크", "신청 링크", "접수 링크", "지원 링크", "참여 링크"]);
  const canonicalSourceUrl = sourceUrl || sourceUrls.find((url) => !/forms\.gle|docs\.google\.com\/forms/.test(url)) || "";
  const location = extractLineValue(lines, ["장소", "행사 장소", "시상식 장소", "진행 장소", "운영 장소"]);
  const { startDate, endDate } = parseDateRange(receptionLine);
  const eventDate = announcementLine ? parseFirstDate(announcementLine, startDate ? Number(startDate.slice(0, 4)) : undefined) : undefined;
  const teamAllowed = !/개인\s*\(/.test(participationLine) && !/개인\s*(1인\s*1작품|참가)/.test(normalizedText);
  const minTeamSize = teamAllowed ? 1 : 1;
  const maxTeamSize = teamAllowed ? 4 : 1;
  const globalParticipation = /국내외|global|overseas|해외/.test(normalizedText);
  const aiCategories = deriveAiCategories(normalizedText);
  const toolsAllowed = deriveToolsAllowed(normalizedText);
  const prizeSummary = buildPrizeSummary(awardLines);
  const submissionFormat = buildSubmissionSummary(requirementLines, methodLines);
  const difficulty = deriveDifficulty(normalizedText);
  const shortDescription = trimText(subject || overviewLines[0] || normalizedText, 84);
  const eligibilitySegments = Array.from(
    new Set(
      [
        /대학생|휴학생|졸업 예정자/.test(recruitingLine || normalizedText) ? "student" : "",
        /개발|코딩|프로그래밍/.test(normalizedText) ? "developer" : "",
        /영상|광고|크리에이티브|디자인/.test(normalizedText) ? "creator" : "",
      ].filter(Boolean),
    ),
  );
  const tags = deriveTags({
    text: normalizedText,
    sourceUrl: canonicalSourceUrl,
    applyUrl,
    teamAllowed,
    globalParticipation,
  });
  const categoryLabels = aiCategories.map(
    (category) => contestCategoryOptions.find((option) => option.id === category)?.label ?? category,
  );
  const preview: QuickFillPreviewItem[] = [
    { label: "제목 후보", value: title || "직접 입력 필요" },
    { label: "마감일", value: endDate || "직접 확인 필요" },
    { label: "참가 대상", value: recruitingLine || "직접 확인 필요" },
    { label: "신청 링크", value: applyUrl || "원문 링크 사용" },
    { label: "AI 카테고리", value: categoryLabels.length > 0 ? categoryLabels.join(", ") : "직접 선택 필요" },
  ];
  const notes: string[] = [];

  if (!explicitTitle) {
    notes.push("명시적인 대회명이 없어 공모 주제를 바탕으로 제목 후보를 만들었습니다.");
  }

  if (prizeSummary) {
    notes.push("현물·장학금형 시상은 총상금 원화 대신 상금 요약만 채운 뒤 검수하는 편이 안전합니다.");
  }

  if (canonicalSourceUrl && applyUrl && canonicalSourceUrl !== applyUrl) {
    notes.push("현재 원문 링크와 신청 링크가 분리되어 있습니다. 공식 공고 링크가 있다면 원문 링크를 그쪽으로 교체하는 편이 좋습니다.");
  }

  if (judgingLines.length > 0) {
    notes.push("심사 기준은 상세 설명에 그대로 들어가므로, 저장 전 한 줄 요약과 태그만 한 번 더 다듬으면 됩니다.");
  }

  return {
    fields: {
      title,
      organizer,
      shortDescription,
      description: normalizedText,
      url: canonicalSourceUrl,
      sourceUrl: canonicalSourceUrl,
      applyUrl: applyUrl || canonicalSourceUrl,
      startDate,
      deadline: endDate,
      eventDate,
      participationMode: deriveParticipationMode(normalizedText, location),
      location,
      eligibilityText: recruitingLine,
      eligibilitySegments,
      difficulty,
      teamAllowed,
      minTeamSize,
      maxTeamSize,
      language: /영문|english/.test(normalizedText.toLowerCase()) ? "English" : "Korean",
      globalParticipation,
      prizeSummary,
      submissionFormat,
      toolsAllowed,
      aiCategories,
      tags,
    },
    preview,
    notes,
  };
}

function PosterPreviewCard({
  organizer,
  title,
  shortDescription,
  deadline,
  participationMode,
  posterImageUrl,
}: {
  organizer: string;
  title: string;
  shortDescription: string;
  deadline: string;
  participationMode: ContestMode;
  posterImageUrl: string;
}) {
  const previewUrl = useDeferredValue(posterImageUrl.trim());
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const canRenderImage = /^https?:\/\//.test(previewUrl) && failedPreviewUrl !== previewUrl;

  if (canRenderImage) {
    return (
      <div className="relative overflow-hidden rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)]">
        <div className="relative aspect-[16/10] w-full">
          <Image
            key={previewUrl}
            src={previewUrl}
            alt={`${title || "공모전"} 공고 이미지 미리보기`}
            fill
            unoptimized
            sizes="(max-width: 1024px) 100vw, 720px"
            className="object-cover"
            onError={() => setFailedPreviewUrl(previewUrl)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(14,17,21,0.98),rgba(17,24,34,0.96))] p-5 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,164,216,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_54%)]" />
      <div className="relative flex aspect-[16/10] flex-col justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
            {organizer || "Organizer"}
          </div>
          <div className="mt-4 max-w-[92%] text-[1.55rem] font-semibold leading-[1.08] tracking-[-0.05em]">
            {title || "공고 이미지 미리보기"}
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-white/88">
            <div className="rounded-[18px] border border-white/10 bg-white/6 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/60">Deadline</div>
              <div className="mt-1 text-sm font-semibold">{formatDeadlineLabel(deadline || undefined)}</div>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/6 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/60">Mode</div>
              <div className="mt-1 text-sm font-semibold">{formatMode(participationMode)}</div>
            </div>
          </div>
          <p className="max-w-[92%] text-sm leading-6 text-white/80">
            {shortDescription || "공고 이미지 URL을 넣지 않으면 이 자동 포스터가 상세 페이지에 노출됩니다."}
          </p>
        </div>
      </div>
    </div>
  );
}

function QuickFillOverview({
  preview,
  notes,
}: {
  preview: QuickFillPreviewItem[];
  notes: string[];
}) {
  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-5">
      <div className="text-sm font-semibold text-[var(--foreground)]">자동 추출 결과</div>
      <div className="mt-4 space-y-3">
        {preview.map((item) => (
          <div key={item.label} className="rounded-[18px] border border-[var(--border)] bg-[var(--background-strong)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{item.label}</div>
            <div className="mt-1 text-sm leading-6 text-[var(--foreground)]">{item.value}</div>
          </div>
        ))}
      </div>
      {notes.length > 0 ? (
        <div className="mt-4 rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
          <div className="text-sm font-semibold text-[var(--foreground)]">검수 포인트</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ContestForm({
  action,
  analysisReady,
  initialData,
  mode = "create",
}: ContestFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const isEdit = mode === "edit";
  const formRef = useRef<HTMLFormElement>(null);
  const [titleValue, setTitleValue] = useState(initialData?.title ?? "");
  const [organizerValue, setOrganizerValue] = useState(initialData?.organizer ?? "");
  const [shortDescriptionValue, setShortDescriptionValue] = useState(initialData?.shortDescription ?? "");
  const [posterImageUrlValue, setPosterImageUrlValue] = useState(initialData?.posterImageUrl ?? "");
  const [deadlineValue, setDeadlineValue] = useState(toDateInputValue(initialData?.deadline));
  const [participationModeValue, setParticipationModeValue] = useState<ContestMode>(
    initialData?.participationMode ?? "online",
  );
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [extractingWithAi, setExtractingWithAi] = useState(false);
  const [quickSourceUrlValue, setQuickSourceUrlValue] = useState(initialData?.sourceUrl ?? initialData?.url ?? "");
  const [quickSourceTextValue, setQuickSourceTextValue] = useState(initialData?.description ?? "");
  const [quickFillPreview, setQuickFillPreview] = useState<QuickFillPreviewItem[]>([
    { label: "제목 후보", value: initialData?.title || "원문을 붙여 넣으면 자동으로 채워집니다." },
    { label: "마감일", value: toDateInputValue(initialData?.deadline) || "원문에서 자동 추출" },
    {
      label: "주최 성격",
      value:
        organizerTypeOptions.find((option) => option.id === initialData?.organizerType)?.label ?? "대기업 / 정부 / 재단 자동 분류",
    },
    { label: "참가 대상", value: initialData?.eligibilityText || "대학생 / 개인·팀 여부 자동 추출" },
    { label: "신청 링크", value: initialData?.applyUrl || "구글폼 / 공식 신청 링크 자동 감지" },
    {
      label: "AI 카테고리",
      value: formatCategoryLabels(initialData?.aiCategories),
    },
  ]);
  const [quickFillNotes, setQuickFillNotes] = useState<string[]>([
    "외부 플랫폼에서 가져온 공고 본문 전체를 붙여 넣으면 제목 후보, 마감일, 신청 링크, 카테고리를 우선 채웁니다.",
  ]);
  const [quickFillStatus, setQuickFillStatus] = useState<string | null>(null);

  function syncFieldValue(name: string, value: string) {
    const field = formRef.current?.elements.namedItem(name);

    if (!field || field instanceof RadioNodeList) {
      return;
    }

    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function syncBooleanValue(name: string, checked: boolean) {
    const field = formRef.current?.elements.namedItem(name);

    if (field instanceof HTMLInputElement) {
      field.value = checked ? "true" : "false";
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function syncCheckboxGroup(name: string, values: string[]) {
    const inputs = formRef.current?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`) ?? [];

    inputs.forEach((input) => {
      input.checked = values.includes(input.value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function applyQuickFill(result: QuickFillResult) {
    const { fields } = result;

    if (fields.title) {
      setTitleValue(fields.title);
    }

    if (fields.organizer) {
      setOrganizerValue(fields.organizer);
    }

    if (fields.organizerType) {
      syncFieldValue("organizerType", fields.organizerType);
    }

    if (fields.shortDescription) {
      setShortDescriptionValue(fields.shortDescription);
    }

    if (fields.description) {
      syncFieldValue("description", fields.description);
    }

    if (fields.url) {
      syncFieldValue("url", fields.url);
    }

    if (fields.sourceUrl) {
      syncFieldValue("sourceUrl", fields.sourceUrl);
    }

    if (fields.applyUrl) {
      syncFieldValue("applyUrl", fields.applyUrl);
    }

    if (fields.startDate) {
      syncFieldValue("startDate", fields.startDate);
    }

    if (fields.deadline) {
      setDeadlineValue(fields.deadline);
    }

    if (fields.eventDate) {
      syncFieldValue("eventDate", fields.eventDate);
    }

    if (fields.participationMode) {
      setParticipationModeValue(fields.participationMode);
    }

    if (fields.location) {
      syncFieldValue("location", fields.location);
    }

    if (fields.eligibilityText) {
      syncFieldValue("eligibilityText", fields.eligibilityText);
    }

    if (fields.eligibilitySegments) {
      syncFieldValue("eligibilitySegments", fields.eligibilitySegments.join(", "));
    }

    if (fields.difficulty) {
      syncFieldValue("difficulty", fields.difficulty);
    }

    if (fields.teamAllowed !== undefined) {
      syncBooleanValue("teamAllowed", fields.teamAllowed);
    }

    if (fields.globalParticipation !== undefined) {
      syncBooleanValue("globalParticipation", fields.globalParticipation);
    }

    if (fields.prizePoolKrw !== undefined) {
      syncFieldValue("prizePoolKrw", fields.prizePoolKrw === null ? "" : String(fields.prizePoolKrw));
    }

    if (fields.minTeamSize !== undefined) {
      syncFieldValue("minTeamSize", String(fields.minTeamSize));
    }

    if (fields.maxTeamSize !== undefined) {
      syncFieldValue("maxTeamSize", String(fields.maxTeamSize));
    }

    if (fields.language) {
      syncFieldValue("language", fields.language);
    }

    if (fields.prizeSummary) {
      syncFieldValue("prizeSummary", fields.prizeSummary);
    }

    if (fields.submissionFormat) {
      syncFieldValue("submissionFormat", fields.submissionFormat);
    }

    if (fields.submissionItems) {
      syncFieldValue("submissionItems", fields.submissionItems.join("\n"));
    }

    if (fields.judgingCriteria) {
      syncFieldValue(
        "judgingCriteria",
        fields.judgingCriteria.map((item) => [item.label, item.weight ?? "", item.description ?? ""].join(" | ")).join("\n"),
      );
    }

    if (fields.stageSchedule) {
      syncFieldValue(
        "stageSchedule",
        fields.stageSchedule.map((item) => [item.label, item.date ?? "", item.note ?? ""].join(" | ")).join("\n"),
      );
    }

    if (fields.pastWinners !== undefined) {
      syncFieldValue("pastWinners", fields.pastWinners ?? "");
    }

    if (fields.toolsAllowed) {
      syncFieldValue("toolsAllowed", fields.toolsAllowed.join(", "));
    }

    if (fields.datasetProvided !== undefined) {
      syncBooleanValue("datasetProvided", fields.datasetProvided ?? false);
    }

    if (fields.datasetSummary !== undefined) {
      syncFieldValue("datasetSummary", fields.datasetSummary ?? "");
    }

    if (fields.tags) {
      syncFieldValue("tags", fields.tags.join(", "));
    }

    if (fields.aiCategories) {
      syncCheckboxGroup("aiCategories", fields.aiCategories);
    }
  }

  function handleQuickFill() {
    if (!quickSourceTextValue.trim() && !quickSourceUrlValue.trim()) {
      setQuickFillStatus("원문 링크나 상세 본문 중 하나는 먼저 넣어주세요.");
      return;
    }

    const result = buildQuickFill(quickSourceTextValue, quickSourceUrlValue.trim());
    applyQuickFill(result);
    setQuickFillPreview(result.preview);
    setQuickFillNotes(result.notes);
    setQuickFillStatus("원문에서 핵심 필드를 채웠습니다. 아래 필수 검수 항목만 확인한 뒤 저장하면 됩니다.");
  }

  async function handleAiQuickFill() {
    if (!quickSourceTextValue.trim() && !quickSourceUrlValue.trim()) {
      setQuickFillStatus("원문 링크나 상세 본문 중 하나는 먼저 넣어주세요.");
      return;
    }

    setExtractingWithAi(true);
    setQuickFillStatus("OpenAI가 공고 구조를 읽고 필드를 정리하고 있습니다...");

    try {
      const response = await fetch("/api/admin/contest-extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceUrl: quickSourceUrlValue,
          rawText: quickSourceTextValue,
        }),
      });

      const payload = (await response.json()) as AiQuickFillSuccess | AiQuickFillError;

      if (!response.ok || !isAiQuickFillSuccess(payload)) {
        const errorMessage =
          "error" in payload && payload.error ? payload.error : "AI 추출에 실패했습니다. 잠시 후 다시 시도해 주세요.";
        const nextNotes = "notes" in payload && payload.notes ? payload.notes : quickFillNotes;

        setQuickFillStatus(errorMessage);
        setQuickFillNotes(nextNotes);
        setExtractingWithAi(false);
        return;
      }

      applyQuickFill(payload);
      setQuickFillPreview(payload.preview);
      setQuickFillNotes(
        payload.notes.length > 0 ? payload.notes : ["AI가 구조화 추출을 완료했습니다. 제목, 일정, 링크만 빠르게 검수하면 됩니다."],
      );
      setQuickFillStatus(
        payload.status === "pending"
          ? "OpenAI 설정이 없어 AI 추출을 실행하지 못했습니다. 기본 규칙 자동 채우기를 사용하거나 환경 변수를 확인해 주세요."
          : "OpenAI가 제목, 한 줄 소개, 일정, 상금, 주요 도구/스택, 태그까지 채웠습니다. 필수 검수 후 저장하면 됩니다.",
      );
    } catch {
      setQuickFillStatus("AI 추출 요청 중 네트워크 오류가 발생했습니다.");
    } finally {
      setExtractingWithAi(false);
    }
  }

  async function handlePosterFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingPoster(true);
    setUploadMessage(null);

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    const response = await fetch("/api/admin/poster-upload", {
      method: "POST",
      body: uploadFormData,
    });

    const payload = (await response.json()) as { publicUrl?: string; error?: string };

    if (!response.ok || !payload.publicUrl) {
      setUploadingPoster(false);
      setUploadMessage(payload.error ?? "이미지 업로드에 실패했습니다.");
      event.target.value = "";
      return;
    }

    startTransition(() => {
      setPosterImageUrlValue(payload.publicUrl ?? "");
      setUploadMessage("업로드가 완료되어 이미지 URL이 자동으로 채워졌습니다.");
      setUploadingPoster(false);
    });

    event.target.value = "";
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-8">
      <section className="surface-card rounded-[30px] p-6">
        <div className="eyebrow">빠른 등록</div>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
              외부 공고 본문을 붙여 넣고 1차 자동 채움.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              긴 공고를 읽으며 필드를 하나씩 옮기지 않아도 됩니다. 원문 링크와 상세 본문을 넣으면 마감일, 신청 링크,
              참가 조건, 상금 요약, 카테고리까지 먼저 채우고 아래에서 검수만 하면 됩니다.
            </p>
          </div>
          <div className="rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--muted)]">
            Step 1. 붙여 넣기
            <br />
            Step 2. 자동 채우기
            <br />
            Step 3. 필수 검수 후 저장
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <InputShell label="원문 링크" helper="커뮤니티 글, 공식 공고 페이지, 블로그 글 등 지금 보고 있는 공고 URL을 넣으세요.">
              <input
                className={fieldClassName}
                placeholder="https://example.com/contest/123"
                value={quickSourceUrlValue}
                onChange={(event) => setQuickSourceUrlValue(event.target.value)}
              />
            </InputShell>

            <InputShell
              label="상세 본문 붙여넣기"
              helper="`상세내용`, `공모 개요`, `시상 내역`, `심사 기준`이 포함된 전체 텍스트를 그대로 붙여 넣는 방식이 가장 잘 맞습니다."
            >
              <textarea
                className={`${fieldClassName} min-h-[280px]`}
                placeholder="외부 플랫폼에서 복사한 공고 본문 전체를 여기에 붙여 넣으세요."
                value={quickSourceTextValue}
                onChange={(event) => setQuickSourceTextValue(event.target.value)}
              />
            </InputShell>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAiQuickFill}
                disabled={!analysisReady || extractingWithAi}
                className="primary-button disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!analysisReady ? "OpenAI 설정 필요" : extractingWithAi ? "AI 추출 중..." : "AI로 전체 필드 채우기"}
              </button>
              <button type="button" onClick={handleQuickFill} className="secondary-button">
                기본 규칙으로 빠르게 채우기
              </button>
              <div className="rounded-full border border-[var(--border)] bg-[var(--background-strong)] px-4 py-2 text-xs font-semibold text-[var(--muted)]">
                AI 추출은 링크 + 본문 조합일 때 가장 정확합니다.
              </div>
            </div>

            {quickFillStatus ? (
              <div className="rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm leading-6 text-[var(--foreground)]">
                {quickFillStatus}
              </div>
            ) : null}
          </div>

          <QuickFillOverview preview={quickFillPreview} notes={quickFillNotes} />
        </div>
      </section>

      <section className="surface-card rounded-[30px] p-6">
        <div className="eyebrow">필수 검수</div>
        {isEdit ? (
          <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--muted)]">
            현재 슬러그: <span className="font-semibold text-[var(--foreground)]">{initialData?.slug}</span>
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <InputShell label="대회명" required helper="자동 생성된 제목 후보가 들어와도, 공개 화면에 바로 보이므로 한 번 더 다듬는 편이 좋습니다.">
            <input
              name="title"
              className={fieldClassName}
              placeholder="예: 2026 Campus AI Challenge"
              value={titleValue}
              onChange={(event) => setTitleValue(event.target.value)}
              required
            />
          </InputShell>
          <InputShell label="주최 기관" required>
            <input
              name="organizer"
              className={fieldClassName}
              placeholder="예: 네이버 커넥트재단"
              value={organizerValue}
              onChange={(event) => setOrganizerValue(event.target.value)}
              required
            />
          </InputShell>
          <InputShell label="주최 성격" helper="대기업, 정부·공공기관, 재단 여부가 탐색 필터와 신뢰도 판단에 바로 쓰입니다.">
            <select
              name="organizerType"
              className={fieldClassName}
              defaultValue={initialData?.organizerType ?? ""}
            >
              <option value="">자동 / 미정</option>
              {organizerTypeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </InputShell>
          <div className="md:col-span-2">
            <InputShell label="한 줄 요약" helper="대회 카드에서 먼저 보이는 문장입니다. 60~80자 정도가 가장 깔끔합니다.">
              <input
                name="shortDescription"
                className={fieldClassName}
                placeholder="카드에서 먼저 보일 짧은 소개"
                value={shortDescriptionValue}
                onChange={(event) => setShortDescriptionValue(event.target.value)}
              />
            </InputShell>
          </div>
          <div className="md:col-span-2">
            <InputShell label="상세 설명" required helper="원문 붙여넣기 결과가 들어오므로, 너무 길면 첫 문단만 다듬고 저장해도 충분합니다.">
              <textarea
                name="description"
                className={`${fieldClassName} min-h-40`}
                placeholder="대회 개요, 문제, 제출 형식, 평가 포인트를 붙여 넣으세요."
                defaultValue={initialData?.description ?? ""}
                required
              />
            </InputShell>
          </div>
          <InputShell label="원문 링크" required helper="공개 상세 페이지의 `대회 원문 보기` 버튼으로 연결됩니다.">
            <input name="url" type="url" className={fieldClassName} placeholder="https://..." defaultValue={initialData?.url ?? ""} required />
          </InputShell>
          <InputShell label="신청 링크" helper="구글폼 / Devpost / 공식 신청 페이지 링크를 넣습니다. 비우면 원문 링크를 신청 링크로 사용합니다.">
            <input
              name="applyUrl"
              type="url"
              className={fieldClassName}
              placeholder="https://..."
              defaultValue={initialData?.applyUrl ?? ""}
            />
          </InputShell>
          <InputShell label="마감일" required helper="본문에 시간이 함께 있어도 현재는 날짜까지만 저장합니다.">
            <input
              name="deadline"
              type="date"
              className={fieldClassName}
              value={deadlineValue}
              onChange={(event) => setDeadlineValue(event.target.value)}
              required
            />
          </InputShell>
          <InputShell label="참가 방식">
            <select
              name="participationMode"
              className={fieldClassName}
              value={participationModeValue}
              onChange={(event) => setParticipationModeValue(event.target.value as ContestMode)}
            >
              <option value="online">온라인</option>
              <option value="offline">오프라인</option>
              <option value="hybrid">하이브리드</option>
            </select>
          </InputShell>
          <InputShell label="상태">
            <select name="status" className={fieldClassName} defaultValue={initialData?.status ?? "published"}>
              <option value="published">공개</option>
              <option value="draft">초안</option>
              <option value="archived">보관</option>
            </select>
          </InputShell>
          <InputShell label="총상금 (원)" helper="현물·장학금형이면 비워두고 상금 요약만 정리해도 됩니다.">
            <input
              name="prizePoolKrw"
              type="number"
              min="0"
              step="1000"
              className={fieldClassName}
              placeholder="10000000"
              defaultValue={initialData?.prizePoolKrw ?? ""}
            />
          </InputShell>
          <InputShell label="상금 요약">
            <input
              name="prizeSummary"
              className={fieldClassName}
              placeholder="예: 장학금 300만원 / 해외 행사 참가"
              defaultValue={initialData?.prizeSummary ?? ""}
            />
          </InputShell>
          <div className="md:col-span-2">
            <InputShell label="제출 형식">
              <input
                name="submissionFormat"
                className={fieldClassName}
                placeholder="예: MP4, 30초 미만, 16:9, 제출 링크"
                defaultValue={initialData?.submissionFormat ?? ""}
              />
            </InputShell>
          </div>
          <div className="md:col-span-2">
            <InputShell
              label="접수 항목 / 준비 서류"
              helper="한 줄에 하나씩 적습니다. 예: 참가 신청서, 재학증명서, 유튜브 링크, 기획서 PDF"
            >
              <textarea
                name="submissionItems"
                className={`${fieldClassName} min-h-32`}
                placeholder={"참가 신청서\n재학증명서\n작품 링크"}
                defaultValue={joinSubmissionItems(initialData?.submissionItems)}
              />
            </InputShell>
          </div>
          <div className="md:col-span-2">
            <InputShell
              label="심사 기준"
              helper="한 줄에 `항목 | 비중 | 설명` 형식으로 적습니다. 예: 창의성 | 20 | 아이디어 차별성"
            >
              <textarea
                name="judgingCriteria"
                className={`${fieldClassName} min-h-32`}
                placeholder={"주제 적합성 | 20 | 공모 주제와의 연결성\n창의성 | 20 | 아이디어 차별성"}
                defaultValue={joinJudgingCriteria(initialData?.judgingCriteria)}
              />
            </InputShell>
          </div>
          <div className="md:col-span-2">
            <InputShell
              label="단계별 일정"
              helper="한 줄에 `라벨 | 날짜 | 메모` 형식으로 적습니다. 예: 접수 마감 | 2026-04-03 | 10:00까지"
            >
              <textarea
                name="stageSchedule"
                className={`${fieldClassName} min-h-32`}
                placeholder={"접수 시작 | 2026-03-03 |\n접수 마감 | 2026-04-03 | 10:00까지\n수상자 발표 | 2026-04-10 | 개별 안내"}
                defaultValue={joinStageSchedule(initialData?.stageSchedule)}
              />
            </InputShell>
          </div>
          <div className="md:col-span-2">
            <InputShell label="과거 수상작 / 이전 우승자 정보">
              <textarea
                name="pastWinners"
                className={`${fieldClassName} min-h-28`}
                placeholder="공고에 과거 수상작 링크나 우승 사례가 있으면 간단히 정리합니다."
                defaultValue={initialData?.pastWinners ?? ""}
              />
            </InputShell>
          </div>
          <div className="md:col-span-2">
            <InputShell label="주요 도구 / 스택" helper="공고 본문에서 요구되거나 잘 맞는 도구를 자동으로 제안합니다.">
              <input
                name="toolsAllowed"
                className={fieldClassName}
                placeholder="생성형 AI, 영상 생성 AI, PyTorch"
                defaultValue={joinList(initialData?.toolsAllowed)}
              />
            </InputShell>
          </div>
        </div>

        <div className="mt-6 rounded-[22px] border border-[var(--border)] bg-[var(--background-strong)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
          참가 조건, 팀 구성, 난이도, 데이터셋, 수집 소스 정보는 자동 추출값을 그대로 저장합니다.
          위에 보이는 항목만 확인해도 지원 판단용 상세 페이지를 꽤 촘촘하게 채울 수 있습니다.
        </div>

        <div className="mt-6">
          <div className="text-sm font-semibold text-[var(--foreground)]">AI 카테고리</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            빠른 등록이 추천한 카테고리를 기본으로 넣어줍니다. 공개 탐색과 배지 노출에 바로 쓰이므로 최소 1개는 남겨두세요.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {contestCategoryOptions.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-3 rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)]"
              >
                <input
                  type="checkbox"
                  name="aiCategories"
                  value={category.id}
                  defaultChecked={initialData?.aiCategories.includes(category.id) ?? false}
                  className="h-4 w-4"
                />
                {category.label}
              </label>
            ))}
          </div>
        </div>

        <input type="hidden" name="sourceUrl" defaultValue={initialData?.sourceUrl ?? ""} />
        <input type="hidden" name="startDate" defaultValue={toDateInputValue(initialData?.startDate)} />
        <input type="hidden" name="eventDate" defaultValue={toDateInputValue(initialData?.eventDate)} />
        <input type="hidden" name="location" defaultValue={initialData?.location ?? ""} />
        <input type="hidden" name="eligibilityText" defaultValue={initialData?.eligibilityText ?? ""} />
        <input type="hidden" name="eligibilitySegments" defaultValue={joinList(initialData?.eligibilitySegments)} />
        <input type="hidden" name="difficulty" defaultValue={initialData?.difficulty ?? "intermediate"} />
        <input type="hidden" name="language" defaultValue={initialData?.language ?? "Korean"} />
        <input type="hidden" name="teamAllowed" defaultValue={(initialData?.teamAllowed ?? true) ? "true" : "false"} />
        <input
          type="hidden"
          name="globalParticipation"
          defaultValue={(initialData?.globalParticipation ?? false) ? "true" : "false"}
        />
        <input type="hidden" name="minTeamSize" defaultValue={String(initialData?.minTeamSize ?? 1)} />
        <input type="hidden" name="maxTeamSize" defaultValue={String(initialData?.maxTeamSize ?? 4)} />
        <input type="hidden" name="tags" defaultValue={joinList(initialData?.tags)} />
        <input
          type="hidden"
          name="datasetProvided"
          defaultValue={(initialData?.datasetProvided ?? false) ? "true" : "false"}
        />
        <input type="hidden" name="datasetSummary" defaultValue={initialData?.datasetSummary ?? ""} />
      </section>

      <section className="surface-card rounded-[30px] p-6">
        <div className="eyebrow">선택 정보</div>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">포스터와 상세 미리보기</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              공개 상세 페이지 상단에 보일 공고 이미지와 카드형 포스터만 마지막으로 확인하면 됩니다.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <InputShell label="공고 이미지 URL">
              <input
                name="posterImageUrl"
                type="url"
                className={fieldClassName}
                placeholder="https://..."
                value={posterImageUrlValue}
                onChange={(event) => setPosterImageUrlValue(event.target.value)}
              />
            </InputShell>

            <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">이미지 파일 업로드</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
                    className={fieldClassName}
                    onChange={handlePosterFileChange}
                    disabled={uploadingPoster}
                  />
                </label>
                <div className="rounded-[18px] border border-[var(--border)] bg-[var(--background-strong)] px-4 py-3 text-sm text-[var(--muted)]">
                  {uploadingPoster ? "업로드 중..." : "최대 5MB · PNG/JPG/WebP/GIF/SVG/AVIF"}
                </div>
              </div>
              {uploadMessage ? (
                <div className="mt-3 rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)]">
                  {uploadMessage}
                </div>
              ) : null}
            </div>

            <div className="rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm leading-6 text-[var(--muted)]">
              {analysisReady
                ? "OPENAI_API_KEY가 설정되어 있어 저장 시 GPT 분석이 함께 생성됩니다. 실패하거나 pending인 대회는 관리자 화면에서 재실행할 수 있습니다."
                : "현재는 OPENAI_API_KEY가 없어 대회 저장만 되고, 분석 상태는 pending으로 생성됩니다. 키를 넣으면 같은 구조로 자동 분석까지 바로 붙습니다."}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">상세 페이지 포스터 미리보기</div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              입력한 공고 이미지는 상세 페이지 `참가 액션` 카드 상단에 노출됩니다. 비워두면 자동 생성 포스터를 사용합니다.
            </p>
            <div className="mt-4">
              <PosterPreviewCard
                organizer={organizerValue}
                title={titleValue}
                shortDescription={shortDescriptionValue}
                deadline={deadlineValue}
                participationMode={participationModeValue}
                posterImageUrl={posterImageUrlValue}
              />
            </div>
          </div>
        </div>
      </section>

      {state.status === "error" ? (
        <div className="rounded-[24px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] p-4 text-sm text-[var(--danger)]">
          <div className="font-semibold">{state.message}</div>
          {state.issues?.length ? (
            <ul className="mt-3 space-y-1">
              {state.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {state.status === "success" ? (
        <div className="rounded-[24px] border border-[rgba(24,116,94,0.16)] bg-[rgba(24,116,94,0.08)] p-4 text-sm text-[var(--success)]">
          <div className="font-semibold">{state.message}</div>
          {state.createdSlug ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href={`/contests/${state.createdSlug}`} className="secondary-button">
                공개 상세 보기
              </Link>
              <Link href={`/admin/contests/${state.createdSlug}`} className="secondary-button">
                관리자 편집 보기
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className="primary-button disabled:opacity-50">
          {isPending ? "저장 중..." : isEdit ? "대회 정보 저장하기" : "대회 저장하기"}
        </button>
        <p className="text-sm text-[var(--muted)]">
          {isEdit
            ? "수정 시 대회 정보와 분석 결과를 함께 갱신합니다."
            : "저장과 동시에 badge refresh, analysis row 생성까지 처리합니다."}
        </p>
      </div>
    </form>
  );
}
