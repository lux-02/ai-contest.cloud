import "server-only";

import { formatDeadlineLabel } from "@/lib/utils";
import { getContestById } from "@/lib/queries";
import { getContestIdeationSession, getContestTeamHandoff } from "@/lib/server/contest-ideation";
import { getStoredStrategyReport, getStoredStrategySources } from "@/lib/server/contest-strategy-report-store";
import { getTeamSessionSnapshot } from "@/lib/server/contest-team";
import { resolveContestWorkspaceAccess } from "@/lib/server/contest-workspace-access";
import { listContestWorkspaceReviews } from "@/lib/server/contest-workspace-reviews";
import type {
  Contest,
  ContestDraftSection,
  ContestSubmissionChecklistItem,
  ContestSubmissionPackage,
  ContestWorkspaceSnapshot,
  TeamArtifact,
  TeamBootstrapResponse,
} from "@/types/contest";

function selectedIdeaLabel(snapshot: ContestWorkspaceSnapshot | Omit<ContestWorkspaceSnapshot, "submissionPackage">) {
  if (snapshot.handoff?.ideaTitle) {
    return snapshot.handoff.ideaTitle;
  }

  const selectedIdea = snapshot.ideationSession.ideaCandidates.find(
    (candidate) => candidate.id === snapshot.ideationSession.selectedIdeaId,
  );

  return selectedIdea?.title ?? "선택 아이디어";
}

function selectedIdeaDescription(snapshot: ContestWorkspaceSnapshot | Omit<ContestWorkspaceSnapshot, "submissionPackage">) {
  if (snapshot.handoff?.ideaDescription) {
    return snapshot.handoff.ideaDescription;
  }

  const selectedIdea = snapshot.ideationSession.ideaCandidates.find(
    (candidate) => candidate.id === snapshot.ideationSession.selectedIdeaId,
  );

  return selectedIdea?.description ?? snapshot.contest.shortDescription;
}

function buildFallbackProposalSections(contest: Contest, ideaTitle: string, ideaDescription: string): ContestDraftSection[] {
  return [
    {
      title: "문제 정의",
      body: `${contest.title} 공고의 핵심 문제를 한 문장으로 다시 정의하고, 왜 지금 해결해야 하는지 심사 기준과 연결합니다.`,
    },
    {
      title: "제안 솔루션",
      body: `${ideaTitle} 방향을 중심으로 사용자 경험과 기술 구조를 설명합니다. 핵심 설명: ${ideaDescription}`,
    },
    {
      title: "차별화 포인트",
      body: "기존 참가작과 달라지는 지점, 심사위원이 한 번에 이해할 수 있는 winning edge, 그리고 공모전 맥락에 맞는 메시지를 정리합니다.",
    },
    {
      title: "실행 계획",
      body: "역할 분담, 데모 범위, 제출 직전까지의 작업 일정을 정리합니다.",
    },
    {
      title: "기대 효과",
      body: "심사 기준에 대응하는 정량·정성 효과와 데모에서 보여줄 결과를 정리합니다.",
    },
  ];
}

function buildPitchOutline(
  snapshot: Omit<ContestWorkspaceSnapshot, "submissionPackage">,
  proposalSections: ContestDraftSection[],
) {
  const judgingFocus =
    snapshot.contest.judgingCriteria?.slice(0, 3).map((criterion) => criterion.label).join(", ") ||
    snapshot.strategyReport?.recommendedDirection ||
    "핵심 심사 기준";

  return [
    `1. 문제와 공모전 맥락: ${snapshot.contest.title}에서 해결하려는 문제를 1분 안에 설명`,
    `2. 왜 이 방향인가: ${judgingFocus} 기준에서 ${selectedIdeaLabel(snapshot)}이 유리한 이유`,
    `3. 솔루션 구조: ${proposalSections[1]?.title ?? "제안 솔루션"} 중심으로 사용자 흐름과 핵심 기능 설명`,
    `4. 데모 장면: 제출물에서 실제로 보여줄 화면, 입력, 결과를 순서대로 설명`,
    `5. 실행 가능성: 팀 역할, 일정, 제출 형식 대응 방식 설명`,
    "6. 기대 효과: 심사위원이 점수를 줄 수 있는 임팩트와 차별점을 한 장으로 정리",
  ];
}

