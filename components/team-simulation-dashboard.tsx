"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  FaArrowLeft,
  FaArrowRotateRight,
  FaBolt,
  FaCheck,
  FaChevronRight,
  FaCommentDots,
  FaLayerGroup,
  FaPaperPlane,
  FaUserPlus,
  FaUsers,
  FaWandMagicSparkles,
} from "react-icons/fa6";

import { cn, getDaysUntil } from "@/lib/utils";
import type {
  Contest,
  TeamActivityEvent,
  TeamBootstrapResponse,
  TeamMember,
  TeamScoreEvent,
  TeamSimulationTurnResponse,
  TeamTask,
} from "@/types/contest";

type MainTab = "chat" | "artifacts" | "tasks";
type MobilePanel = "team" | "workspace" | "status";
type PendingActionKind =
  | "kickoff"
  | "chat"
  | "regenerate-all"
  | "regenerate-single"
  | "claim-role"
  | "task-move"
  | "task-complete"
  | "complete-session";

type PendingDescriptor = {
  kind: PendingActionKind;
  memberName?: string;
  taskTitle?: string;
};

type PendingActivityState = {
  id: string;
  title: string;
  steps: string[];
  index: number;
};

type TeamSimulationDashboardProps = {
  contest: Contest;
  viewerLabel: string;
  initialData: TeamBootstrapResponse;
};

