export const contestBadgeOptions = [
  { id: "deadline_urgent", label: "🔥 마감 임박", description: "7일 이내 마감되는 대회" },
  { id: "high_prize", label: "🏆 상금 높음", description: "상금 규모가 큰 대회" },
  { id: "student_friendly", label: "🎓 대학생 추천", description: "학생 참여와 학습 성격이 강한 대회" },
  { id: "global", label: "🌍 글로벌", description: "국가 제한이 적고 영어 중심인 대회" },
  { id: "trending_ai", label: "🧪 AI 트렌드", description: "LLM, Agent, Multimodal 흐름과 맞닿은 대회" },
  { id: "developer_friendly", label: "🧑‍💻 개발자 추천", description: "실제 구현과 데모 제출이 핵심인 대회" },
  { id: "beginner_friendly", label: "🪶 초보자 추천", description: "API 기반 MVP로도 접근 가능한 대회" },
] as const;

export const contestCategoryOptions = [
  { id: "llm-agents", label: "LLM / 에이전트" },
  { id: "generative-ai", label: "생성형 AI" },
  { id: "computer-vision", label: "컴퓨터 비전" },
  { id: "data-science", label: "데이터 사이언스" },
  { id: "multimodal-ai", label: "멀티모달 AI" },
  { id: "robotics", label: "로보틱스" },
  { id: "ai-for-social-good", label: "사회문제 해결 AI" },
  { id: "ai-infra-systems", label: "AI 인프라 / 시스템" },
] as const;

export const difficultyOptions = [
  { id: "beginner", label: "입문" },
  { id: "intermediate", label: "중급" },
  { id: "advanced", label: "상급" },
] as const;

export const organizerTypeOptions = [
  { id: "enterprise", label: "대기업" },
  { id: "government", label: "정부·공공기관" },
  { id: "foundation", label: "유명 재단" },
  { id: "university", label: "대학교" },
  { id: "startup", label: "스타트업" },
  { id: "community", label: "커뮤니티" },
] as const;

export const contestSortOptions = [
  { id: "deadline", label: "마감임박순" },
  { id: "prize", label: "상금순" },
  { id: "popular", label: "인기순" },
] as const;

export const contestTeamFilterOptions = [
  { id: "individual", label: "개인전" },
  { id: "team", label: "팀전" },
] as const;

export const contestTrackingStatusOptions = [
  { id: "saved", label: "Saved" },
  { id: "planning", label: "Planning" },
  { id: "applied", label: "Applied" },
] as const;

export const contestIdeationStatusOptions = [
  { id: "draft", label: "Draft" },
  { id: "selected", label: "Selected" },
  { id: "archived", label: "Archived" },
] as const;

export const contestIdeationStageOptions = [
  { id: "strategy", label: "전략 분석" },
  { id: "why", label: "방향 잡기" },
  { id: "how", label: "추천 방향" },
  { id: "what", label: "아이디어 뽑기" },
  { id: "matrix", label: "최종 선택" },
  { id: "selected", label: "아이디어 확정" },
] as const;

export const contestDecisionMatrixPresetOptions = [
  { id: "balanced", label: "균형형" },
  { id: "impact", label: "임팩트형" },
  { id: "deadline", label: "마감압박형" },
] as const;

export type ContestBadge = (typeof contestBadgeOptions)[number]["id"];
export type ContestCategory = (typeof contestCategoryOptions)[number]["id"];
export type ContestDifficulty = (typeof difficultyOptions)[number]["id"];
export type ContestOrganizerType = (typeof organizerTypeOptions)[number]["id"];
export type ContestSortOption = (typeof contestSortOptions)[number]["id"];
export type ContestTeamFilter = (typeof contestTeamFilterOptions)[number]["id"];
export type ContestTrackingStatus = (typeof contestTrackingStatusOptions)[number]["id"];
export type ContestIdeationStatus = (typeof contestIdeationStatusOptions)[number]["id"];
export type ContestIdeationStage = (typeof contestIdeationStageOptions)[number]["id"];
export type ContestDecisionMatrixPreset = (typeof contestDecisionMatrixPresetOptions)[number]["id"];
export type ContestMode = "online" | "offline" | "hybrid";
export type ContestStatus = "draft" | "published" | "archived";
export type ContestAnalysisStatus = "pending" | "completed" | "failed";

