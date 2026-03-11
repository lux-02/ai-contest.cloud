import "server-only";

import { createHmac, randomUUID } from "node:crypto";

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

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const headerSegment = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
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

function buildServiceToken(config: NonNullable<ReturnType<typeof getRemoteConfig>>) {
  const now = Math.floor(Date.now() / 1000);

  return signJwt(
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
}

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
  return getRemoteConfig() !== null;
}

export async function generateContestTeamWithRemoteService(input: {
  contest: Contest;
  handoff: ContestTeamHandoff;
  regenerationMode?: "bootstrap" | "single" | "all";
  claimedRoles?: string[];
  currentMembers?: TeamMember[];
  fallbackKickoffOptions: TeamKickoffOption[];
}) {
  const config = getRemoteConfig();

  if (!config) {
    throw new Error("Remote contest team service is not configured.");
  }

  const response = await fetch(`${config.baseUrl}/generate-contest-team`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${buildServiceToken(config)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Remote contest team generation failed.");
  }

  const payload = (await response.json()) as RemoteGenerateContestTeamPayload;

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
  const config = getRemoteConfig();

  if (!config) {
    throw new Error("Remote contest team service is not configured.");
  }

  const response = await fetch(`${config.baseUrl}/simulate-team-turn`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${buildServiceToken(config)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
        speakerRole: message.speakerRole,
        body: message.body,
        messageKind: message.messageKind,
      })),
      userAction: input.userAction,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Remote contest team simulation failed.");
  }

  return (await response.json()) as RemoteSimulateTeamTurnPayload;
}
