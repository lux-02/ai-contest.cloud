import type {
  TeamArtifact,
  TeamKickoffOption,
  TeamMilestone,
  TeamSession,
  TeamTask,
  TeamTaskPriority,
} from "@/types/contest";

export const teamKickoffOptions: TeamKickoffOption[] = [
  {
    id: "refine-idea",
    label: "아이디어 더 구체화",
    description: "핵심 메시지와 심사 포인트를 먼저 또렷하게 잡아요.",
  },
  {
    id: "split-roles",
    label: "역할부터 나누기",
    description: "누가 무엇을 맡을지 빠르게 정리하고 시작해요.",
  },
  {
    id: "build-now",
    label: "바로 결과물 만들기",
    description: "데모나 기획서 초안을 먼저 뽑아보면서 감을 잡아요.",
  },
];

export const TEAM_BOOTSTRAP_READINESS = 25;
export const TEAM_KICKOFF_READINESS_DELTA = 10;
export const TEAM_ARTIFACT_READY_DELTA = 10;

const TEAM_TASK_PRIORITY_DELTAS: Record<TeamTaskPriority, number> = {
  high: 8,
  medium: 5,
  low: 3,
};

export function getTaskReadinessDelta(priority: TeamTaskPriority) {
  return TEAM_TASK_PRIORITY_DELTAS[priority];
}

export function clampReadinessScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function toTimestamp(value: string | Date | null | undefined) {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  }

  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function resolveCurrentFocus(tasks: TeamTask[]) {
  const pending = tasks.filter((task) => task.status !== "done");

  if (pending.length === 0) {
    return "지금은 큰 급한 일이 없습니다. 작업물을 다듬고 제출 직전 점검만 하면 됩니다.";
  }

  const pickLatest = (priority: TeamTaskPriority) =>
    pending
      .filter((task) => task.priority === priority)
      .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))[0];

  return (
    pickLatest("high")?.title ??
    pickLatest("medium")?.title ??
    pickLatest("low")?.title ??
    pending[0]?.title ??
    null
  );
}

export function buildTeamMilestones(teamSession: TeamSession): TeamMilestone[] {
  const activeMembers = teamSession.members.filter((member) => member.isActive);
  const readyArtifacts = teamSession.artifacts.filter((artifact) => artifact.status === "ready");
  const startedTasks = teamSession.tasks.filter((task) => task.status !== "todo");
  const completedTasks = teamSession.tasks.filter((task) => task.status === "done");

  return [
    {
      id: "team-ready",
      label: "팀 구성 완료",
      done: activeMembers.length >= 4,
    },
    {
      id: "kickoff",
      label: "킥오프 방향 선택",
      done: Boolean(teamSession.kickoffChoice),
    },
    {
      id: "tasks-started",
      label: "핵심 작업 시작",
      done: startedTasks.length > 0,
    },
    {
      id: "artifact-ready",
      label: "결과물 카드 준비",
      done: readyArtifacts.length > 0,
    },
    {
      id: "submission-ready",
      label: "제출 직전 점검",
      done: completedTasks.length >= 3 || teamSession.readinessScore >= 80,
    },
  ];
}

export function buildTeamCompletionSummary(teamSession: TeamSession) {
  const activeMembers = teamSession.members.filter((member) => member.isActive);
  const doneTasks = teamSession.tasks.filter((task) => task.status === "done").length;
  const readyArtifacts = teamSession.artifacts.filter((artifact) => artifact.status === "ready").length;

  return `${activeMembers.length}명 역할 배치 완료 · 완료 태스크 ${doneTasks}개 · 준비된 작업물 ${readyArtifacts}개`;
}

export function getArtifactReadyDelta(artifact: TeamArtifact) {
  return artifact.status === "ready" ? TEAM_ARTIFACT_READY_DELTA : 0;
}