export type ContestBadgeMeta = (typeof contestBadgeOptions)[number];
export type ContestCategoryMeta = (typeof contestCategoryOptions)[number];
export type ContestOrganizerTypeMeta = (typeof organizerTypeOptions)[number];
export type ContestTrackingStatusMeta = (typeof contestTrackingStatusOptions)[number];

export interface ContestStage {
  label: string;
  date?: string | null;
  note?: string | null;
}

export interface ContestJudgingCriterion {
  label: string;
  weight?: number | null;
  description?: string | null;
}

export interface ContestAnalysis {
  summary: string;
  recommendReason: string;
  winStrategy: string;
  difficultyAnalysis: string;
  judgingFocus: string;
  promptVersion?: string;
  modelName?: string;
  analysisStatus: ContestAnalysisStatus;
}

export interface Contest {
  id: string;
  slug: string;
  title: string;
  organizer: string;
  organizerType?: ContestOrganizerType;
  shortDescription: string;
  description: string;
  url: string;
  sourceUrl?: string;
  posterImageUrl?: string;
  applyUrl?: string;
  startDate?: string;
  deadline?: string;
  eventDate?: string;
  participationMode: ContestMode;
  location?: string;
  eligibilityText: string;
  eligibilitySegments: string[];
  difficulty: ContestDifficulty;
  teamAllowed: boolean;
  minTeamSize: number;
  maxTeamSize: number;
  language: string;
  globalParticipation: boolean;
  prizePoolKrw?: number;
  prizeSummary?: string;
  submissionFormat?: string;
  submissionItems?: string[];
  judgingCriteria?: ContestJudgingCriterion[];
  stageSchedule?: ContestStage[];
  pastWinners?: string;
  toolsAllowed: string[];
  datasetProvided: boolean;
  datasetSummary?: string;
  aiCategories: ContestCategory[];
  tags: string[];
  badges: ContestBadge[];
  viewCount?: number;
  applyCount?: number;
  status: ContestStatus;
  analysis: ContestAnalysis;
}

export interface ContestTrackingState {
  status: ContestTrackingStatus | null;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  updatedAt?: string;
}

export interface ContestStrategyIdea {
  title: string;
  concept: string;
  winningEdge: string;
  executionFocus: string;
}

export interface ContestResearchPoint {
  title: string;
  insight: string;
  action: string;
}

export interface ContestDraftSection {
  title: string;
  body: string;
}

export interface ContestStrategyCitation {
  label: string;
  title: string;
  url?: string | null;
  snippet: string;
  sourceType: string;
  searchQuery?: string | null;
  rankingScore?: number;
  citationScore?: number;
  selectedForCitation?: boolean;
}

export interface ContestStrategyLabResult {
  overview: string;
  recommendedDirection: string;
  ideas: ContestStrategyIdea[];
  researchPoints: ContestResearchPoint[];
  draftTitle: string;
  draftSubtitle: string;
  draftSections: ContestDraftSection[];
  citations: ContestStrategyCitation[];
  promptVersion?: string | null;
  modelName?: string | null;
  status: ContestAnalysisStatus;
}

export interface ContestDecisionMatrixWeights {
  impact: number;
  feasibility: number;
  alignment: number;
  speed: number;
}

export interface ContestDecisionMatrixScore {
  impact: number;
  feasibility: number;
  alignment: number;
  speed: number;
  total: number;
  reason: string;
}

export interface ContestWhyOption {
  id: string;
  title: string;
  body: string;
  source: "ai" | "user";
  isSelected: boolean;
  displayOrder: number;
}

export interface ContestHowHypothesis {
  id: string;
  title: string;
  body: string;
  impactTarget: string;
  judgeAppeal: string;
  measurableOutcome: string;
  source: "ai" | "user";
  isSelected: boolean;
  displayOrder: number;
}

export interface ContestIdeaCandidate {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  fitReason: string;
  source: "ai" | "user";
  voteState: "liked" | "skipped" | "neutral";
  isSelected: boolean;
  matrixScores?: ContestDecisionMatrixScore;
  displayOrder: number;
}