function buildDemoScenario(
  snapshot: Omit<ContestWorkspaceSnapshot, "submissionPackage">,
  teamSnapshot: TeamBootstrapResponse | null,
) {
  const readyArtifacts = teamSnapshot?.teamSession.artifacts.filter((artifact) => artifact.status === "ready") ?? [];
  const prototypeArtifact = readyArtifacts.find((artifact) => artifact.artifactType === "prototype-note");

  return [
    `1. 공모전 상황 소개: ${snapshot.contest.shortDescription}`,
    `2. 사용자 문제 제시: ${selectedIdeaDescription(snapshot)}`,
    `3. 핵심 데모 흐름: 입력 -> 처리 -> 결과를 3단계로 보여주기`,
    prototypeArtifact
      ? `4. 프로토타입 포인트: ${prototypeArtifact.title} 중심으로 핵심 상호작용 설명`
      : "4. 프로토타입 포인트: 가장 설득력 있는 핵심 화면 또는 결과물 한 장면 설명",
    "5. 심사 기준 연결: 데모 마지막에 완성도, 차별성, 실현 가능성을 한 번에 묶어 설명",
  ];
}

function getArtifactSummary(teamSnapshot: TeamBootstrapResponse | null, artifactType: TeamArtifact["artifactType"]) {
  const artifact = teamSnapshot?.teamSession.artifacts.find((item) => item.artifactType === artifactType);

  if (!artifact) {
    return null;
  }

  return `${artifact.title}${artifact.status === "ready" ? " · 준비 완료" : " · 작성 중"}`;
}

function buildStrategyQualityItem(
  snapshot: Omit<ContestWorkspaceSnapshot, "submissionPackage">,
): ContestSubmissionChecklistItem {
  const report = snapshot.strategyReport;

  if (!report) {
    return {
      label: "AI 전략 품질 확인",
      state: "todo",
      note: "전략 리포트가 아직 저장되지 않았습니다. 전략 분석을 먼저 완료해야 제출 패키지 근거가 생깁니다.",
    };
  }

  const selectedSourceCount =
    snapshot.strategySources.filter((source) => source.selectedForCitation).length || report.citations.length;
  const hasDraftSections = report.draftSections.some((section) => section.title.trim() && section.body.trim().length >= 40);

  if (report.status !== "completed") {
    return {
      label: "AI 전략 품질 확인",
      state: "warning",
      note: `전략 리포트 상태가 ${report.status}입니다. completed 상태로 다시 생성한 뒤 제출 패키지를 확정하는 편이 안전합니다.`,
    };
  }

  if (!hasDraftSections) {
    return {
      label: "AI 전략 품질 확인",
      state: "warning",
      note: "전략 초안 섹션이 비어 있어 워크스페이스가 기본 템플릿으로 fallback 중입니다. 제안서 초안을 한 번 더 생성해야 합니다.",
    };
  }

  if (selectedSourceCount < 2) {
    return {
      label: "AI 전략 품질 확인",
      state: "warning",
      note: `현재 연결된 근거가 ${selectedSourceCount}개뿐입니다. 최소 2개 이상의 인용/소스가 있어야 심사 포인트 대응 문장을 방어하기 쉽습니다.`,
    };
  }

  return {
    label: "AI 전략 품질 확인",
    state: "ready",
    note: `전략 리포트 completed, 제안서 초안 섹션 ${report.draftSections.length}개, 연결 근거 ${selectedSourceCount}개가 확인됩니다.`,
  };
}

