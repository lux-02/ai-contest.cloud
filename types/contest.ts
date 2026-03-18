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

export const teamSessionStatusOptions = [
  { id: "draft", label: "준비 중" },
  { id: "active", label: "진행 중" },
  { id: "completed", label: "완료" },
  { id: "archived", label: "보관됨" },
] as const;

export const teamMemberStatusOptions = [
  { id: "online", label: "온라인" },
  { id: "working", label: "작업 중" },
  { id: "resting", label: "정리 중" },
] as const;

export const teamMessageKindOptions = [
  { id: "chat", label: "대화" },
  { id: "summary", label: "요약" },
  { id: "task_update", label: "태스크" },
  { id: "artifact_update", label: "작업물" },
] as const;

export const teamTaskStatusOptions = [
  { id: "todo", label: "해야 할 일" },
  { id: "in_progress", label: "진행 중" },
  { id: "done", label: "완료" },
] as const;

export const teamTaskPriorityOptions = [
  { id: "low", label: "낮음" },
  { id: "medium", label: "보통" },
  { id: "high", label: "높음" },
] as const;

export const teamArtifactTypeOptions = [
  { id: "brief", label: "기획서 초안" },
  { id: "pitch", label: "발표 구조" },
  { id: "checklist", label: "체크리스트" },
  { id: "prototype-note", label: "프로토타입 메모" },
  { id: "judging-note", label: "심사 포인트 대응 메모" },
] as const;

export const teamArtifactStatusOptions = [
  { id: "draft", label: "초안" },
  { id: "ready", label: "준비 완료" },
] as const;

export const teamActivityEventStateOptions = [
  { id: "running", label: "진행 중" },
  { id: "completed", label: "완료" },
  { id: "failed", label: "실패" },
] as const;