export interface ContestDecisionMatrixRow extends ContestIdeaCandidate {
  matrixScores: ContestDecisionMatrixScore;
}

export interface ContestIdeationProgress {
  strategy: number;
  ideation: number;
  team: number;
}

export interface ContestIdeationSession {
  id: string;
  contestId: string;
  userId: string;
  status: ContestIdeationStatus;
  currentStage: ContestIdeationStage;
  strategyReviewedAt?: string | null;
  selectedWhy?: string | null;
  selectedHow?: string | null;
  whyEditedText?: string | null;
  howEditedText?: string | null;
  userIdeaSeed?: string | null;
  selectedIdeaId?: string | null;
  selectedMatrixPreset?: ContestDecisionMatrixPreset | null;
  recommendedMatrixPreset: ContestDecisionMatrixPreset;
  matrixWeights: ContestDecisionMatrixWeights;
  progress: ContestIdeationProgress;
  whyOptions: ContestWhyOption[];
  selectedWhyId?: string | null;
  howHypotheses: ContestHowHypothesis[];
  selectedHowId?: string | null;
  ideaCandidates: ContestIdeaCandidate[];
  matrixRows: ContestDecisionMatrixRow[];
  topRecommendations: ContestDecisionMatrixRow[];
  matrixSummary?: string | null;
  updatedAt?: string | null;
}

export interface ContestTeamHandoff {
  contestId: string;
  sessionId: string;
  why: string;
  how: string;
  ideaTitle: string;
  ideaDescription: string;
  matrixSummary: string;
  nextStep: string;
}

export interface ContestFilters {
  query?: string;
  category?: ContestCategory;
  badge?: ContestBadge;
  difficulty?: ContestDifficulty;
  organizerType?: ContestOrganizerType;
  teamType?: ContestTeamFilter;
  sort?: ContestSortOption;
}

export function isContestCategory(value?: string): value is ContestCategory {
  return contestCategoryOptions.some((option) => option.id === value);
}

export function isContestBadge(value?: string): value is ContestBadge {
  return contestBadgeOptions.some((option) => option.id === value);
}

export function isContestDifficulty(value?: string): value is ContestDifficulty {
  return difficultyOptions.some((option) => option.id === value);
}

export function isContestOrganizerType(value?: string): value is ContestOrganizerType {
  return organizerTypeOptions.some((option) => option.id === value);
}

export function isContestSortOption(value?: string): value is ContestSortOption {
  return contestSortOptions.some((option) => option.id === value);
}

export function isContestTeamFilter(value?: string): value is ContestTeamFilter {
  return contestTeamFilterOptions.some((option) => option.id === value);
}

export function getBadgeMeta(badge: ContestBadge): ContestBadgeMeta {
  const badgeMeta = contestBadgeOptions.find((option) => option.id === badge);
  if (!badgeMeta) {
    throw new Error(`Unknown badge: ${badge}`);
  }

  return badgeMeta;
}

export function getCategoryMeta(category: ContestCategory): ContestCategoryMeta {
  const categoryMeta = contestCategoryOptions.find((option) => option.id === category);
  if (!categoryMeta) {
    throw new Error(`Unknown category: ${category}`);
  }

  return categoryMeta;
}

export function getOrganizerTypeMeta(organizerType: ContestOrganizerType): ContestOrganizerTypeMeta {
  const organizerTypeMeta = organizerTypeOptions.find((option) => option.id === organizerType);
  if (!organizerTypeMeta) {
    throw new Error(`Unknown organizer type: ${organizerType}`);
  }

  return organizerTypeMeta;
}

export function isContestTrackingStatus(value?: string): value is ContestTrackingStatus {
  return contestTrackingStatusOptions.some((option) => option.id === value);
}

export function getContestTrackingStatusMeta(status: ContestTrackingStatus): ContestTrackingStatusMeta {
  const statusMeta = contestTrackingStatusOptions.find((option) => option.id === status);

  if (!statusMeta) {
    throw new Error(`Unknown tracking status: ${status}`);
  }

  return statusMeta;
}
