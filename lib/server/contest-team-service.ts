import "server-only";

import type {
  Contest,
  ContestTeamHandoff,
  TeamArtifact,
  TeamArtifactStatus,
  TeamArtifactType,
  TeamKickoffOption,
  TeamMember,
  TeamMessage,
  TeamMessageKind,
  TeamTask,
  TeamTaskPriority,
  TeamTaskStatus,
} from "@/types/contest";
import { callRemoteAiService, canUseRemoteAiService } from "./remote-ai-runtime";

const DEFAULT_TIMEOUT_MS = 45_000;

type RemoteTeamMemberPayload = {
  memberKey: string;
  name: string;
  role: string;
  englishRole?: string | null;
  personality: string;
  mainContribution: string;
  skills: string[];
  introLine: string;
  status: "online" | "working" | "resting";
  avatarSeed: string;
};

type RemoteTeamTaskPayload = {
  title: string;
  description: string;
  priority: TeamTaskPriority;
  status?: TeamTaskStatus;
  assigneeKey?: string | null;
  origin?: string;
};

type RemoteTeamArtifactPayload = {
  artifactType: TeamArtifactType;
  title: string;
  summary: string;
  body: string;
  status?: TeamArtifactStatus;
  sourceTaskTitle?: string | null;
};

type RemoteGenerateContestTeamPayload = {
  teamName: string;
  teamIntro: string;
  members: RemoteTeamMemberPayload[];
  kickoffOptions: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  initialMessages?: Array<{
    memberKey?: string | null;
    authorType: "ai" | "system";
    body: string;
    messageKind: TeamMessageKind;
  }>;
  initialTasks: RemoteTeamTaskPayload[];
  initialArtifacts: RemoteTeamArtifactPayload[];
  reason: string;
  promptVersion?: string | null;
  modelName?: string | null;
};

type RemoteTeamMutationMessage = {
  memberKey?: string | null;
  authorType: "ai" | "system";
  body: string;
  messageKind: TeamMessageKind;
};

type RemoteTaskMutation = {
  action: "create" | "move" | "assign" | "complete";
  taskId?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: TeamTaskPriority | null;
  status?: TeamTaskStatus | null;
  assigneeKey?: string | null;
};

type RemoteArtifactMutation = {
  action: "create" | "update";
  artifactId?: string | null;
  artifactType?: TeamArtifactType | null;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  status?: TeamArtifactStatus | null;
  sourceTaskTitle?: string | null;
};

type RemoteSimulateTeamTurnPayload = {
  messages: RemoteTeamMutationMessage[];
  taskMutations: RemoteTaskMutation[];
  artifactMutations: RemoteArtifactMutation[];
  coachSummary?: string | null;
  promptVersion?: string | null;
  modelName?: string | null;
};

type TeamIdeationSummary = {
  why: string;
  how: string;
  ideaTitle: string;
  ideaDescription: string;
  matrixSummary: string;
};

type TeamStateInput = {
  teamName: string;
  teamIntro: string;
  currentFocus?: string | null;
  kickoffChoice?: string | null;
  readinessScore: number;
  members: TeamMember[];
  tasks: TeamTask[];
  artifacts: TeamArtifact[];
};

type RemoteTeamStatePayload = {
  teamName: string;
  teamIntro: string;
  currentFocus?: string | null;
  kickoffChoice?: string | null;
  readinessScore: number;
  members: Array<{
    memberKey: string;
    name: string;
    role: string;
    englishRole?: string | null;
    personality: string;
    mainContribution: string;
    skills: string[];
    introLine: string;
    status: "online" | "working" | "resting";
    isUserClaimed: boolean;
  }>;
  tasks: TeamTask[];
  artifacts: TeamArtifact[];
};

function buildContestPayload(contest: Contest) {
  return {
    id: contest.id,
    slug: contest.slug,
    title: contest.title,
    organizer: contest.organizer,
    shortDescription: contest.shortDescription,
    description: contest.description,
    url: contest.url,
    sourceUrl: contest.sourceUrl,
    applyUrl: contest.applyUrl,
    deadline: contest.deadline,
    participationMode: contest.participationMode,
    eligibilityText: contest.eligibilityText,
    difficulty: contest.difficulty,
    teamAllowed: contest.teamAllowed,
    prizeSummary: contest.prizeSummary,
    submissionFormat: contest.submissionFormat,
    submissionItems: contest.submissionItems ?? [],
    judgingCriteria: contest.judgingCriteria ?? [],
    stageSchedule: contest.stageSchedule ?? [],
    pastWinners: contest.pastWinners,
    toolsAllowed: contest.toolsAllowed,
    aiCategories: contest.aiCategories,
    tags: contest.tags,
    analysis: contest.analysis,
  };
}