function buildIdeationQualityItem(
  snapshot: Omit<ContestWorkspaceSnapshot, "submissionPackage">,
): ContestSubmissionChecklistItem {
  const selectedCandidate = snapshot.ideationSession.ideaCandidates.find(
    (candidate) => candidate.id === snapshot.ideationSession.selectedIdeaId,
  );
  const selectedMatrixRow = snapshot.ideationSession.matrixRows.find(
    (candidate) => candidate.id === snapshot.ideationSession.selectedIdeaId,
  );
  const topRecommendation = snapshot.ideationSession.topRecommendations[0] ?? null;

  if (!snapshot.ideationSession.selectedIdeaId || !selectedCandidate || !snapshot.handoff) {
    return {
      label: "AI 아이데이션 품질 확인",
      state: "todo",
      note: "선택 아이디어나 handoff가 아직 확정되지 않았습니다. 아이디어 선택과 팀 handoff를 먼저 마쳐야 합니다.",
    };
  }

  if (!snapshot.ideationSession.selectedWhy || !snapshot.ideationSession.selectedHow) {
    return {
      label: "AI 아이데이션 품질 확인",
      state: "warning",
      note: "why/how 선택 흔적이 비어 있습니다. 선택 이유를 다시 고정해 두면 아이디어 전환 시 흔들림이 줄어듭니다.",
    };
  }

  if (!selectedMatrixRow?.matrixScores.reason?.trim()) {
    return {
      label: "AI 아이데이션 품질 확인",
      state: "warning",
      note: "선택 아이디어의 matrix 판단 근거가 비어 있습니다. 왜 이 아이디어를 택했는지 한 줄 근거를 남겨야 심사 대응이 쉬워집니다.",
    };
  }

  if (topRecommendation && topRecommendation.id !== snapshot.ideationSession.selectedIdeaId) {
    return {
      label: "AI 아이데이션 품질 확인",
      state: "warning",
      note: `선택 아이디어가 자동 top recommendation(${topRecommendation.title})과 다릅니다. 최종 선택 이유를 체크리스트나 제안서에 한 번 더 설명해야 합니다.`,
    };
  }

  return {
    label: "AI 아이데이션 품질 확인",
    state: "ready",
    note: `선택 아이디어, why/how, matrix 근거가 연결돼 있습니다. 선택 근거: ${selectedMatrixRow.matrixScores.reason}`,
  };
}

function buildTeamQualityItem(snapshot: Omit<ContestWorkspaceSnapshot, "submissionPackage">): ContestSubmissionChecklistItem {
  const teamSession = snapshot.teamSnapshot?.teamSession;

  if (!teamSession) {
    return {
      label: "AI 팀 산출물 품질 확인",
      state: "todo",
      note: "팀 시뮬레이션 세션이 아직 없습니다. 제출 직전 산출물을 묶으려면 팀 작업물 세션이 필요합니다.",
    };
  }

  const readyArtifactTypes = new Set(
    teamSession.artifacts.filter((artifact) => artifact.status === "ready").map((artifact) => artifact.artifactType),
  );
  const doneTaskCount = teamSession.tasks.filter((task) => task.status === "done").length;
  const requiredArtifactTypes: TeamArtifact["artifactType"][] = ["brief", "pitch", "checklist"];
  const missingCoreArtifacts = requiredArtifactTypes.filter((artifactType) => !readyArtifactTypes.has(artifactType));

  if (missingCoreArtifacts.length > 0) {
    return {
      label: "AI 팀 산출물 품질 확인",
      state: "warning",
      note: `핵심 작업물 중 ${missingCoreArtifacts.join(", ")}가 아직 ready가 아닙니다. brief/pitch/checklist 3종을 모두 맞춘 뒤 제출 패키지를 잠그는 편이 안전합니다.`,
    };
  }

  if (doneTaskCount === 0) {
    return {
      label: "AI 팀 산출물 품질 확인",
      state: "warning",
      note: "완료된 팀 태스크가 아직 없습니다. 작업물이 있더라도 실제 마감 전 수행 기록을 한 번 더 남겨두는 편이 안전합니다.",
    };
  }

  return {
    label: "AI 팀 산출물 품질 확인",
    state: "ready",
    note: `ready 작업물 ${readyArtifactTypes.size}종, 완료 태스크 ${doneTaskCount}개가 확인됩니다.`,
  };
}

