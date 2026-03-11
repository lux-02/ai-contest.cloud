import "server-only";

import type { PoolClient, QueryResultRow } from "pg";

import {
  buildTeamCompletionSummary,
  buildTeamMilestones,
  clampReadinessScore,
  getTaskReadinessDelta,
  resolveCurrentFocus,
  TEAM_ARTIFACT_READY_DELTA,
  TEAM_BOOTSTRAP_READINESS,
  TEAM_KICKOFF_READINESS_DELTA,
  teamKickoffOptions,
} from "@/lib/team-simulation";
import { getContestById } from "@/lib/queries";
import { getDbPool } from "@/lib/server/db";
import { logRemoteAiFallback } from "@/lib/server/remote-ai-runtime";
import { generateFallbackContestTeam, simulateFallbackTeamTurn } from "@/lib/server/contest-team-fallback";
import {
  canUseRemoteContestTeamService,
  generateContestTeamWithRemoteService,
  simulateContestTeamTurnWithRemoteService,
} from "@/lib/server/contest-team-service";
import { getContestTeamHandoff } from "@/lib/server/contest-ideation";
import type {
  Contest,
  ContestTeamHandoff,
  TeamActivityEvent,
  TeamArtifact,
  TeamBootstrapResponse,
  TeamKickoffOption,
  TeamMember,
  TeamMessage,
  TeamScoreEvent,
  TeamSession,
  TeamSimulationTurnResponse,
  TeamTask,
  TeamTaskPriority,
  TeamTaskStatus,
} from "@/types/contest";

type TeamSessionRow = QueryResultRow & {
  id: string;
  contest_id: string;
  ideation_session_id: string;
  user_id: string;
  status: TeamSession["status"];
  team_name: string;
  team_intro: string;
  readiness_score: number;
  current_focus: string | null;
  kickoff_choice: string | null;
  kickoff_options_json: unknown;
  claimed_role_ids_json: unknown;
  created_at: string;
  updated_at: string;
};

type TeamMemberRow = QueryResultRow & {
  id: string;
  team_session_id: string;
  member_key: string;
  name: string;
  role: string;
  english_role: string | null;
  personality: string;
  main_contribution: string;
  skills_json: unknown;
  intro_line: string;
  status: TeamMember["status"];
  avatar_seed: string;
  is_user_claimed: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type TeamMessageRow = QueryResultRow & {
  id: string;
  team_session_id: string;
  author_type: TeamMessage["authorType"];
  member_id: string | null;
  body: string;
  message_kind: TeamMessage["messageKind"];
  created_at: string;
};

type TeamTaskRow = QueryResultRow & {
  id: string;
  team_session_id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: TeamTaskPriority;
  assignee_member_id: string | null;
  origin: string;
  readiness_delta: number;
  created_at: string;
  updated_at: string;
};

type TeamArtifactRow = QueryResultRow & {
  id: string;
  team_session_id: string;
  artifact_type: TeamArtifact["artifactType"];
  title: string;
  summary: string;
  body: string;
  status: TeamArtifact["status"];
  source_task_id: string | null;
  created_at: string;
  updated_at: string;
};

type TeamScoreEventRow = QueryResultRow & {
  id: string;
  team_session_id: string;
  label: string;
  delta: number;
  created_at: string;
};

type TeamActivityEventRow = QueryResultRow & {
  id: string;
  sequence: string | number;
  team_session_id: string;
  actor_member_id: string | null;
  actor_label: string | null;
  actor_role: string | null;
  title: string;
  detail: string | null;
  state: TeamActivityEvent["state"];
  source: TeamActivityEvent["source"];
  created_at: string;
};

type TeamAccessContext = {
  contest: Contest;
  handoff: ContestTeamHandoff;
};

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parseKickoffOptions(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (!item || typeof item !== "object") {
          return [];
        }

        const row = item as {
          id?: unknown;
          label?: unknown;
          description?: unknown;
        };

        if (typeof row.id !== "string" || typeof row.label !== "string" || typeof row.description !== "string") {
          return [];
        }

        return [
          {
            id: row.id,
            label: row.label,
            description: row.description,
          } satisfies TeamKickoffOption,
        ];
      })
      .slice(0, 4);
  }

  if (typeof value === "string") {
    try {
      return parseKickoffOptions(JSON.parse(value));
    } catch {
      return teamKickoffOptions;
    }
  }

  return teamKickoffOptions;
}

function mapTaskStatus(status: TeamTaskRow["status"]): TeamTaskStatus {
  return status === "in_progress" ? "in_progress" : status;
}

function buildTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    memberKey: row.member_key,
    name: row.name,
    role: row.role,
    englishRole: row.english_role,
    personality: row.personality,
    mainContribution: row.main_contribution,
    skills: parseStringArray(row.skills_json),
    introLine: row.intro_line,
    status: row.status,
    avatarSeed: row.avatar_seed,
    isUserClaimed: row.is_user_claimed,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function buildMessageSpeakerName(row: TeamMessageRow, membersById: Map<string, TeamMember>) {
  if (row.author_type === "user") {
    return {
      speakerName: "나",
      speakerRole: "팀 리드",
    };
  }

  if (row.author_type === "system") {
    return {
      speakerName: "팀 코치",
      speakerRole: "시스템 요약",
    };
  }

  const member = row.member_id ? membersById.get(row.member_id) : null;

  return {
    speakerName: member?.name ?? "AI 팀원",
    speakerRole: member?.role ?? null,
  };
}

function buildTeamMessage(row: TeamMessageRow, membersById: Map<string, TeamMember>): TeamMessage {
  const speaker = buildMessageSpeakerName(row, membersById);

  return {
    id: row.id,
    authorType: row.author_type,
    memberId: row.member_id,
    speakerName: speaker.speakerName,
    speakerRole: speaker.speakerRole,
    body: row.body,
    messageKind: row.message_kind,
    createdAt: row.created_at,
  };
}