function formatRelativeDate(value?: string) {
  if (!value) {
    return "일정 미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getReadinessTone(score: number) {
  if (score >= 70) {
    return "text-[var(--success)]";
  }

  if (score >= 41) {
    return "text-[var(--warning)]";
  }

  return "text-[var(--danger)]";
}

function getPriorityLabel(priority: TeamTask["priority"]) {
  if (priority === "high") {
    return "중요";
  }

  if (priority === "medium") {
    return "보통";
  }

  return "가벼움";
}

function getTaskStatusLabel(status: TeamTask["status"]) {
  if (status === "in_progress") {
    return "진행 중";
  }

  if (status === "done") {
    return "완료";
  }

  return "해야 할 일";
}

function getMemberStatusLabel(status: TeamMember["status"]) {
  if (status === "working") {
    return "작업 중";
  }

  if (status === "resting") {
    return "정리 중";
  }

  return "온라인";
}

function getMemberStatusClass(status: TeamMember["status"]) {
  if (status === "working") {
    return "bg-[var(--warning)]";
  }

  if (status === "resting") {
    return "bg-[#7ba0d8]";
  }

  return "bg-[var(--success)]";
}

function buildPendingActivity(descriptor: PendingDescriptor): PendingActivityState {
  const memberName = descriptor.memberName ?? "AI 팀원";
  const taskTitle = descriptor.taskTitle ?? "현재 작업";

  const table: Record<PendingActionKind, { title: string; steps: string[] }> = {
    kickoff: {
      title: "첫 작업 방향 정리 중",
      steps: [
        "공고와 확정 아이디어를 다시 읽는 중",
        "지금 시작하기 좋은 역할 분담을 고르는 중",
        "바로 움직일 첫 태스크를 정리하는 중",
      ],
    },
    chat: {
      title: "AI 팀이 답변을 만드는 중",
      steps: [
        "방금 보낸 메시지를 팀 전체에 공유하는 중",
        "가장 잘 맞는 팀원이 먼저 답할 준비를 하는 중",
        "다음 태스크와 작업물 후보를 정리하는 중",
      ],
    },
    "regenerate-all": {
      title: "팀 구성을 다시 짜는 중",
      steps: [
        "심사 기준과 제출물을 다시 훑어보는 중",
        "이 공모전에 더 맞는 역할 조합을 고르는 중",
        "새 킥오프와 첫 작업 흐름을 맞추는 중",
      ],
    },
    "regenerate-single": {
      title: `${memberName} 역할을 다시 고르는 중`,
      steps: [
        `${memberName} 역할에 필요한 기여를 다시 정리하는 중`,
        "겹치지 않는 새로운 팀원을 찾는 중",
        "새 역할을 전체 플로우에 맞춰 끼워 넣는 중",
      ],
    },
    "claim-role": {
      title: `${memberName} 역할을 내 역할로 반영 중`,
      steps: [
        "사용자가 맡는 역할로 팀 구성을 다시 보는 중",
        "남은 AI 역할을 다시 정리하는 중",
        "이후 태스크 우선순위를 다시 맞추는 중",
      ],
    },
    "task-move": {
      title: `${taskTitle} 진행 상태 업데이트 중`,
      steps: [
        "현재 담당자와 진행 단계를 다시 기록하는 중",
        "다음으로 밀어야 할 작업을 다시 계산하는 중",
        "우승 준비도와 급한 일을 다시 정리하는 중",
      ],
    },
    "task-complete": {
      title: `${taskTitle} 완료 반영 중`,
      steps: [
        "완료된 작업 결과를 팀 상태에 반영하는 중",
        "준비도 상승과 다음 우선순위를 계산하는 중",
        "새로 열어야 할 작업이나 작업물을 정리하는 중",
      ],
    },
    "complete-session": {
      title: "이번 준비 세션을 마무리하는 중",
      steps: [
        "지금까지 만든 결과물을 다시 정리하는 중",
        "완료 마일스톤과 준비도를 마감 상태로 맞추는 중",
        "다음 제출 단계에 필요한 요약을 남기는 중",
      ],
    },
  };

  const config = table[descriptor.kind];

  return {
    id: `${descriptor.kind}-${Date.now()}`,
    title: config.title,
    steps: config.steps,
    index: 0,
  };
}

function mergeActivityEvents(current: TeamActivityEvent[], incoming: TeamActivityEvent[]) {
  const next = [...current];
  const seen = new Set(current.map((event) => event.id));

  for (const event of incoming) {
    if (seen.has(event.id)) {
      continue;
    }

    next.unshift(event);
    seen.add(event.id);
  }

  return next.sort((left, right) => right.sequence - left.sequence).slice(0, 8);
}

function TaskColumn({
  title,
  tasks,
  empty,
  onStart,
  onComplete,
}: {
  title: string;
  tasks: TeamTask[];
  empty: string;
  onStart: (taskId: string) => void;
  onComplete: (taskId: string) => void;
}) {
  return (
    <div className="team-kanban-column">
      <div className="team-kanban-title">{title}</div>
      {tasks.length ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <article key={task.id} className="team-task-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{task.title}</div>
                  <div className="mt-2 text-xs leading-6 text-[var(--muted)]">{task.description}</div>
                </div>
                <span className="team-task-pill">{getPriorityLabel(task.priority)}</span>
              </div>
              <div className="mt-3 text-[11px] text-[var(--muted)]">
                {task.assigneeLabel ? `${task.assigneeLabel} · ` : ""}{getTaskStatusLabel(task.status)}
              </div>
              {task.status === "todo" ? (
                <button type="button" onClick={() => onStart(task.id)} className="secondary-button mt-4 w-full">
                  시작하기
                </button>
              ) : null}
              {task.status === "in_progress" ? (
                <button type="button" onClick={() => onComplete(task.id)} className="primary-button mt-4 w-full">
                  완료 처리
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="team-empty-state">{empty}</div>
      )}
    </div>
  );
}

export function TeamSimulationDashboard({
  contest,
  viewerLabel,
  initialData,
}: TeamSimulationDashboardProps) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<MainTab>("chat");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("workspace");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<string | null>(initialData.coachSummary ?? null);
  const [error, setError] = useState<string | null>(null);
  const [showIntroOverlay, setShowIntroOverlay] = useState(Boolean(initialData.justBootstrapped));
  const [pendingActivity, setPendingActivity] = useState<PendingActivityState | null>(null);
  const [activityEvents, setActivityEvents] = useState<TeamActivityEvent[]>(initialData.teamSession.activityEvents ?? []);
  const [isPending, startTransition] = useTransition();
  const activityCursorRef = useRef(initialData.teamSession.activityEvents?.[0]?.sequence ?? 0);

  const teamSession = data.teamSession;
  const activeMembers = useMemo(
    () => teamSession.members.filter((member) => member.isActive),
    [teamSession.members],
  );
  const featuredMember = activeMembers[0];
  const daysUntilDeadline = getDaysUntil(contest.deadline);
  const todoTasks = teamSession.tasks.filter((task) => task.status === "todo");
  const doingTasks = teamSession.tasks.filter((task) => task.status === "in_progress");
  const doneTasks = teamSession.tasks.filter((task) => task.status === "done");
  const kickoffNotStarted = !teamSession.kickoffChoice;
  const pendingActivityId = pendingActivity?.id;

  const replaceActivityEvents = (nextEvents: TeamActivityEvent[]) => {
    activityCursorRef.current = nextEvents[0]?.sequence ?? activityCursorRef.current;
    setActivityEvents(nextEvents);
  };

  const appendActivityEvents = (incoming: TeamActivityEvent[]) => {
    setActivityEvents((current) => {
      const next = mergeActivityEvents(current, incoming);
      activityCursorRef.current = next[0]?.sequence ?? activityCursorRef.current;
      return next;
    });
  };

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!pendingActivityId) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setPendingActivity((current) => {
        if (!current) {
          return null;
        }

        if (current.index >= current.steps.length - 1) {
          return current;
        }

        return {
          ...current,
          index: current.index + 1,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [pendingActivityId]);

  useEffect(() => {
    const initialSequence = activityCursorRef.current;
    const source = new EventSource(
      `/api/team/${contest.id}/events?teamSessionId=${teamSession.id}&afterSequence=${initialSequence}`,
    );

    source.addEventListener("team-activity", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as TeamActivityEvent;
        appendActivityEvents([payload]);
      } catch {
        return;
      }
    });

    source.addEventListener("team-error", () => {
      setError("실시간 작업 현황 연결이 잠시 불안정합니다.");
    });

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [contest.id, teamSession.id]);

  async function handleApi<T extends TeamSimulationTurnResponse | TeamBootstrapResponse>(
    endpoint: string,
    body: Record<string, unknown>,
    pendingDescriptor?: PendingDescriptor,
    onSuccess?: (payload: T) => void,
  ) {
    setError(null);
    const currentPending = pendingDescriptor ? buildPendingActivity(pendingDescriptor) : null;

    if (currentPending) {
      setPendingActivity(currentPending);
    }

    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

        if (!response.ok) {
          setPendingActivity(null);
          setError(payload?.error ?? "팀 시뮬레이션을 처리하지 못했습니다.");
          return;
        }

        if ("teamSession" in (payload ?? {})) {
          const nextPayload = (payload as T) as TeamBootstrapResponse;
          setData(nextPayload);
          replaceActivityEvents(nextPayload.teamSession.activityEvents ?? []);
        }

        const nextToast = (payload as TeamSimulationTurnResponse | null)?.toast ?? null;

        if (nextToast) {
          setToast(nextToast);
        }

        setPendingActivity(null);

        onSuccess?.(payload as T);
      } catch {
        setPendingActivity(null);
        setError("팀 시뮬레이션을 처리하지 못했습니다.");
      }
    });
  }

  function handleKickoff(optionId: string) {
    void handleApi<TeamSimulationTurnResponse>(`/api/team/${contest.id}/chat`, {
      teamSessionId: teamSession.id,
      quickAction: optionId,
    }, { kind: "kickoff" });
  }

  function handleSendMessage() {
    if (!message.trim()) {
      return;
    }

    const nextMessage = message.trim();
    setMessage("");
    void handleApi<TeamSimulationTurnResponse>(`/api/team/${contest.id}/chat`, {
      teamSessionId: teamSession.id,
      message: nextMessage,
    }, { kind: "chat" });
  }

  function handleRegenerateAll() {
    void handleApi<TeamSimulationTurnResponse>(`/api/team/${contest.id}/regenerate`, {
      teamSessionId: teamSession.id,
      mode: "all",
    }, { kind: "regenerate-all" });
  }

  function handleRegenerateSingle(memberId: string) {
    const memberName = activeMembers.find((member) => member.id === memberId)?.name;
    void handleApi<TeamSimulationTurnResponse>(`/api/team/${contest.id}/regenerate`, {
      teamSessionId: teamSession.id,
      mode: "single",
      memberId,
    }, { kind: "regenerate-single", memberName });
  }

  function handleClaimRole(memberId: string) {
    const memberName = activeMembers.find((member) => member.id === memberId)?.name;
    void handleApi<TeamSimulationTurnResponse>(`/api/team/${contest.id}/regenerate`, {
      teamSessionId: teamSession.id,
      mode: "claim",
      memberId,
    }, { kind: "claim-role", memberName });
  }

  function handleTaskMove(taskId: string, status: TeamTask["status"]) {
    const taskTitle = teamSession.tasks.find((task) => task.id === taskId)?.title;
    void handleApi<TeamSimulationTurnResponse>(`/api/team/${contest.id}/tasks`, {
      teamSessionId: teamSession.id,
      taskId,
      action: "move",
      status,
    }, { kind: "task-move", taskTitle });
  }

  function handleTaskComplete(taskId: string) {
    const taskTitle = teamSession.tasks.find((task) => task.id === taskId)?.title;
    void handleApi<TeamSimulationTurnResponse>(`/api/team/${contest.id}/tasks`, {
      teamSessionId: teamSession.id,
      taskId,
      action: "complete",
    }, { kind: "task-complete", taskTitle });
  }

  function handleCompleteTeam() {
    void handleApi<TeamSimulationTurnResponse>(`/api/team/${contest.id}/complete`, {
      teamSessionId: teamSession.id,
    }, { kind: "complete-session" });
  }

  const workspace = (
    <div className="team-dashboard-center">
      <div className="team-workspace-tabs">
        {[
          { id: "chat", label: "채팅", icon: FaCommentDots },
          { id: "artifacts", label: "작업물", icon: FaLayerGroup },
          { id: "tasks", label: "할 일", icon: FaCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as MainTab)}
              className={cn("team-tab-button", isActive && "is-active")}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "chat" ? (
        <div className="team-chat-surface">
          {kickoffNotStarted ? (
            <div className="team-kickoff-card">
              <div className="text-sm font-semibold text-[var(--foreground)]">첫 방향만 고르면 AI 팀이 바로 움직입니다.</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {featuredMember?.name ?? "AI 팀장"}이 먼저 팀을 열어둘게요. 무엇부터 시작할지 하나만 골라주세요.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.kickoffOptions.map((option) => (
                  <button key={option.id} type="button" onClick={() => handleKickoff(option.id)} className="secondary-button">
                    <FaBolt className="h-3.5 w-3.5" aria-hidden />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="team-chat-log">
            {teamSession.messages.map((entry) => (
              <article key={entry.id} className={cn("team-message-card", entry.authorType === "user" && "is-user", entry.authorType === "system" && "is-system")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{entry.speakerName}</div>
                    {entry.speakerRole ? <div className="mt-1 text-[11px] text-[var(--muted)]">{entry.speakerRole}</div> : null}
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">{formatEventTime(entry.createdAt)}</div>
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{entry.body}</p>
              </article>
            ))}
          </div>

          <div className="team-chat-composer">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="team-chat-textarea"
              rows={3}
              placeholder="예: 이 아이디어를 심사위원 입장에서 더 설득력 있게 만들고 싶어"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[var(--muted)]">AI 팀원은 답변과 함께 다음 태스크나 작업물 카드를 같이 제안합니다.</div>
              <button type="button" onClick={handleSendMessage} className="primary-button">
                <FaPaperPlane className="h-3.5 w-3.5" aria-hidden />
                메시지 보내기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "artifacts" ? (
        <div className="space-y-4">
          {teamSession.artifacts.length ? (
            teamSession.artifacts.map((artifact) => (
              <article key={artifact.id} className="team-artifact-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="team-artifact-label">{artifact.artifactType}</div>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">{artifact.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{artifact.summary}</p>
                  </div>
                  <span className={cn("team-status-pill", artifact.status === "ready" && "is-ready")}>
                    {artifact.status === "ready" ? "준비 완료" : "작성 중"}
                  </span>
                </div>
                <div className="mt-4 rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4 text-sm leading-7 text-[var(--foreground)] whitespace-pre-wrap">
                  {artifact.body}
                </div>
              </article>
            ))
          ) : (
            <div className="team-empty-state">아직 작업물 카드가 없습니다. 킥오프를 고르거나 채팅을 시작하면 카드가 생깁니다.</div>
          )}
        </div>
      ) : null}

      {activeTab === "tasks" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <TaskColumn
            title="해야 할 일"
            tasks={todoTasks}
            empty="막 열어둔 일은 여기 쌓입니다."
            onStart={(taskId) => handleTaskMove(taskId, "in_progress")}
            onComplete={handleTaskComplete}
          />
          <TaskColumn
            title="진행 중"
            tasks={doingTasks}
            empty="시작하면 이 칸으로 이동합니다."
            onStart={(taskId) => handleTaskMove(taskId, "in_progress")}
            onComplete={handleTaskComplete}
          />
          <TaskColumn
            title="완료"
            tasks={doneTasks}
            empty="완료한 일이 여기에 쌓입니다."
            onStart={(taskId) => handleTaskMove(taskId, "in_progress")}
            onComplete={handleTaskComplete}
          />
        </div>
      ) : null}
    </div>
  );

  const teamPanel = (
    <aside className="team-side-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Team</div>
          <div className="mt-2 text-xl font-semibold text-[var(--foreground)]">{teamSession.teamName}</div>
        </div>
        <button type="button" onClick={handleRegenerateAll} className="hero-action-button" aria-label="팀 다시 짜기">
          <FaArrowRotateRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{teamSession.teamIntro}</p>

      <div className="mt-5 space-y-3">
        <article className="team-member-card is-human">
          <div className="flex items-center gap-3">
            <div className="team-avatar">🙂</div>
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">{viewerLabel}</div>
              <div className="mt-1 text-[11px] text-[var(--muted)]">팀 리드 · 직접 판단하는 역할</div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-6 text-[var(--muted)]">중요한 선택은 직접 하고, AI 팀원이 속도를 올려주는 구조로 진행됩니다.</p>
        </article>

        {activeMembers.map((member) => (
          <article key={member.id} className="team-member-card">
            <div className="flex items-start gap-3">
              <div className="team-avatar">{member.name.slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-[var(--foreground)]">{member.name}</div>
                  <span className={cn("team-status-dot", getMemberStatusClass(member.status))} />
                </div>
                <div className="mt-1 text-[11px] text-[var(--muted)]">
                  {member.role} · {getMemberStatusLabel(member.status)}
                </div>
                <p className="mt-3 text-xs leading-6 text-[var(--muted)]">{member.introLine}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {member.skills.slice(0, 3).map((skill) => (
                    <span key={skill} className="team-skill-chip">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {member.isUserClaimed ? (
                <span className="team-status-pill is-ready">내가 맡음</span>
              ) : (
                <>
                  <button type="button" onClick={() => handleRegenerateSingle(member.id)} className="secondary-button flex-1">
                    <FaArrowRotateRight className="h-3.5 w-3.5" aria-hidden />
                    한 명 바꿔줘
                  </button>
                  <button type="button" onClick={() => handleClaimRole(member.id)} className="secondary-button flex-1">
                    <FaUserPlus className="h-3.5 w-3.5" aria-hidden />
                    내가 할게
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </aside>
  );

  const statusPanel = (
    <aside className="team-side-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Progress</div>
          <div className={cn("mt-2 text-3xl font-semibold", getReadinessTone(teamSession.readinessScore))}>
            {teamSession.readinessScore}%
          </div>
        </div>
        <div className="team-ring">
          <div className="team-ring-fill" style={{ ["--team-progress" as string]: `${teamSession.readinessScore}` }} />
          <div className="team-ring-label">우승 준비도</div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        {teamSession.completionSummary ?? "역할 균형과 작업 진척도를 같이 보고 있어요."}
      </p>

      <div className="team-focus-card mt-5">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">지금 가장 급한 일</div>
        <div className="mt-3 text-base font-semibold text-[var(--foreground)]">{teamSession.currentFocus ?? "첫 방향을 고르면 급한 일이 자동으로 정리됩니다."}</div>
      </div>

      <div className="mt-5 space-y-3">
        {(teamSession.milestones ?? []).map((milestone) => (
          <div key={milestone.id} className="team-milestone-row">
            <span className={cn("team-milestone-check", milestone.done && "is-done")}>{milestone.done ? "✓" : ""}</span>
            <span className={cn("text-sm", milestone.done ? "text-[var(--foreground)]" : "text-[var(--muted)]")}>{milestone.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">실시간 작업 현황</div>
        <div className="mt-3 rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
          {pendingActivity ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <span className="team-live-dot" />
                {pendingActivity.title}
              </div>
              <div className="space-y-2">
                {pendingActivity.steps.map((step, index) => (
                  <div
                    key={`${pendingActivity.id}-${step}`}
                    className={cn(
                      "team-activity-step",
                      index < pendingActivity.index && "is-done",
                      index === pendingActivity.index && "is-current",
                    )}
                  >
                    <span className="team-activity-index">{index + 1}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : activityEvents.length ? (
            <div className="space-y-2">
              {activityEvents.map((entry) => (
                <div key={entry.id} className={cn("team-activity-log", entry.state === "failed" && "is-error")}>
                  <span className="team-activity-log-dot" />
                  <div>
                    <div className="text-sm text-[var(--foreground)]">{entry.title}</div>
                    {entry.detail ? <div className="mt-1 text-[11px] text-[var(--muted)]">{entry.detail}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="team-empty-state">
              아직 실시간 로그가 없습니다. 킥오프를 누르거나 팀과 대화를 시작하면 AI가 어떤 작업을 진행 중인지 순서대로 보여줍니다.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">최근 상승 로그</div>
        <div className="mt-3 space-y-2">
          {(teamSession.scoreEvents.slice(-4) as TeamScoreEvent[]).reverse().map((event) => (
            <div key={event.id} className="team-score-event">
              <div className="text-sm text-[var(--foreground)]">{event.label}</div>
              <div className="text-sm font-semibold text-[var(--success)]">+{event.delta}</div>
            </div>
          ))}
          {teamSession.scoreEvents.length === 0 ? <div className="team-empty-state">아직 준비도 변화 로그가 없습니다.</div> : null}
        </div>
      </div>

      <button type="button" onClick={handleCompleteTeam} className="primary-button mt-6 w-full">
        <FaWandMagicSparkles className="h-3.5 w-3.5" aria-hidden />
        이번 준비 세션 완료하기
      </button>
    </aside>
  );

  return (
    <>
      <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-6 md:py-10">
        <header className="team-page-header">
          <div className="flex items-start gap-3">
            <Link href={`/contests/${contest.slug}`} className="hero-action-button shrink-0" aria-label="공모전 상세로 돌아가기">
              <FaArrowLeft className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <div className="min-w-0">
              <div className="eyebrow">Team Simulation</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-4xl">
                {contest.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                <span className="team-head-pill">{contest.organizer}</span>
                <span className="team-head-pill">{daysUntilDeadline === null ? "D-day 미정" : `D-${daysUntilDeadline}`}</span>
                <span className="team-head-pill">{formatRelativeDate(contest.deadline)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">우승 준비도</div>
              <div className={cn("mt-2 text-3xl font-semibold", getReadinessTone(teamSession.readinessScore))}>{teamSession.readinessScore}%</div>
              <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{teamSession.completionSummary}</div>
            </div>
            <div className="team-header-focus">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">가장 급한 일</div>
              <div className="mt-2 text-sm leading-6 text-[var(--foreground)]">{teamSession.currentFocus ?? "첫 방향을 고르면 급한 일이 정리됩니다."}</div>
            </div>
          </div>
        </header>

        {error ? <div className="team-error-banner mt-5">{error}</div> : null}

        <div className="mt-6 hidden gap-5 xl:grid xl:grid-cols-[320px_minmax(0,1fr)_300px]">
          {teamPanel}
          {workspace}
          {statusPanel}
        </div>

        <div className="mt-6 space-y-5 xl:hidden">
          <div className="team-mobile-switcher">
            <button type="button" onClick={() => setMobilePanel("workspace")} className={cn("team-tab-button", mobilePanel === "workspace" && "is-active")}>
              <FaCommentDots className="h-3.5 w-3.5" aria-hidden />
              작업 영역
            </button>
            <button type="button" onClick={() => setMobilePanel("team")} className={cn("team-tab-button", mobilePanel === "team" && "is-active")}>
              <FaUsers className="h-3.5 w-3.5" aria-hidden />
              팀원
            </button>
            <button type="button" onClick={() => setMobilePanel("status")} className={cn("team-tab-button", mobilePanel === "status" && "is-active")}>
              <FaWandMagicSparkles className="h-3.5 w-3.5" aria-hidden />
              현황
            </button>
          </div>

          {mobilePanel === "workspace" ? workspace : null}
          {mobilePanel === "team" ? teamPanel : null}
          {mobilePanel === "status" ? statusPanel : null}
        </div>
      </main>

      {showIntroOverlay ? (
        <div className="team-overlay" role="dialog" aria-modal="true" aria-labelledby="team-overlay-title">
          <div className="team-overlay-card">
            <div className="eyebrow">팀 구성 완료</div>
            <h2 id="team-overlay-title" className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
              {teamSession.teamName}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              {data.coachSummary ?? "이 공모전에 맞는 팀을 만들었어요. 역할이 마음에 들면 바로 시작하고, 아니면 한 번 더 조정할 수 있어요."}
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {activeMembers.map((member) => (
                <div key={member.id} className="team-overlay-member">
                  <div className="text-sm font-semibold text-[var(--foreground)]">{member.role}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{member.name} · {member.mainContribution}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => setShowIntroOverlay(false)} className="primary-button flex-1">
                <FaUsers className="h-3.5 w-3.5" aria-hidden />
                이 팀으로 시작하기
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstMember = activeMembers.find((member) => !member.isUserClaimed);

                  if (firstMember) {
                    handleRegenerateSingle(firstMember.id);
                  }
                }}
                className="secondary-button flex-1"
              >
                <FaWandMagicSparkles className="h-3.5 w-3.5" aria-hidden />
                한 명 바꿔줘
              </button>
              <button type="button" onClick={handleRegenerateAll} className="secondary-button flex-1">
                <FaArrowRotateRight className="h-3.5 w-3.5" aria-hidden />
                전부 새로 짜줘
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="team-toast">
          <FaCheck className="h-3.5 w-3.5" aria-hidden />
          {toast}
        </div>
      ) : null}

      {isPending ? (
        <div className="team-loading-chip">
          <FaChevronRight className="h-3.5 w-3.5 animate-pulse" aria-hidden />
          {pendingActivity?.steps[pendingActivity.index] ?? "팀이 다음 액션을 정리 중입니다."}
        </div>
      ) : null}
    </>
  );
}