function buildChecklist(snapshot: Omit<ContestWorkspaceSnapshot, "submissionPackage">): ContestSubmissionChecklistItem[] {
  const proposalArtifact = getArtifactSummary(snapshot.teamSnapshot, "brief");
  const pitchArtifact = getArtifactSummary(snapshot.teamSnapshot, "pitch");
  const checklistArtifact = getArtifactSummary(snapshot.teamSnapshot, "checklist");
  const deadlineState = snapshot.contest.deadline ? "ready" : "warning";

  return [
    {
      label: "지원 자격 재확인",
      state: snapshot.contest.eligibilityText ? "ready" : "warning",
      note: snapshot.contest.eligibilityText
        ? snapshot.contest.eligibilityText.split("\n")[0] ?? "지원 대상이 정리돼 있습니다."
        : "원문 공고에서 응모 자격을 먼저 확인해야 합니다.",
    },
    {
      label: "마감 일정 확정",
      state: deadlineState,
      note: snapshot.contest.deadline ? formatDeadlineLabel(snapshot.contest.deadline) : "마감일 정보가 비어 있습니다.",
    },
    {
      label: "신청 링크 확보",
      state: snapshot.contest.applyUrl ? "ready" : "warning",
      note: snapshot.contest.applyUrl ?? "신청 링크가 정리되지 않았습니다.",
    },
    {
      label: "제출 형식 정리",
      state:
        snapshot.contest.submissionFormat || (snapshot.contest.submissionItems?.length ?? 0) > 0 ? "ready" : "todo",
      note:
        snapshot.contest.submissionItems?.slice(0, 2).join(", ") ||
        snapshot.contest.submissionFormat ||
        "제출 형식과 필수 항목을 더 정리해야 합니다.",
    },
    {
      label: "AI 사용 정책 확인",
      state: snapshot.contest.toolsAllowed.length ? "ready" : "warning",
      note: snapshot.contest.toolsAllowed.length
        ? `허용 도구: ${snapshot.contest.toolsAllowed.slice(0, 3).join(", ")}`
        : "허용 도구/AI 정책이 비어 있어 원문 재확인이 필요합니다.",
    },
    buildStrategyQualityItem(snapshot),
    buildIdeationQualityItem(snapshot),
    buildTeamQualityItem(snapshot),
    {
      label: "제안서 초안",
      state: snapshot.strategyReport?.draftSections.length ? "ready" : "todo",
      note: proposalArtifact ?? `${snapshot.strategyReport?.draftTitle || "전략 초안"} 기준으로 제안서를 묶을 수 있습니다.`,
    },
    {
      label: "발표 구조",
      state: pitchArtifact ? "ready" : "todo",
      note: pitchArtifact ?? "pitch 아웃라인은 export 패키지에 포함됐지만 팀 작업물 카드와 연결하면 더 좋습니다.",
    },
    {
      label: "제출 체크리스트",
      state: checklistArtifact ? "ready" : "todo",
      note: checklistArtifact ?? "체크리스트를 final 검수용으로 한 번 더 저장하는 편이 안전합니다.",
    },
  ];
}

function buildMarkdown(
  snapshot: Omit<ContestWorkspaceSnapshot, "submissionPackage">,
  submissionPackage: Omit<ContestSubmissionPackage, "markdown">,
) {
  const lines: string[] = [
    `# ${submissionPackage.title}`,
    "",
    submissionPackage.subtitle,
    "",
    "## 개요",
    submissionPackage.overview,
    "",
    "## 제안서 초안",
    `### ${submissionPackage.proposalTitle}`,
    submissionPackage.proposalSubtitle,
    "",
  ];

  for (const section of submissionPackage.proposalSections) {
    lines.push(`### ${section.title}`);
    lines.push(section.body);
    lines.push("");
  }

  lines.push("## 발표 구조");
  for (const item of submissionPackage.pitchOutline) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## 데모 시나리오");
  for (const item of submissionPackage.demoScenario) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## 제출 체크리스트");
  for (const item of submissionPackage.checklist) {
    lines.push(`- [${item.state === "ready" ? "x" : " "}] ${item.label}: ${item.note}`);
  }
  lines.push("");
  lines.push("## 멘토/팀 리뷰 노트");

  if (snapshot.reviewNotes.length) {
    for (const review of snapshot.reviewNotes) {
      lines.push(
        `- ${review.reviewerLabel}${review.reviewerRole ? ` · ${review.reviewerRole}` : ""} [${review.focusArea}]: ${review.note}`,
      );
    }
  } else {
    lines.push("- 저장된 리뷰 노트 없음");
  }

  lines.push("");
  lines.push("## 참고 근거");

  if (snapshot.strategySources.length) {
    for (const source of snapshot.strategySources.slice(0, 5)) {
      lines.push(`- ${source.title}${source.url ? ` (${source.url})` : ""}`);
    }
  } else {
    lines.push("- 저장된 전략 소스 없음");
  }

  lines.push("");
  return lines.join("\n").trim();
}