export const teamRegenerateModeOptions = [
  { id: "single", label: "한 명 바꾸기" },
  { id: "all", label: "전부 새로 짜기" },
  { id: "claim", label: "이 역할은 내가 할게" },
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
export type TeamSessionStatus = (typeof teamSessionStatusOptions)[number]["id"];
export type TeamMemberStatus = (typeof teamMemberStatusOptions)[number]["id"];
export type TeamMessageKind = (typeof teamMessageKindOptions)[number]["id"];
export type TeamTaskStatus = (typeof teamTaskStatusOptions)[number]["id"];
export type TeamTaskPriority = (typeof teamTaskPriorityOptions)[number]["id"];
export type TeamArtifactType = (typeof teamArtifactTypeOptions)[number]["id"];
export type TeamArtifactStatus = (typeof teamArtifactStatusOptions)[number]["id"];
export type TeamActivityEventState = (typeof teamActivityEventStateOptions)[number]["id"];
export type TeamRegenerateMode = (typeof teamRegenerateModeOptions)[number]["id"];
export type ContestMode = "online" | "offline" | "hybrid";
export type ContestStatus = "draft" | "published" | "archived";
export type ContestAnalysisStatus = "pending" | "completed" | "failed";
export type ContestTrustSourceKind = "database" | "mock";
export type ContestTrustFreshnessStatus = "fresh" | "stale" | "unknown";
export type ContestTrustCompletenessStatus = "complete" | "partial" | "sparse";

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

export interface ContestTrustSourceInfo {
  kind: ContestTrustSourceKind;
  label: string;
  url?: string | null;
  note?: string | null;
}

export interface ContestTrustUpdateInfo {
  fetchedAt: string;
  updatedAt?: string | null;
}

export interface ContestTrustFreshnessInfo {
  status: ContestTrustFreshnessStatus;
  label: string;
  ageInDays?: number | null;
  warning?: string | null;
}

export interface ContestTrustCompletenessInfo {
  status: ContestTrustCompletenessStatus;
  warnings: string[];
}

export interface ContestTrustMetadata {
  source: ContestTrustSourceInfo;
  update: ContestTrustUpdateInfo;
  freshness: ContestTrustFreshnessInfo;
  completeness: ContestTrustCompletenessInfo;
  warnings: string[];
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
  provenance?: ContestTrustMetadata;
}

export interface ContestTrackingState {
  status: ContestTrackingStatus | null;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  lastReminderSentAt?: string;
  updatedAt?: string;
}

export type ContestStrengthConfidence = "starter" | "growing" | "strong";
export type ContestTeamPreference = "team" | "individual" | "mixed";

export interface ContestStrengthProfile {
  sourceContestCount: number;
  deepSignalCount: number;
  confidence: ContestStrengthConfidence;
  topCategories: ContestCategory[];
  preferredDifficulty?: ContestDifficulty | null;
  preferredOrganizerType?: ContestOrganizerType | null;
  teamPreference: ContestTeamPreference;
  executionReadiness: number;
  summary: string;
}

export interface ContestRecommendation {
  contest: Contest;
  score: number;
  fitLabel: string;
  reasons: string[];
  matchedCategories: ContestCategory[];
}

export interface ContestRecommendationSnapshot {
  profile: ContestStrengthProfile | null;
  recommendations: ContestRecommendation[];
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

export type ContestSubmissionChecklistState = "ready" | "todo" | "warning";

export interface ContestSubmissionChecklistItem {
  label: string;
  state: ContestSubmissionChecklistState;
  note: string;
}

export interface ContestSubmissionPackage {
  title: string;
  subtitle: string;
  overview: string;
  proposalTitle: string;
  proposalSubtitle: string;
  proposalSections: ContestDraftSection[];
  pitchOutline: string[];
  demoScenario: string[];
  checklist: ContestSubmissionChecklistItem[];
  markdown: string;
}

export type ContestWorkspaceReviewFocus = "strategy" | "ideation" | "team" | "submission";

export interface ContestWorkspaceReviewNote {
  id: string;
  reviewerLabel: string;
  reviewerRole?: string | null;
  focusArea: ContestWorkspaceReviewFocus;
  note: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ContestWorkspaceShareLink {
  id: string;
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
  shareToken: string;
  shareUrl: string;
  createdAt: string;
  updatedAt?: string;
  revokedAt?: string | null;
}

export type ContestWorkspaceAccessRole = "owner" | "member" | "reviewer";
export type ContestWorkspaceInviteStatus = "pending" | "accepted" | "revoked";
export type ContestWorkspaceInviteDeliveryStatus = "sent" | "failed" | "skipped";

export interface ContestWorkspaceAccess {
  viewerUserId: string;
  ownerUserId: string;
  role: ContestWorkspaceAccessRole;
  canManage: boolean;
  canComment: boolean;
  canExport: boolean;
  canUseTeamDashboard: boolean;
  canEditTeam: boolean;
}

export interface ContestWorkspaceCollaborator {
  id: string;
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
  memberUserId: string;
  memberEmail?: string | null;
  role: ContestWorkspaceAccessRole;
  createdAt: string;
  updatedAt?: string;
}

export interface ContestWorkspaceInvite {
  id: string;
  contestId: string;
  ideationSessionId: string;
  ownerUserId: string;
  inviteeEmail: string;
  role: ContestWorkspaceAccessRole;
  inviteToken: string;
  inviteUrl: string;
  status: ContestWorkspaceInviteStatus;
  createdAt: string;
  updatedAt?: string;
  acceptedAt?: string | null;
  acceptedByUserId?: string | null;
}

export interface ContestWorkspaceInviteDelivery {
  id: string;
  inviteId: string;
  ownerUserId: string;
  inviteeEmail: string;
  provider: string;
  providerMessageId?: string | null;
  status: ContestWorkspaceInviteDeliveryStatus;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ContestWorkspaceCollaboratorNotificationDelivery {
  id: string;
  inviteId: string;
  ownerUserId: string;
  contestId: string;
  collaboratorUserId: string;
  collaboratorEmail: string;
  provider: string;
  providerMessageId?: string | null;
  status: ContestWorkspaceInviteDeliveryStatus;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type StrategyLabJobStatus = "queued" | "running" | "completed" | "failed";

export interface StrategyLabJobSnapshot {
  id: string;
  status: StrategyLabJobStatus;
  progressLabel?: string | null;
  errorMessage?: string | null;
  result?: ContestStrategyLabResult | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface StrategyLabJobResponse {
  job?: StrategyLabJobSnapshot | null;
  result?: ContestStrategyLabResult | null;
}

export type ContestIdeationJobKind = "dream_to_ideas" | "ideas_to_final" | "matrix_refresh";

export interface ContestIdeationJobSnapshot {
  id: string;
  kind: ContestIdeationJobKind;
  status: StrategyLabJobStatus;
  progressLabel?: string | null;
  errorMessage?: string | null;
  session?: ContestIdeationSession | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface ContestIdeationJobResponse {
  job?: ContestIdeationJobSnapshot | null;
  session?: ContestIdeationSession | null;
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

export interface TeamKickoffOption {
  id: string;
  label: string;
  description: string;
}

export interface TeamMember {
  id: string;
  memberKey: string;
  name: string;
  role: string;
  englishRole?: string | null;
  personality: string;
  mainContribution: string;
  skills: string[];
  introLine: string;
  status: TeamMemberStatus;
  avatarSeed: string;
  isUserClaimed: boolean;
  isActive: boolean;
  isHuman?: boolean;
  sortOrder: number;
}

export interface TeamMessage {
  id: string;
  authorType: "user" | "ai" | "system";
  authorUserId?: string | null;
  memberId?: string | null;
  speakerName: string;
  speakerRole?: string | null;
  body: string;
  messageKind: TeamMessageKind;
  createdAt: string;
}

export interface TeamTask {
  id: string;
  title: string;
  description: string;
  status: TeamTaskStatus;
  priority: TeamTaskPriority;
  assigneeMemberId?: string | null;
  assigneeLabel?: string | null;
  origin: "bootstrap" | "chat" | "manual";
  readinessDelta: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamArtifact {
  id: string;
  artifactType: TeamArtifactType;
  title: string;
  summary: string;
  body: string;
  status: TeamArtifactStatus;
  sourceTaskId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamScoreEvent {
  id: string;
  label: string;
  delta: number;
  createdAt: string;
}

export interface TeamActivityEvent {
  id: string;
  sequence: number;
  title: string;
  detail?: string | null;
  state: TeamActivityEventState;
  source: "system" | "ai" | "user";
  actorMemberId?: string | null;
  actorLabel?: string | null;
  actorRole?: string | null;
  createdAt: string;
}

export interface TeamMilestone {
  id: string;
  label: string;
  done: boolean;
}

export interface TeamSession {
  id: string;
  contestId: string;
  ideationSessionId: string;
  userId: string;
  status: TeamSessionStatus;
  teamName: string;
  teamIntro: string;
  readinessScore: number;
  currentFocus?: string | null;
  kickoffChoice?: string | null;
  claimedRoleIds: string[];
  kickoffOptions: TeamKickoffOption[];
  completionSummary?: string;
  milestones?: TeamMilestone[];
  members: TeamMember[];
  messages: TeamMessage[];
  tasks: TeamTask[];
  artifacts: TeamArtifact[];
  scoreEvents: TeamScoreEvent[];
  activityEvents: TeamActivityEvent[];
  updatedAt: string;
}

export interface TeamBootstrapResponse {
  teamSession: TeamSession;
  handoff: ContestTeamHandoff;
  kickoffOptions: TeamKickoffOption[];
  coachSummary?: string | null;
  justBootstrapped?: boolean;
}

export type TeamAsyncJobKind = "bootstrap" | "turn";

export interface TeamAsyncJobSnapshot {
  id: string;
  kind: TeamAsyncJobKind;
  status: StrategyLabJobStatus;
  progressLabel?: string | null;
  errorMessage?: string | null;
  snapshot?: TeamBootstrapResponse | TeamSimulationTurnResponse | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface TeamAsyncJobResponse {
  job?: TeamAsyncJobSnapshot | null;
  snapshot?: TeamBootstrapResponse | TeamSimulationTurnResponse | null;
}

export interface TeamSimulationTurnResponse {
  teamSession: TeamSession;
  handoff: ContestTeamHandoff;
  kickoffOptions: TeamKickoffOption[];
  coachSummary?: string | null;
  toast?: string | null;
}

export interface ContestWorkspaceSnapshot {
  contest: Contest;
  ideationSession: ContestIdeationSession;
  handoff: ContestTeamHandoff | null;
  strategyReport: ContestStrategyLabResult | null;
  strategySources: ContestStrategyCitation[];
  teamSnapshot: TeamBootstrapResponse | null;
  reviewNotes: ContestWorkspaceReviewNote[];
  submissionPackage: ContestSubmissionPackage;
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