function buildTeamTask(row: TeamTaskRow, membersById: Map<string, TeamMember>): TeamTask {
  const assignee = row.assignee_member_id ? membersById.get(row.assignee_member_id) : null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: mapTaskStatus(row.status),
    priority: row.priority,
    assigneeMemberId: row.assignee_member_id,
    assigneeLabel: assignee ? `${assignee.name} · ${assignee.role}` : null,
    origin: row.origin as TeamTask["origin"],
    readinessDelta: row.readiness_delta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildTeamArtifact(row: TeamArtifactRow): TeamArtifact {
  return {
    id: row.id,
    artifactType: row.artifact_type,
    title: row.title,
    summary: row.summary,
    body: row.body,
    status: row.status,
    sourceTaskId: row.source_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildTeamScoreEvent(row: TeamScoreEventRow): TeamScoreEvent {
  return {
    id: row.id,
    label: row.label,
    delta: row.delta,
    createdAt: row.created_at,
  };
}

function buildTeamActivityEvent(row: TeamActivityEventRow): TeamActivityEvent {
  return {
    id: row.id,
    sequence: typeof row.sequence === "string" ? Number(row.sequence) : row.sequence,
    title: row.title,
    detail: row.detail,
    state: row.state,
    source: row.source,
    actorMemberId: row.actor_member_id,
    actorLabel: row.actor_label,
    actorRole: row.actor_role,
    createdAt: row.created_at,
  };
}

function buildTeamSessionSnapshot(
  row: TeamSessionRow,
  members: TeamMember[],
  messages: TeamMessage[],
  tasks: TeamTask[],
  artifacts: TeamArtifact[],
  scoreEvents: TeamScoreEvent[],
  activityEvents: TeamActivityEvent[],
): TeamSession {
  const teamSession: TeamSession = {
    id: row.id,
    contestId: row.contest_id,
    ideationSessionId: row.ideation_session_id,
    userId: row.user_id,
    status: row.status,
    teamName: row.team_name,
    teamIntro: row.team_intro,
    readinessScore: row.readiness_score,
    currentFocus: row.current_focus,
    kickoffChoice: row.kickoff_choice,
    claimedRoleIds: parseStringArray(row.claimed_role_ids_json),
    kickoffOptions: parseKickoffOptions(row.kickoff_options_json),
    members,
    messages,
    tasks,
    artifacts,
    scoreEvents,
    activityEvents,
    updatedAt: row.updated_at,
  };

  teamSession.milestones = buildTeamMilestones(teamSession);
  teamSession.completionSummary = buildTeamCompletionSummary(teamSession);

  return teamSession;
}

async function resolveTeamAccess(contestId: string, ideationSessionId: string, userId: string): Promise<TeamAccessContext | null> {
  const [contest, handoff] = await Promise.all([getContestById(contestId), getContestTeamHandoff(contestId, ideationSessionId, userId)]);

  if (!contest || !handoff) {
    return null;
  }

  return {
    contest,
    handoff,
  };
}

async function getTeamSessionRowByIdeation(client: PoolClient, ideationSessionId: string, userId: string) {
  const result = await client.query<TeamSessionRow>(
    `
      select *
      from public.team_sessions
      where ideation_session_id = $1
        and user_id = $2
      limit 1
    `,
    [ideationSessionId, userId],
  );

  return result.rows[0] ?? null;
}

async function getTeamSessionRowById(client: PoolClient, teamSessionId: string, contestId: string, userId: string) {
  const result = await client.query<TeamSessionRow>(
    `
      select *
      from public.team_sessions
      where id = $1
        and contest_id = $2
        and user_id = $3
      limit 1
    `,
    [teamSessionId, contestId, userId],
  );

  return result.rows[0] ?? null;
}

async function getTeamMemberRows(client: PoolClient, teamSessionId: string) {
  const result = await client.query<TeamMemberRow>(
    `
      select *
      from public.team_members
      where team_session_id = $1
      order by is_active desc, sort_order asc, created_at asc
    `,
    [teamSessionId],
  );

  return result.rows;
}

async function getTeamMessageRows(client: PoolClient, teamSessionId: string) {
  const result = await client.query<TeamMessageRow>(
    `
      select *
      from public.team_messages
      where team_session_id = $1
      order by created_at asc
    `,
    [teamSessionId],
  );

  return result.rows;
}

async function getTeamTaskRows(client: PoolClient, teamSessionId: string) {
  const result = await client.query<TeamTaskRow>(
    `
      select *
      from public.team_tasks
      where team_session_id = $1
      order by
        case priority when 'high' then 0 when 'medium' then 1 else 2 end,
        created_at asc
    `,
    [teamSessionId],
  );

  return result.rows;
}

async function getTeamArtifactRows(client: PoolClient, teamSessionId: string) {
  const result = await client.query<TeamArtifactRow>(
    `
      select *
      from public.team_artifacts
      where team_session_id = $1
      order by created_at asc
    `,
    [teamSessionId],
  );

  return result.rows;
}

async function getTeamScoreEventRows(client: PoolClient, teamSessionId: string) {
  const result = await client.query<TeamScoreEventRow>(
    `
      select *
      from public.team_score_events
      where team_session_id = $1
      order by created_at desc
      limit 12
    `,
    [teamSessionId],
  );

  return result.rows.slice().reverse();
}

async function getTeamActivityEventRows(client: PoolClient, teamSessionId: string, afterSequence?: number | null) {
  const result = await client.query<TeamActivityEventRow>(
    `
      select *
      from public.team_activity_events
      where team_session_id = $1
        and ($2::bigint is null or sequence > $2::bigint)
      order by sequence desc
      limit 18
    `,
    [teamSessionId, afterSequence ?? null],
  );

  return result.rows.slice().reverse();
}

async function readTeamSessionSnapshot(client: PoolClient, row: TeamSessionRow) {
  const [memberRows, messageRows, taskRows, artifactRows, scoreEventRows, activityEventRows] = await Promise.all([
    getTeamMemberRows(client, row.id),
    getTeamMessageRows(client, row.id),
    getTeamTaskRows(client, row.id),
    getTeamArtifactRows(client, row.id),
    getTeamScoreEventRows(client, row.id),
    getTeamActivityEventRows(client, row.id),
  ]);

  const members = memberRows.map(buildTeamMember);
  const membersById = new Map(members.map((member) => [member.id, member]));
  const messages = messageRows.map((message) => buildTeamMessage(message, membersById));
  const tasks = taskRows.map((task) => buildTeamTask(task, membersById));
  const artifacts = artifactRows.map(buildTeamArtifact);
  const scoreEvents = scoreEventRows.map(buildTeamScoreEvent);
  const activityEvents = activityEventRows.map(buildTeamActivityEvent);

  return buildTeamSessionSnapshot(row, members, messages, tasks, artifacts, scoreEvents, activityEvents);
}

async function insertTeamMembers(
  client: PoolClient,
  teamSessionId: string,
  members: Array<{
    memberKey: string;
    name: string;
    role: string;
    englishRole?: string | null;
    personality: string;
    mainContribution: string;
    skills: string[];
    introLine: string;
    status: TeamMember["status"];
    avatarSeed: string;
    isUserClaimed?: boolean;
    sortOrder: number;
  }>,
) {
  const inserted = new Map<string, string>();

  for (const member of members) {
    const result = await client.query<{ id: string }>(
      `
        insert into public.team_members (
          team_session_id,
          member_key,
          name,
          role,
          english_role,
          personality,
          main_contribution,
          skills_json,
          intro_line,
          status,
          avatar_seed,
          is_user_claimed,
          sort_order
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)
        returning id
      `,
      [
        teamSessionId,
        member.memberKey,
        member.name,
        member.role,
        member.englishRole ?? null,
        member.personality,
        member.mainContribution,
        JSON.stringify(member.skills),
        member.introLine,
        member.status,
        member.avatarSeed,
        member.isUserClaimed ?? false,
        member.sortOrder,
      ],
    );

    inserted.set(member.memberKey, result.rows[0].id);
  }

  return inserted;
}

async function insertTeamMessages(
  client: PoolClient,
  teamSessionId: string,
  entries: Array<{
    authorType: TeamMessage["authorType"];
    memberId?: string | null;
    body: string;
    messageKind: TeamMessage["messageKind"];
  }>,
) {
  for (const entry of entries) {
    await client.query(
      `
        insert into public.team_messages (
          team_session_id,
          author_type,
          member_id,
          body,
          message_kind
        )
        values ($1, $2, $3, $4, $5)
      `,
      [teamSessionId, entry.authorType, entry.memberId ?? null, entry.body, entry.messageKind],
    );
  }
}

async function insertTeamTasks(
  client: PoolClient,
  teamSessionId: string,
  entries: Array<{
    title: string;
    description: string;
    priority: TeamTaskPriority;
    status?: TeamTaskStatus;
    assigneeMemberId?: string | null;
    origin?: string;
  }>,
) {
  const inserted = new Map<string, string>();

  for (const entry of entries) {
    const result = await client.query<{ id: string }>(
      `
        insert into public.team_tasks (
          team_session_id,
          title,
          description,
          status,
          priority,
          assignee_member_id,
          origin
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id
      `,
      [
        teamSessionId,
        entry.title,
        entry.description,
        entry.status === "in_progress" ? "in_progress" : entry.status ?? "todo",
        entry.priority,
        entry.assigneeMemberId ?? null,
        entry.origin ?? "chat",
      ],
    );

    inserted.set(entry.title, result.rows[0].id);
  }

  return inserted;
}

async function insertTeamArtifacts(
  client: PoolClient,
  teamSessionId: string,
  entries: Array<{
    artifactType: TeamArtifact["artifactType"];
    title: string;
    summary: string;
    body: string;
    status?: TeamArtifact["status"];
    sourceTaskId?: string | null;
  }>,
) {
  for (const entry of entries) {
    await client.query(
      `
        insert into public.team_artifacts (
          team_session_id,
          artifact_type,
          title,
          summary,
          body,
          status,
          source_task_id
        )
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        teamSessionId,
        entry.artifactType,
        entry.title,
        entry.summary,
        entry.body,
        entry.status ?? "draft",
        entry.sourceTaskId ?? null,
      ],
    );
  }
}

async function insertScoreEvent(client: PoolClient, teamSessionId: string, label: string, delta: number) {
  await client.query(
    `
      insert into public.team_score_events (team_session_id, label, delta)
      values ($1, $2, $3)
    `,
    [teamSessionId, label, delta],
  );
}

async function insertTeamActivityEvent(
  client: PoolClient,
  teamSessionId: string,
  input: {
    title: string;
    detail?: string | null;
    state: TeamActivityEvent["state"];
    source: TeamActivityEvent["source"];
    actorMemberId?: string | null;
    actorLabel?: string | null;
    actorRole?: string | null;
  },
) {
  await client.query(
    `
      insert into public.team_activity_events (
        team_session_id,
        actor_member_id,
        actor_label,
        actor_role,
        title,
        detail,
        state,
        source
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      teamSessionId,
      input.actorMemberId ?? null,
      input.actorLabel ?? null,
      input.actorRole ?? null,
      input.title,
      input.detail ?? null,
      input.state,
      input.source,
    ],
  );
}

async function insertTeamActivityEventDetached(
  teamSessionId: string,
  input: {
    title: string;
    detail?: string | null;
    state: TeamActivityEvent["state"];
    source: TeamActivityEvent["source"];
    actorMemberId?: string | null;
    actorLabel?: string | null;
    actorRole?: string | null;
  },
) {
  const pool = getDbPool();

  await pool.query(
    `
      insert into public.team_activity_events (
        team_session_id,
        actor_member_id,
        actor_label,
        actor_role,
        title,
        detail,
        state,
        source
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      teamSessionId,
      input.actorMemberId ?? null,
      input.actorLabel ?? null,
      input.actorRole ?? null,
      input.title,
      input.detail ?? null,
      input.state,
      input.source,
    ],
  );
}

function createDetachedProgressTracker(input: {
  teamSessionId: string;
  title: string;
  source?: TeamActivityEvent["source"];
  actorMemberId?: string | null;
  actorLabel?: string | null;
  actorRole?: string | null;
  steps: string[];
}) {
  let index = 0;
  let stopped = false;
  const source = input.source ?? "system";

  void insertTeamActivityEventDetached(input.teamSessionId, {
    title: input.title,
    detail: input.steps[0] ?? null,
    state: "running",
    source,
    actorMemberId: input.actorMemberId,
    actorLabel: input.actorLabel,
    actorRole: input.actorRole,
  }).catch(() => undefined);

  const interval = globalThis.setInterval(() => {
    if (stopped) {
      return;
    }

    index += 1;

    if (index >= input.steps.length) {
      return;
    }

    void insertTeamActivityEventDetached(input.teamSessionId, {
      title: input.title,
      detail: input.steps[index],
      state: "running",
      source,
      actorMemberId: input.actorMemberId,
      actorLabel: input.actorLabel,
      actorRole: input.actorRole,
    }).catch(() => undefined);
  }, 1000);

  return {
    async complete(detail?: string | null) {
      if (stopped) {
        return;
      }

      stopped = true;
      globalThis.clearInterval(interval);
      await insertTeamActivityEventDetached(input.teamSessionId, {
        title: input.title,
        detail: detail ?? input.steps[Math.min(index, input.steps.length - 1)] ?? null,
        state: "completed",
        source,
        actorMemberId: input.actorMemberId,
        actorLabel: input.actorLabel,
        actorRole: input.actorRole,
      }).catch(() => undefined);
    },
    async fail(detail?: string | null) {
      if (stopped) {
        return;
      }

      stopped = true;
      globalThis.clearInterval(interval);
      await insertTeamActivityEventDetached(input.teamSessionId, {
        title: input.title,
        detail: detail ?? "처리 중 오류가 발생했습니다.",
        state: "failed",
        source,
        actorMemberId: input.actorMemberId,
        actorLabel: input.actorLabel,
        actorRole: input.actorRole,
      }).catch(() => undefined);
    },
  };
}

async function updateTeamSessionRow(
  client: PoolClient,
  teamSessionId: string,
  input: {
    status?: TeamSession["status"];
    readinessScore?: number;
    currentFocus?: string | null;
    kickoffChoice?: string | null;
    claimedRoleIds?: string[];
    kickoffOptions?: TeamKickoffOption[];
  },
) {
  const current = await client.query<TeamSessionRow>(
    `
      select *
      from public.team_sessions
      where id = $1
      limit 1
    `,
    [teamSessionId],
  );

  const existing = current.rows[0];

  if (!existing) {
    throw new Error("팀 세션을 찾을 수 없습니다.");
  }

  await client.query(
    `
      update public.team_sessions
      set
        status = $2,
        readiness_score = $3,
        current_focus = $4,
        kickoff_choice = $5,
        claimed_role_ids_json = $6::jsonb,
        kickoff_options_json = $7::jsonb
      where id = $1
    `,
    [
      teamSessionId,
      input.status ?? existing.status,
      input.readinessScore ?? existing.readiness_score,
      input.currentFocus ?? existing.current_focus,
      input.kickoffChoice ?? existing.kickoff_choice,
      JSON.stringify(input.claimedRoleIds ?? parseStringArray(existing.claimed_role_ids_json)),
      JSON.stringify(input.kickoffOptions ?? parseKickoffOptions(existing.kickoff_options_json)),
    ],
  );
}

function buildMemberMapByKey(members: TeamMember[]) {
  return new Map(members.filter((member) => member.isActive).map((member) => [member.memberKey, member]));
}

function getActiveUnclaimedMembers(members: TeamMember[]) {
  return members.filter((member) => member.isActive && !member.isUserClaimed);
}

export async function getTeamSessionSnapshot(contestId: string, ideationSessionId: string, userId: string) {
  const access = await resolveTeamAccess(contestId, ideationSessionId, userId);

  if (!access) {
    return null;
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const row = await getTeamSessionRowByIdeation(client, ideationSessionId, userId);

    if (!row) {
      return null;
    }

    const teamSession = await readTeamSessionSnapshot(client, row);

    return {
      teamSession,
      handoff: access.handoff,
      kickoffOptions: teamSession.kickoffOptions,
      coachSummary: null,
      justBootstrapped: false,
    } satisfies TeamBootstrapResponse;
  } finally {
    client.release();
  }
}

export async function listTeamActivityEvents(input: {
  contestId: string;
  teamSessionId: string;
  userId: string;
  afterSequence?: number | null;
}) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const row = await getTeamSessionRowById(client, input.teamSessionId, input.contestId, input.userId);

    if (!row) {
      throw new Error("팀 세션을 찾을 수 없습니다.");
    }

    const activityRows = await getTeamActivityEventRows(client, row.id, input.afterSequence ?? null);
    return activityRows.map(buildTeamActivityEvent);
  } finally {
    client.release();
  }
}

export async function bootstrapContestTeamSession(contestId: string, ideationSessionId: string, userId: string) {
  const access = await resolveTeamAccess(contestId, ideationSessionId, userId);

  if (!access) {
    return null;
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const existingRow = await getTeamSessionRowByIdeation(client, ideationSessionId, userId);

    if (existingRow) {
      const teamSession = await readTeamSessionSnapshot(client, existingRow);
      await client.query("commit");

      return {
        teamSession,
        handoff: access.handoff,
        kickoffOptions: teamSession.kickoffOptions,
        coachSummary: null,
        justBootstrapped: false,
      } satisfies TeamBootstrapResponse;
    }

    const generated = canUseRemoteContestTeamService()
      ? await generateContestTeamWithRemoteService({
          contest: access.contest,
          handoff: access.handoff,
          regenerationMode: "bootstrap",
          fallbackKickoffOptions: teamKickoffOptions,
        }).catch((error) => {
          logRemoteAiFallback("contest-team:generate", error, {
            contestSlug: access.contest.slug,
            stage: "bootstrap",
          });
          return generateFallbackContestTeam(access.contest, access.handoff);
        })
      : generateFallbackContestTeam(access.contest, access.handoff);

    const sessionResult = await client.query<{ id: string }>(
      `
        insert into public.team_sessions (
          contest_id,
          ideation_session_id,
          user_id,
          status,
          team_name,
          team_intro,
          readiness_score,
          current_focus,
          kickoff_options_json,
          claimed_role_ids_json
        )
        values ($1, $2, $3, 'active', $4, $5, $6, $7, $8::jsonb, '[]'::jsonb)
        returning id
      `,
      [
        contestId,
        ideationSessionId,
        userId,
        generated.teamName,
        generated.teamIntro,
        TEAM_BOOTSTRAP_READINESS,
        null,
        JSON.stringify(generated.kickoffOptions),
      ],
    );

    const teamSessionId = sessionResult.rows[0].id;
    const memberIds = await insertTeamMembers(
      client,
      teamSessionId,
      generated.members.map((member, index) => ({
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
        sortOrder: index + 1,
      })),
    );

    const taskIds = await insertTeamTasks(
      client,
      teamSessionId,
      generated.initialTasks.map((task) => ({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: "status" in task && task.status ? task.status : "todo",
        assigneeMemberId: task.assigneeKey ? memberIds.get(task.assigneeKey) ?? null : null,
        origin: task.origin ?? "bootstrap",
      })),
    );

    await insertTeamArtifacts(
      client,
      teamSessionId,
      generated.initialArtifacts.map((artifact) => ({
        artifactType: artifact.artifactType,
        title: artifact.title,
        summary: artifact.summary,
        body: artifact.body,
        status: artifact.status ?? "draft",
        sourceTaskId: artifact.sourceTaskTitle ? taskIds.get(artifact.sourceTaskTitle) ?? null : null,
      })),
    );

    const initialMessages =
      "initialMessages" in generated && generated.initialMessages.length
        ? generated.initialMessages.map((message) => ({
            authorType: message.authorType,
            memberId: message.memberKey ? memberIds.get(message.memberKey) ?? null : null,
            body: message.body,
            messageKind: message.messageKind,
          }))
        : [
            {
              authorType: "system" as const,
              body: "팀 구성 완료! 이제 본격적으로 시작해볼까요?",
              messageKind: "summary" as const,
            },
            {
              authorType: "ai" as const,
              memberId: memberIds.get(generated.members[0]?.memberKey ?? "") ?? null,
              body: "안녕! 우리 팀 이제 본격적으로 시작해볼까? 첫 번째로 뭐부터 할지 골라줘.",
              messageKind: "chat" as const,
            },
          ];

    await insertTeamMessages(client, teamSessionId, initialMessages);
    await insertScoreEvent(client, teamSessionId, "팀 구성 완료", TEAM_BOOTSTRAP_READINESS);
    await insertTeamActivityEvent(client, teamSessionId, {
      title: "팀 구성 완료",
      detail: generated.reason ?? "공모전과 확정 아이디어에 맞는 첫 팀 구성을 만들었어요.",
      state: "completed",
      source: "system",
      actorLabel: "팀 코치",
      actorRole: "시스템",
    });
    await insertTeamActivityEvent(client, teamSessionId, {
      title: "첫 작업 세팅 완료",
      detail: "킥오프 선택지, 기본 태스크, 작업물 카드를 바로 시작할 수 있게 정리했어요.",
      state: "completed",
      source: "system",
      actorLabel: "팀 코치",
      actorRole: "시스템",
    });

    const currentFocus = resolveCurrentFocus(
      generated.initialTasks.map((task) => ({
        id: taskIds.get(task.title) ?? "",
        title: task.title,
        description: task.description,
        status: "status" in task && task.status ? task.status : "todo",
        priority: task.priority,
        assigneeMemberId: null,
        origin: (task.origin ?? "bootstrap") as TeamTask["origin"],
        readinessDelta: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    );

    await updateTeamSessionRow(client, teamSessionId, {
      currentFocus,
      kickoffOptions: generated.kickoffOptions,
      readinessScore: TEAM_BOOTSTRAP_READINESS,
    });

    const updatedRow = await getTeamSessionRowById(client, teamSessionId, contestId, userId);

    if (!updatedRow) {
      throw new Error("팀 세션을 다시 불러오지 못했습니다.");
    }

    const teamSession = await readTeamSessionSnapshot(client, updatedRow);
    await client.query("commit");

    return {
      teamSession,
      handoff: access.handoff,
      kickoffOptions: generated.kickoffOptions,
      coachSummary: generated.reason,
      justBootstrapped: true,
    } satisfies TeamBootstrapResponse;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function regenerateContestTeamSession(input: {
  contestId: string;
  teamSessionId: string;
  userId: string;
  mode: "single" | "all" | "claim";
  memberId?: string | null;
}) {
  const pool = getDbPool();
  const client = await pool.connect();
  let progressTracker: ReturnType<typeof createDetachedProgressTracker> | null = null;

  try {
    await client.query("begin");
    const row = await getTeamSessionRowById(client, input.teamSessionId, input.contestId, input.userId);

    if (!row) {
      throw new Error("팀 세션을 찾을 수 없습니다.");
    }

    const access = await resolveTeamAccess(input.contestId, row.ideation_session_id, input.userId);

    if (!access) {
      throw new Error("이 팀 세션에는 접근할 수 없습니다.");
    }

    const session = await readTeamSessionSnapshot(client, row);

    if (input.mode === "claim") {
      if (!input.memberId) {
        throw new Error("직접 맡을 역할이 필요합니다.");
      }

      const target = session.members.find((member) => member.id === input.memberId && member.isActive);

      if (!target) {
        throw new Error("역할을 찾을 수 없습니다.");
      }

      const claimedIds = Array.from(new Set([...session.claimedRoleIds, target.id]));
      await client.query(
        `
          update public.team_members
          set is_user_claimed = true,
              status = 'working'
          where id = $1
        `,
        [target.id],
      );
      await updateTeamSessionRow(client, row.id, {
        claimedRoleIds: claimedIds,
      });
      await insertTeamMessages(client, row.id, [
        {
          authorType: "system",
          body: `${target.role} 역할은 직접 맡기로 표시했어요.`,
          messageKind: "summary",
        },
      ]);
      await insertTeamActivityEvent(client, row.id, {
        title: "역할 직접 맡기기 완료",
        detail: `${target.role} 역할을 직접 맡는 것으로 반영했어요.`,
        state: "completed",
        source: "user",
        actorMemberId: target.id,
        actorLabel: "나",
        actorRole: "팀 리드",
      });

    const refreshedRowAfterMeta = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!refreshedRowAfterMeta) {
      throw new Error("팀 세션을 다시 불러오지 못했습니다.");
    }

    const teamSession = await readTeamSessionSnapshot(client, refreshedRowAfterMeta);
      await client.query("commit");

      return {
        teamSession,
        handoff: access.handoff,
        kickoffOptions: teamSession.kickoffOptions,
        coachSummary: `${target.role} 역할은 이제 직접 챙기는 걸로 반영됐어요.`,
        toast: `${target.role} 역할을 직접 맡기로 표시했어요.`,
      } satisfies TeamSimulationTurnResponse;
    }

    const claimedRoles = session.members.filter((member) => member.isUserClaimed).map((member) => member.id);
    const currentMembers = session.members.filter((member) => member.isActive);
    const targetMember = input.memberId ? session.members.find((member) => member.id === input.memberId) : null;

    progressTracker = createDetachedProgressTracker({
      teamSessionId: row.id,
      title:
        input.mode === "single"
          ? `${targetMember?.role ?? "팀원"} 역할 다시 구성 중`
          : "팀 구성 다시 정리 중",
      source: "system",
      actorLabel: "팀 코치",
      actorRole: "시스템",
      steps:
        input.mode === "single"
          ? [
              "현재 역할에 비어 있는 기여를 다시 정리하는 중",
              "겹치지 않는 새 팀원 후보를 고르는 중",
              "남은 태스크 흐름과 연결하는 중",
            ]
          : [
              "공고와 심사 기준 기준으로 팀 조합을 다시 보는 중",
              "지금 아이디어에 맞는 역할 균형을 다시 맞추는 중",
              "새로운 킥오프와 작업 흐름을 정리하는 중",
            ],
    });

    const generated = canUseRemoteContestTeamService()
      ? await generateContestTeamWithRemoteService({
          contest: access.contest,
          handoff: access.handoff,
          regenerationMode: input.mode,
          claimedRoles,
          currentMembers,
          fallbackKickoffOptions: session.kickoffOptions.length ? session.kickoffOptions : teamKickoffOptions,
        }).catch((error) => {
          logRemoteAiFallback("contest-team:generate", error, {
            contestSlug: access.contest.slug,
            stage: "regenerate",
            mode: input.mode,
          });
          return generateFallbackContestTeam(access.contest, access.handoff);
        })
      : generateFallbackContestTeam(access.contest, access.handoff);

    if (input.mode === "single") {
      if (!input.memberId) {
        throw new Error("교체할 팀원이 필요합니다.");
      }

      const target = session.members.find((member) => member.id === input.memberId && member.isActive && !member.isUserClaimed);

      if (!target) {
        throw new Error("교체할 팀원을 찾을 수 없습니다.");
      }

      const replacement = generated.members[0];

      if (!replacement) {
        throw new Error("교체할 새 팀원을 만들지 못했습니다.");
      }

      await client.query(
        `
          update public.team_members
          set is_active = false,
              status = 'resting'
          where id = $1
        `,
        [target.id],
      );

      const inserted = await insertTeamMembers(client, row.id, [
        {
          memberKey: `${replacement.memberKey}-${Date.now()}`,
          name: replacement.name,
          role: replacement.role,
          englishRole: replacement.englishRole,
          personality: replacement.personality,
          mainContribution: replacement.mainContribution,
          skills: replacement.skills,
          introLine: replacement.introLine,
          status: replacement.status,
          avatarSeed: replacement.avatarSeed,
          sortOrder: target.sortOrder,
        },
      ]);

      const replacementId = Array.from(inserted.values())[0];

      await client.query(
        `
          update public.team_tasks
          set assignee_member_id = $2
          where team_session_id = $1
            and assignee_member_id = $3
            and status <> 'done'
        `,
        [row.id, replacementId, target.id],
      );

      await insertTeamMessages(client, row.id, [
        {
          authorType: "system",
          body: `${target.role} 자리에 새 팀원을 다시 구성했어요.`,
          messageKind: "summary",
        },
      ]);
      await insertTeamActivityEvent(client, row.id, {
        title: "한 명 바꾸기 완료",
        detail: `${target.role} 역할을 새 팀원으로 교체했어요.`,
        state: "completed",
        source: "system",
        actorLabel: "팀 코치",
        actorRole: "시스템",
      });
    }

    if (input.mode === "all") {
      const replaceableMembers = getActiveUnclaimedMembers(session.members);

      if (replaceableMembers.length > 0) {
        await client.query(
          `
            update public.team_members
            set is_active = false,
                status = 'resting'
            where team_session_id = $1
              and is_active = true
              and is_user_claimed = false
          `,
          [row.id],
        );
      }

      await insertTeamMembers(
        client,
        row.id,
        generated.members.map((member, index) => ({
          memberKey: `${member.memberKey}-${Date.now()}-${index}`,
          name: member.name,
          role: member.role,
          englishRole: member.englishRole,
          personality: member.personality,
          mainContribution: member.mainContribution,
          skills: member.skills,
          introLine: member.introLine,
          status: member.status,
          avatarSeed: member.avatarSeed,
          sortOrder: index + 1,
        })),
      );

      await client.query(
        `
          update public.team_tasks
          set assignee_member_id = null
          where team_session_id = $1
            and status <> 'done'
        `,
        [row.id],
      );

      await insertTeamMessages(client, row.id, [
        {
          authorType: "system",
          body: "팀 구성을 전체 기준으로 다시 짰어요. 이제 가장 맞는 조합으로 다시 시작해볼게요.",
          messageKind: "summary",
        },
      ]);
      await insertTeamActivityEvent(client, row.id, {
        title: "전체 팀 재구성 완료",
        detail: "현재 공모전과 확정 아이디어 기준으로 새 팀 조합을 다시 맞췄어요.",
        state: "completed",
        source: "system",
        actorLabel: "팀 코치",
        actorRole: "시스템",
      });
    }

    const updatedRow = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!updatedRow) {
      throw new Error("팀 세션을 다시 불러오지 못했습니다.");
    }

    const refreshed = await readTeamSessionSnapshot(client, updatedRow);
    await updateTeamSessionRow(client, row.id, {
      currentFocus: resolveCurrentFocus(refreshed.tasks),
    });
    const refreshedRowAfterMeta = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!refreshedRowAfterMeta) {
      throw new Error("팀 세션을 다시 불러오지 못했습니다.");
    }

    const teamSession = await readTeamSessionSnapshot(client, refreshedRowAfterMeta);
    await client.query("commit");
    await progressTracker?.complete(
      input.mode === "single" ? "교체한 역할까지 반영해서 팀 흐름을 다시 연결했어요." : "새 팀 구성으로 바로 다시 시작할 수 있어요.",
    );

    return {
      teamSession,
      handoff: access.handoff,
      kickoffOptions: teamSession.kickoffOptions,
      coachSummary: input.mode === "single" ? "한 명만 바꿔서 흐름은 유지했어요." : "전체 구성을 다시 짰어요.",
      toast: input.mode === "single" ? "팀원 한 명을 새로 짰어요." : "팀 구성을 다시 만들었어요.",
    } satisfies TeamSimulationTurnResponse;
  } catch (error) {
    await client.query("rollback");
    await progressTracker?.fail("팀 구성을 다시 만드는 중 문제가 생겼어요.");
    throw error;
  } finally {
    client.release();
  }
}

async function applyTaskMutation(
  client: PoolClient,
  teamSessionId: string,
  mutation: {
    action: "create" | "move" | "assign" | "complete";
    taskId?: string | null;
    title?: string | null;
    description?: string | null;
    priority?: TeamTaskPriority | null;
    status?: TeamTaskStatus | null;
    assigneeKey?: string | null;
  },
  activeMembersByKey: Map<string, TeamMember>,
) {
  let readinessDelta = 0;
  const assigneeId = mutation.assigneeKey ? activeMembersByKey.get(mutation.assigneeKey)?.id ?? null : null;

  if (mutation.action === "create") {
    const priority = mutation.priority ?? "medium";

    await insertTeamTasks(client, teamSessionId, [
      {
        title: mutation.title ?? "새 작업",
        description: mutation.description ?? "",
        priority,
        status: mutation.status ?? "todo",
        assigneeMemberId: assigneeId,
        origin: "chat",
      },
    ]);

    return 0;
  }

  const taskId = mutation.taskId ?? null;

  if (!taskId) {
    return 0;
  }

  const currentTaskRow = await client.query<TeamTaskRow>(
    `
      select *
      from public.team_tasks
      where id = $1
        and team_session_id = $2
      limit 1
    `,
    [taskId, teamSessionId],
  );

  const task = currentTaskRow.rows[0];

  if (!task) {
    return 0;
  }

  let nextStatus = task.status;
  let nextReadinessDelta = task.readiness_delta;

  if (mutation.action === "assign") {
    await client.query(
      `
        update public.team_tasks
        set assignee_member_id = $2
        where id = $1
      `,
      [taskId, assigneeId],
    );

    return 0;
  }

  if (mutation.action === "move" || mutation.action === "complete") {
    nextStatus =
      mutation.action === "complete"
        ? "done"
        : mutation.status === "in_progress"
          ? "in_progress"
          : mutation.status ?? task.status;
  }

  if (task.status !== "done" && nextStatus === "done") {
    nextReadinessDelta = task.readiness_delta > 0 ? task.readiness_delta : getTaskReadinessDelta(task.priority);
    readinessDelta += nextReadinessDelta;
  }

  if (task.status === "done" && nextStatus !== "done" && task.readiness_delta > 0) {
    readinessDelta -= task.readiness_delta;
    nextReadinessDelta = 0;
  }

  await client.query(
    `
      update public.team_tasks
      set
        status = $2,
        assignee_member_id = coalesce($3, assignee_member_id),
        readiness_delta = $4
      where id = $1
    `,
    [taskId, nextStatus, assigneeId, nextReadinessDelta],
  );

  return readinessDelta;
}

async function applyArtifactMutation(
  client: PoolClient,
  teamSessionId: string,
  mutation: {
    action: "create" | "update";
    artifactId?: string | null;
    artifactType?: TeamArtifact["artifactType"] | null;
    title?: string | null;
    summary?: string | null;
    body?: string | null;
    status?: TeamArtifact["status"] | null;
    sourceTaskTitle?: string | null;
  },
) {
  if (mutation.action === "create") {
    let sourceTaskId: string | null = null;

    if (mutation.sourceTaskTitle) {
      const taskResult = await client.query<{ id: string }>(
        `
          select id
          from public.team_tasks
          where team_session_id = $1
            and title = $2
          order by created_at desc
          limit 1
        `,
        [teamSessionId, mutation.sourceTaskTitle],
      );

      sourceTaskId = taskResult.rows[0]?.id ?? null;
    }

    await insertTeamArtifacts(client, teamSessionId, [
      {
        artifactType: mutation.artifactType ?? "brief",
        title: mutation.title ?? "새 작업물",
        summary: mutation.summary ?? "",
        body: mutation.body ?? "",
        status: mutation.status ?? "draft",
        sourceTaskId,
      },
    ]);

    return mutation.status === "ready" ? TEAM_ARTIFACT_READY_DELTA : 0;
  }

  if (!mutation.artifactId) {
    return 0;
  }

  const currentArtifact = await client.query<TeamArtifactRow>(
    `
      select *
      from public.team_artifacts
      where id = $1
        and team_session_id = $2
      limit 1
    `,
    [mutation.artifactId, teamSessionId],
  );

  const artifact = currentArtifact.rows[0];

  if (!artifact) {
    return 0;
  }

  const nextStatus = mutation.status ?? artifact.status;
  let readinessDelta = 0;

  if (artifact.status !== "ready" && nextStatus === "ready") {
    readinessDelta += TEAM_ARTIFACT_READY_DELTA;
  }

  if (artifact.status === "ready" && nextStatus !== "ready") {
    readinessDelta -= TEAM_ARTIFACT_READY_DELTA;
  }

  await client.query(
    `
      update public.team_artifacts
      set
        title = coalesce($2, title),
        summary = coalesce($3, summary),
        body = coalesce($4, body),
        status = $5
      where id = $1
    `,
    [mutation.artifactId, mutation.title, mutation.summary, mutation.body, nextStatus],
  );

  return readinessDelta;
}

export async function simulateContestTeamTurn(input: {
  contestId: string;
  teamSessionId: string;
  userId: string;
  message?: string | null;
  quickAction?: string | null;
}) {
  const pool = getDbPool();
  const client = await pool.connect();
  let progressTracker: ReturnType<typeof createDetachedProgressTracker> | null = null;

  try {
    await client.query("begin");
    const row = await getTeamSessionRowById(client, input.teamSessionId, input.contestId, input.userId);

    if (!row) {
      throw new Error("팀 세션을 찾을 수 없습니다.");
    }

    const access = await resolveTeamAccess(input.contestId, row.ideation_session_id, input.userId);

    if (!access) {
      throw new Error("이 팀 세션에는 접근할 수 없습니다.");
    }

    const currentSession = await readTeamSessionSnapshot(client, row);
    const activeMembersByKey = buildMemberMapByKey(currentSession.members);
    let readinessScore = row.readiness_score;
    let toast = "";

    if (input.quickAction) {
      const kickoffOption = currentSession.kickoffOptions.find((option) => option.id === input.quickAction);

      if (kickoffOption) {
        await insertTeamMessages(client, row.id, [
          {
            authorType: "user",
            body: kickoffOption.label,
            messageKind: "chat",
          },
        ]);

        if (!row.kickoff_choice) {
          readinessScore = clampReadinessScore(readinessScore + TEAM_KICKOFF_READINESS_DELTA);
          await insertScoreEvent(client, row.id, "첫 방향 선택", TEAM_KICKOFF_READINESS_DELTA);
          toast = "첫 방향을 정해서 우승 준비도가 올랐어요.";
        }

        await updateTeamSessionRow(client, row.id, {
          kickoffChoice: input.quickAction,
          readinessScore,
        });
      }
    } else if (input.message?.trim()) {
      await insertTeamMessages(client, row.id, [
        {
          authorType: "user",
          body: input.message.trim(),
          messageKind: "chat",
        },
      ]);
    }

    const refreshedBeforeRemote = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!refreshedBeforeRemote) {
      throw new Error("팀 세션을 다시 읽지 못했습니다.");
    }

    const latestSession = await readTeamSessionSnapshot(client, refreshedBeforeRemote);
    const leadMember = latestSession.members.find((member) => member.isActive);

    progressTracker = createDetachedProgressTracker({
      teamSessionId: row.id,
      title: input.quickAction ? "첫 방향 기반으로 팀 움직이는 중" : "AI 팀이 다음 액션을 만드는 중",
      source: "ai",
      actorMemberId: leadMember?.id ?? null,
      actorLabel: leadMember?.name ?? "AI 팀원",
      actorRole: leadMember?.role ?? null,
      steps: input.quickAction
        ? [
            "공고와 확정 아이디어를 다시 읽는 중",
            "가장 먼저 밀어야 할 역할과 태스크를 정리하는 중",
            "작업물 카드까지 이어질 다음 액션을 맞추는 중",
          ]
        : [
            "방금 보낸 메시지를 팀 전체 문맥에 반영하는 중",
            "가장 잘 맞는 팀원이 먼저 답할 내용을 고르는 중",
            "다음 태스크와 작업물까지 같이 정리하는 중",
          ],
    });

    const remoteTurn = canUseRemoteContestTeamService()
      ? await simulateContestTeamTurnWithRemoteService({
          contest: access.contest,
          handoff: access.handoff,
          teamState: {
            teamName: latestSession.teamName,
            teamIntro: latestSession.teamIntro,
            currentFocus: latestSession.currentFocus,
            kickoffChoice: latestSession.kickoffChoice,
            readinessScore: latestSession.readinessScore,
            members: latestSession.members.filter((member) => member.isActive),
            tasks: latestSession.tasks,
            artifacts: latestSession.artifacts,
          },
          lastMessages: latestSession.messages,
          userAction: {
            message: input.message,
            quickAction: input.quickAction,
          },
        }).catch((error) => {
          logRemoteAiFallback("contest-team:turn", error, {
            contestSlug: access.contest.slug,
            quickAction: input.quickAction ?? null,
            hasMessage: Boolean(input.message?.trim()),
          });
          return simulateFallbackTeamTurn({
            contest: access.contest,
            handoff: access.handoff,
            teamState: {
              members: latestSession.members,
              tasks: latestSession.tasks,
              artifacts: latestSession.artifacts,
              kickoffChoice: latestSession.kickoffChoice,
            },
            lastMessages: latestSession.messages,
            userAction: {
              message: input.message,
              quickAction: input.quickAction,
            },
          });
        })
      : simulateFallbackTeamTurn({
          contest: access.contest,
          handoff: access.handoff,
          teamState: {
            members: latestSession.members,
            tasks: latestSession.tasks,
            artifacts: latestSession.artifacts,
            kickoffChoice: latestSession.kickoffChoice,
          },
          lastMessages: latestSession.messages,
          userAction: {
            message: input.message,
            quickAction: input.quickAction,
          },
        });

    const activeMembers = await readTeamSessionSnapshot(client, refreshedBeforeRemote);
    const activeMembersMap = buildMemberMapByKey(activeMembers.members);

    for (const mutation of remoteTurn.taskMutations ?? []) {
      const delta = await applyTaskMutation(client, row.id, mutation, activeMembersMap);

      if (delta !== 0) {
        readinessScore = clampReadinessScore(readinessScore + delta);
        await insertScoreEvent(client, row.id, delta > 0 ? "태스크 완료" : "태스크 상태 조정", delta);
      }
    }

    for (const mutation of remoteTurn.artifactMutations ?? []) {
      const delta = await applyArtifactMutation(client, row.id, mutation);

      if (delta !== 0) {
        readinessScore = clampReadinessScore(readinessScore + delta);
        await insertScoreEvent(client, row.id, delta > 0 ? "작업물 준비 완료" : "작업물 상태 조정", delta);
      }
    }

    const memberMapAfterMutations = buildMemberMapByKey((await readTeamSessionSnapshot(client, refreshedBeforeRemote)).members);
    await insertTeamMessages(
      client,
      row.id,
      (remoteTurn.messages ?? []).map((message) => ({
        authorType: message.authorType,
        memberId: message.memberKey ? memberMapAfterMutations.get(message.memberKey)?.id ?? null : null,
        body: message.body,
        messageKind: message.messageKind,
      })),
    );

    if (remoteTurn.coachSummary) {
      await insertTeamMessages(client, row.id, [
        {
          authorType: "system",
          body: remoteTurn.coachSummary,
          messageKind: "summary",
        },
      ]);
    }

    await insertTeamActivityEvent(client, row.id, {
      title: input.quickAction ? "킥오프 방향 반영 완료" : "팀 응답 정리 완료",
      detail: remoteTurn.coachSummary ?? "팀 메시지와 다음 액션을 같이 정리했어요.",
      state: "completed",
      source: "ai",
      actorMemberId: leadMember?.id ?? null,
      actorLabel: leadMember?.name ?? "AI 팀원",
      actorRole: leadMember?.role ?? null,
    });

    const finalRow = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!finalRow) {
      throw new Error("팀 세션을 다시 읽지 못했습니다.");
    }

    const finalSessionSnapshot = await readTeamSessionSnapshot(client, finalRow);
    const currentFocus = resolveCurrentFocus(finalSessionSnapshot.tasks);
    await updateTeamSessionRow(client, row.id, {
      readinessScore,
      currentFocus,
    });

    const updatedRow = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!updatedRow) {
      throw new Error("팀 세션을 다시 읽지 못했습니다.");
    }

    const teamSession = await readTeamSessionSnapshot(client, updatedRow);
    await client.query("commit");
    await progressTracker?.complete(remoteTurn.coachSummary ?? "팀이 다음 액션과 작업 흐름을 정리했어요.");

    return {
      teamSession,
      handoff: access.handoff,
      kickoffOptions: teamSession.kickoffOptions,
      coachSummary: remoteTurn.coachSummary ?? null,
      toast: toast || "팀이 바로 다음 액션까지 정리했어요.",
    } satisfies TeamSimulationTurnResponse;
  } catch (error) {
    await client.query("rollback");
    await progressTracker?.fail("팀 응답을 만드는 중 문제가 생겼어요.");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateContestTeamTask(input: {
  contestId: string;
  teamSessionId: string;
  userId: string;
  action: "assign" | "move" | "complete";
  taskId: string;
  assigneeMemberId?: string | null;
  status?: TeamTaskStatus;
}) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const row = await getTeamSessionRowById(client, input.teamSessionId, input.contestId, input.userId);

    if (!row) {
      throw new Error("팀 세션을 찾을 수 없습니다.");
    }

    const access = await resolveTeamAccess(input.contestId, row.ideation_session_id, input.userId);

    if (!access) {
      throw new Error("이 팀 세션에는 접근할 수 없습니다.");
    }

    const beforeTaskResult = await client.query<TeamTaskRow>(
      `
        select *
        from public.team_tasks
        where id = $1
          and team_session_id = $2
        limit 1
      `,
      [input.taskId, row.id],
    );

    const task = beforeTaskResult.rows[0];

    if (!task) {
      throw new Error("태스크를 찾을 수 없습니다.");
    }

    let delta = 0;

    if (input.action === "assign") {
      await client.query(
        `
          update public.team_tasks
          set assignee_member_id = $2
          where id = $1
        `,
        [input.taskId, input.assigneeMemberId ?? null],
      );
    }

    if (input.action === "move" || input.action === "complete") {
      const nextStatus =
        input.action === "complete"
          ? "done"
          : input.status === "in_progress"
            ? "in_progress"
            : input.status ?? mapTaskStatus(task.status);

      let nextDelta = task.readiness_delta;

      if (task.status !== "done" && nextStatus === "done") {
        nextDelta = task.readiness_delta > 0 ? task.readiness_delta : getTaskReadinessDelta(task.priority);
        delta += nextDelta;
      }

      if (task.status === "done" && nextStatus !== "done" && task.readiness_delta > 0) {
        delta -= task.readiness_delta;
        nextDelta = 0;
      }

      await client.query(
        `
          update public.team_tasks
          set status = $2,
              readiness_delta = $3
          where id = $1
        `,
        [input.taskId, nextStatus === "in_progress" ? "in_progress" : nextStatus, nextDelta],
      );
    }

    const score = clampReadinessScore(row.readiness_score + delta);

    if (delta !== 0) {
      await insertScoreEvent(client, row.id, delta > 0 ? "태스크 완료" : "태스크 되돌림", delta);
    }

    await insertTeamActivityEvent(client, row.id, {
      title: input.action === "complete" ? "태스크 완료 반영" : "태스크 상태 업데이트",
      detail:
        input.action === "complete"
          ? `${task.title} 작업을 완료로 반영했어요.`
          : `${task.title} 작업 흐름을 업데이트했어요.`,
      state: "completed",
      source: "user",
      actorLabel: "나",
      actorRole: "팀 리드",
    });

    const refreshedRow = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!refreshedRow) {
      throw new Error("팀 세션을 다시 읽지 못했습니다.");
    }

    const refreshedSession = await readTeamSessionSnapshot(client, refreshedRow);
    await updateTeamSessionRow(client, row.id, {
      readinessScore: score,
      currentFocus: resolveCurrentFocus(refreshedSession.tasks),
    });

    const updatedRow = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!updatedRow) {
      throw new Error("팀 세션을 다시 읽지 못했습니다.");
    }

    const teamSession = await readTeamSessionSnapshot(client, updatedRow);
    await client.query("commit");

    return {
      teamSession,
      handoff: access.handoff,
      kickoffOptions: teamSession.kickoffOptions,
      coachSummary: null,
      toast: input.action === "complete" ? "태스크를 완료 처리했어요." : "팀 할 일을 업데이트했어요.",
    } satisfies TeamSimulationTurnResponse;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createContestTeamArtifact(input: {
  contestId: string;
  teamSessionId: string;
  userId: string;
  artifactType: TeamArtifact["artifactType"];
  title: string;
  summary: string;
  body: string;
  status?: TeamArtifact["status"];
  sourceTaskId?: string | null;
}) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const row = await getTeamSessionRowById(client, input.teamSessionId, input.contestId, input.userId);

    if (!row) {
      throw new Error("팀 세션을 찾을 수 없습니다.");
    }

    const access = await resolveTeamAccess(input.contestId, row.ideation_session_id, input.userId);

    if (!access) {
      throw new Error("이 팀 세션에는 접근할 수 없습니다.");
    }

    await insertTeamArtifacts(client, row.id, [
      {
        artifactType: input.artifactType,
        title: input.title,
        summary: input.summary,
        body: input.body,
        status: input.status ?? "draft",
        sourceTaskId: input.sourceTaskId ?? null,
      },
    ]);

    let readinessScore = row.readiness_score;

    if ((input.status ?? "draft") === "ready") {
      readinessScore = clampReadinessScore(readinessScore + TEAM_ARTIFACT_READY_DELTA);
      await insertScoreEvent(client, row.id, "작업물 준비 완료", TEAM_ARTIFACT_READY_DELTA);
    }

    await insertTeamActivityEvent(client, row.id, {
      title: "작업물 카드 추가",
      detail: `${input.title} 작업물을 팀 작업 흐름에 추가했어요.`,
      state: "completed",
      source: "user",
      actorLabel: "나",
      actorRole: "팀 리드",
    });

    const refreshedRow = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!refreshedRow) {
      throw new Error("팀 세션을 다시 읽지 못했습니다.");
    }

    const refreshedSession = await readTeamSessionSnapshot(client, refreshedRow);
    await updateTeamSessionRow(client, row.id, {
      readinessScore,
      currentFocus: resolveCurrentFocus(refreshedSession.tasks),
    });

    const updatedRow = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!updatedRow) {
      throw new Error("팀 세션을 다시 읽지 못했습니다.");
    }

    const teamSession = await readTeamSessionSnapshot(client, updatedRow);
    await client.query("commit");

    return {
      teamSession,
      handoff: access.handoff,
      kickoffOptions: teamSession.kickoffOptions,
      coachSummary: null,
      toast: "새 작업물 카드를 추가했어요.",
    } satisfies TeamSimulationTurnResponse;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function completeContestTeamSession(input: {
  contestId: string;
  teamSessionId: string;
  userId: string;
}) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    const row = await getTeamSessionRowById(client, input.teamSessionId, input.contestId, input.userId);

    if (!row) {
      throw new Error("팀 세션을 찾을 수 없습니다.");
    }

    const access = await resolveTeamAccess(input.contestId, row.ideation_session_id, input.userId);

    if (!access) {
      throw new Error("이 팀 세션에는 접근할 수 없습니다.");
    }

    await updateTeamSessionRow(client, row.id, {
      status: "completed",
      readinessScore: clampReadinessScore(Math.max(row.readiness_score, 90)),
    });
    await insertTeamMessages(client, row.id, [
      {
        authorType: "system",
        body: "이번 팀 준비 세션을 완료로 표시했어요. 이제 제출 직전 정리만 남았습니다.",
        messageKind: "summary",
      },
    ]);
    await insertTeamActivityEvent(client, row.id, {
      title: "팀 준비 세션 완료",
      detail: "이번 공모전 준비 세션을 마감 상태로 표시했어요.",
      state: "completed",
      source: "system",
      actorLabel: "팀 코치",
      actorRole: "시스템",
    });

    const updatedRow = await getTeamSessionRowById(client, row.id, input.contestId, input.userId);

    if (!updatedRow) {
      throw new Error("팀 세션을 다시 읽지 못했습니다.");
    }

    const teamSession = await readTeamSessionSnapshot(client, updatedRow);
    await client.query("commit");

    return {
      teamSession,
      handoff: access.handoff,
      kickoffOptions: teamSession.kickoffOptions,
      coachSummary: "팀 준비를 완료 상태로 표시했습니다.",
      toast: "팀 준비 세션을 완료 처리했어요.",
    } satisfies TeamSimulationTurnResponse;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