function buildIdeationSummary(handoff: ContestTeamHandoff): TeamIdeationSummary {
  return {
    why: handoff.why,
    how: handoff.how,
    ideaTitle: handoff.ideaTitle,
    ideaDescription: handoff.ideaDescription,
    matrixSummary: handoff.matrixSummary,
  };
}

function mapKickoffOptions(
  options: RemoteGenerateContestTeamPayload["kickoffOptions"],
  fallback: TeamKickoffOption[],
) {
  if (!options.length) {
    return fallback;
  }

  return options.map((option) => ({
    id: option.id,
    label: option.label,
    description: option.description,
  }));
}

export function canUseRemoteContestTeamService() {
  return canUseRemoteAiService();
}

export async function generateContestTeamWithRemoteService(input: {
  contest: Contest;
  handoff: ContestTeamHandoff;
  regenerationMode?: "bootstrap" | "single" | "all";
  claimedRoles?: string[];
  currentMembers?: TeamMember[];
  fallbackKickoffOptions: TeamKickoffOption[];
}) {
  const response = await callRemoteAiService<
    {
      contest: ReturnType<typeof buildContestPayload>;
      ideationSummary: TeamIdeationSummary;
      regenerationMode: "bootstrap" | "single" | "all";
      claimedRoles: string[];
      currentMembers: Array<{
        memberKey: string;
        name: string;
        role: string;
        englishRole?: string | null;
        personality: string;
        mainContribution: string;
        skills: string[];
        introLine: string;
        status: "online" | "working" | "resting";
        avatarSeed: string;
        isUserClaimed: boolean;
      }>;
    },
    RemoteGenerateContestTeamPayload
  >({
    service: "contest-team:generate",
    path: "/generate-contest-team",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    metadata: {
      contestSlug: input.contest.slug,
      regenerationMode: input.regenerationMode ?? "bootstrap",
    },
    payload: {
      contest: buildContestPayload(input.contest),
      ideationSummary: buildIdeationSummary(input.handoff),
      regenerationMode: input.regenerationMode ?? "bootstrap",
      claimedRoles: input.claimedRoles ?? [],
      currentMembers:
        input.currentMembers?.map((member) => ({
          memberKey: member.memberKey,
          name: member.name,
          role: member.role,
          englishRole: member.englishRole,
          personality: member.personality,
          mainContribution: member.mainContribution,
          skills: member.skills,
          introLine: member.introLine,
          status: member.status,
          avatarSeed: member.avatarSeed,
          isUserClaimed: member.isUserClaimed,
        })) ?? [],
    },
  });
  const payload = response.payload;

  return {
    teamName: payload.teamName,
    teamIntro: payload.teamIntro,
    members: payload.members,
    kickoffOptions: mapKickoffOptions(payload.kickoffOptions ?? [], input.fallbackKickoffOptions),
    initialMessages: payload.initialMessages ?? [],
    initialTasks: payload.initialTasks ?? [],
    initialArtifacts: payload.initialArtifacts ?? [],
    reason: payload.reason,
  };
}

export async function simulateContestTeamTurnWithRemoteService(input: {
  contest: Contest;
  handoff: ContestTeamHandoff;
  teamState: TeamStateInput;
  lastMessages: TeamMessage[];
  userAction: {
    message?: string | null;
    quickAction?: string | null;
  };
}) {
  const response = await callRemoteAiService<
    {
      contest: ReturnType<typeof buildContestPayload>;
      ideationSummary: TeamIdeationSummary;
      team: RemoteTeamStatePayload;
      lastMessages: Array<{
        authorType: TeamMessage["authorType"];
        speakerName: string;
        speakerRole: string | null;
        body: string;
        messageKind: TeamMessageKind;
      }>;
      userAction: {
        message?: string | null;
        quickAction?: string | null;
      };
    },
    RemoteSimulateTeamTurnPayload
  >({
    service: "contest-team:turn",
    path: "/simulate-team-turn",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    metadata: {
      contestSlug: input.contest.slug,
      quickAction: input.userAction.quickAction ?? null,
      teamName: input.teamState.teamName,
    },
    payload: {
      contest: buildContestPayload(input.contest),
      ideationSummary: buildIdeationSummary(input.handoff),
      team: {
        ...input.teamState,
        members: input.teamState.members.map((member) => ({
          memberKey: member.memberKey,
          name: member.name,
          role: member.role,
          englishRole: member.englishRole,
          personality: member.personality,
          mainContribution: member.mainContribution,
          skills: member.skills,
          introLine: member.introLine,
          status: member.status,
          isUserClaimed: member.isUserClaimed,
        })),
      },
      lastMessages: input.lastMessages.slice(-10).map((message) => ({
        authorType: message.authorType,
        speakerName: message.speakerName,
        speakerRole: message.speakerRole ?? null,
        body: message.body,
        messageKind: message.messageKind,
      })),
      userAction: input.userAction,
    },
  });
  return response.payload;
}