function buildSubmissionPackage(snapshot: Omit<ContestWorkspaceSnapshot, "submissionPackage">): ContestSubmissionPackage {
  const ideaTitle = selectedIdeaLabel(snapshot);
  const ideaDescription = selectedIdeaDescription(snapshot);
  const proposalSections =
    snapshot.strategyReport?.draftSections.length
      ? snapshot.strategyReport.draftSections
      : buildFallbackProposalSections(snapshot.contest, ideaTitle, ideaDescription);
  const proposalTitle = snapshot.strategyReport?.draftTitle || `${snapshot.contest.title} 제안서 초안`;
  const proposalSubtitle =
    snapshot.strategyReport?.draftSubtitle || `${ideaTitle} 방향을 기준으로 제출 직전까지 바로 이어서 쓸 수 있는 구조`;
  const pitchOutline = buildPitchOutline(snapshot, proposalSections);
  const demoScenario = buildDemoScenario(snapshot, snapshot.teamSnapshot);
  const checklist = buildChecklist(snapshot);

  const basePackage = {
    title: `${snapshot.contest.title} 제출 패키지`,
    subtitle: `${snapshot.contest.organizer} · ${ideaTitle}`,
    overview:
      snapshot.strategyReport?.overview ||
      `${snapshot.contest.title} 공고에 맞춰 ${ideaTitle} 방향으로 제안서, 발표 구조, 데모 시나리오, 제출 체크리스트를 묶은 워크스페이스 패키지입니다.`,
    proposalTitle,
    proposalSubtitle,
    proposalSections,
    pitchOutline,
    demoScenario,
    checklist,
  } satisfies Omit<ContestSubmissionPackage, "markdown">;

  return {
    ...basePackage,
    markdown: buildMarkdown(snapshot, basePackage),
  };
}

export async function getContestWorkspaceSnapshot(
  contestId: string,
  ideationSessionId: string,
  viewerUserId: string,
): Promise<ContestWorkspaceSnapshot | null> {
  const contest = await getContestById(contestId);

  if (!contest) {
    return null;
  }

  const access = await resolveContestWorkspaceAccess(contestId, ideationSessionId, viewerUserId);

  if (!access) {
    return null;
  }

  const ideationSession = await getContestIdeationSession(contest, access.ownerUserId);

  if (!ideationSession || ideationSession.id !== ideationSessionId) {
    return null;
  }

  const [strategyReport, storedStrategySources, handoff, teamSnapshot, reviewNotes] = await Promise.all([
    getStoredStrategyReport(contestId),
    getStoredStrategySources(contestId),
    getContestTeamHandoff(contestId, ideationSessionId, access.ownerUserId),
    getTeamSessionSnapshot(contestId, ideationSessionId, access.ownerUserId),
    listContestWorkspaceReviews(contestId, ideationSessionId),
  ]);

  const strategySources = storedStrategySources.map((source) => ({
    label: source.label,
    title: source.title,
    url: source.url ?? null,
    snippet: source.snippet,
    sourceType: source.sourceType,
    searchQuery: source.searchQuery ?? null,
    rankingScore: source.rankingScore ?? undefined,
    citationScore: source.citationScore ?? undefined,
    selectedForCitation: source.selectedForCitation ?? undefined,
  }));

  const partialSnapshot = {
    contest,
    ideationSession,
    handoff,
    strategyReport,
    strategySources,
    teamSnapshot,
    reviewNotes,
  } satisfies Omit<ContestWorkspaceSnapshot, "submissionPackage">;

  return {
    ...partialSnapshot,
    submissionPackage: buildSubmissionPackage(partialSnapshot),
  };
}

export async function getContestWorkspacePackageMarkdown(
  contestId: string,
  ideationSessionId: string,
  viewerUserId: string,
) {
  const snapshot = await getContestWorkspaceSnapshot(contestId, ideationSessionId, viewerUserId);
  return snapshot?.submissionPackage.markdown ?? null;
}
