import { randomUUID } from "node:crypto";

import { getDaysUntil } from "@/lib/utils";
import { teamKickoffOptions } from "@/lib/team-simulation";
import type {
  Contest,
  ContestTeamHandoff,
  TeamArtifactType,
  TeamKickoffOption,
  TeamMember,
  TeamMessage,
  TeamTaskPriority,
} from "@/types/contest";

type TeamBlueprintMember = {
  memberKey: string;
  name: string;
  role: string;
  englishRole: string;
  personality: string;
  mainContribution: string;
  skills: string[];
  introLine: string;
  status: TeamMember["status"];
  avatarSeed: string;
};

type TeamBlueprintTask = {
  title: string;
  description: string;
  priority: TeamTaskPriority;
  assigneeKey?: string | null;
  origin: string;
};

type TeamBlueprintArtifact = {
  artifactType: TeamArtifactType;
  title: string;
  summary: string;
  body: string;
  status: "draft" | "ready";
  sourceTaskTitle?: string | null;
};

function buildVideoBlueprint() {
  return [
    {
      memberKey: "director",
      name: "미나",
      role: "연출 디렉터",
      englishRole: "Director",
      personality: "큰 그림을 빠르게 잡고 감정선을 놓치지 않아요.",
      mainContribution: "전체 메시지 톤과 장면 흐름을 잡습니다.",
      skills: ["콘셉트 디렉팅", "광고 구조", "장면 우선순위 정리"],
      introLine: "스토리 흐름이 끊기지 않게 전체 방향을 잡아볼게요.",
      status: "online" as const,
      avatarSeed: "director",
    },
    {
      memberKey: "scriptwriter",
      name: "준호",
      role: "시나리오 작가",
      englishRole: "Scriptwriter",
      personality: "짧은 시간 안에 메시지를 선명하게 만드는 데 강해요.",
      mainContribution: "장면별 문장과 카피를 정리합니다.",
      skills: ["카피라이팅", "스토리보드", "브랜드 메시지"],
      introLine: "심사위원이 한 번에 이해할 문장으로 바꿔드릴게요.",
      status: "working" as const,
      avatarSeed: "scriptwriter",
    },
    {
      memberKey: "editor",
      name: "유리",
      role: "영상 편집 메이커",
      englishRole: "Video Editor",
      personality: "데모가 바로 보이는 결과물을 빨리 만듭니다.",
      mainContribution: "AI 소스와 편집 흐름을 실제 제출물 형태로 묶습니다.",
      skills: ["영상 편집", "AI 비주얼 툴", "타임라인 압축"],
      introLine: "30초 안에 임팩트가 사는 컷 구성으로 가볼게요.",
      status: "online" as const,
      avatarSeed: "editor",
    },
    {
      memberKey: "brand",
      name: "다은",
      role: "브랜드 전략가",
      englishRole: "Brand Strategist",
      personality: "주최사가 듣고 싶어 하는 포인트를 잘 뽑아내요.",
      mainContribution: "심사 기준과 브랜드 메시지를 맞춥니다.",
      skills: ["브랜드 해석", "심사 포인트 대응", "발표 논리"],
      introLine: "왜 이 아이디어가 브랜드와 딱 맞는지 정리해둘게요.",
      status: "resting" as const,
      avatarSeed: "brand",
    },
  ] satisfies TeamBlueprintMember[];
}

function buildDataBlueprint() {
  return [
    {
      memberKey: "data-scientist",
      name: "지우",
      role: "데이터 사이언티스트",
      englishRole: "Data Scientist",
      personality: "문제를 수치로 잘게 나누고 실험을 빨리 설계해요.",
      mainContribution: "문제 정의와 검증 지표를 세웁니다.",
      skills: ["EDA", "가설 설정", "모델 지표 설계"],
      introLine: "심사 기준에 맞는 실험 구조부터 빠르게 세팅할게요.",
      status: "online" as const,
      avatarSeed: "data-scientist",
    },
    {
      memberKey: "ml-engineer",
      name: "하린",
      role: "ML 엔지니어",
      englishRole: "ML Engineer",
      personality: "복잡한 모델도 제출 가능한 수준으로 빠르게 줄여요.",
      mainContribution: "모델 구현과 재현 가능한 파이프라인을 만듭니다.",
      skills: ["PyTorch", "학습 파이프라인", "재현성"],
      introLine: "성능도 챙기되, 데모까지 돌아가는 구조로 맞출게요.",
      status: "working" as const,
      avatarSeed: "ml-engineer",
    },
    {
      memberKey: "feature",
      name: "세린",
      role: "특징 설계자",
      englishRole: "Feature Engineer",
      personality: "점수를 올리는 작은 개선 포인트를 잘 찾습니다.",
      mainContribution: "입력 변수와 개선 포인트를 정리합니다.",
      skills: ["피처 설계", "오류 분석", "개선 루프"],
      introLine: "점수 차이를 만드는 작은 개선 포인트를 찾아볼게요.",
      status: "online" as const,
      avatarSeed: "feature",
    },
    {
      memberKey: "reporter",
      name: "윤서",
      role: "리포트 메이커",
      englishRole: "Report Writer",
      personality: "복잡한 실험도 심사위원이 읽기 쉽게 바꿔요.",
      mainContribution: "결과 해석과 제출용 설명 자료를 만듭니다.",
      skills: ["시각화", "결과 해석", "보고서 구조"],
      introLine: "실험 결과가 왜 의미 있는지 한눈에 보이게 정리할게요.",
      status: "resting" as const,
      avatarSeed: "reporter",
    },
  ] satisfies TeamBlueprintMember[];
}

function buildServiceBlueprint() {
  return [
    {
      memberKey: "pm",
      name: "서윤",
      role: "프로덕트 리드",
      englishRole: "Product Lead",
      personality: "심사 포인트를 기능 우선순위로 바로 번역해요.",
      mainContribution: "핵심 기능과 데모 흐름을 정리합니다.",
      skills: ["문제 정의", "기능 우선순위", "발표 스토리"],
      introLine: "처음 보는 심사위원도 이해하는 데모 흐름으로 잡아볼게요.",
      status: "online" as const,
      avatarSeed: "pm",
    },
    {
      memberKey: "frontend",
      name: "민재",
      role: "프론트엔드 빌더",
      englishRole: "Frontend Developer",
      personality: "짧은 시간 안에 보이는 결과물을 빨리 만들어요.",
      mainContribution: "데모 화면과 사용자 흐름을 구현합니다.",
      skills: ["Next.js", "UI 구현", "프로토타이핑"],
      introLine: "첫 클릭부터 감이 오는 데모 화면으로 맞출게요.",
      status: "working" as const,
      avatarSeed: "frontend",
    },
    {
      memberKey: "backend-ai",
      name: "태오",
      role: "AI 백엔드 메이커",
      englishRole: "AI Backend Builder",
      personality: "모델과 서비스 흐름을 현실적인 범위로 묶어냅니다.",
      mainContribution: "핵심 AI 로직과 API 흐름을 설계합니다.",
      skills: ["API 설계", "LLM 워크플로", "데모용 백엔드"],
      introLine: "실제로 돌아가는 핵심 AI 기능부터 붙여둘게요.",
      status: "online" as const,
      avatarSeed: "backend-ai",
    },
    {
      memberKey: "ux",
      name: "현아",
      role: "UX 디자이너",
      englishRole: "UX Designer",
      personality: "짧은 시연에서도 사용 이유가 바로 보이게 만들어요.",
      mainContribution: "사용자 흐름과 화면 설득력을 높입니다.",
      skills: ["UX 시나리오", "정보 구조", "시각 정리"],
      introLine: "심사위원이 바로 이해하는 화면 흐름을 챙겨둘게요.",
      status: "resting" as const,
      avatarSeed: "ux",
    },
  ] satisfies TeamBlueprintMember[];
}

function pickBlueprint(contest: Contest) {
  const summary = `${contest.title} ${contest.shortDescription} ${contest.submissionFormat ?? ""} ${contest.description}`.toLowerCase();

  if (/영상|광고|video|story|film|콘텐츠/.test(summary)) {
    return buildVideoBlueprint();
  }

  if (
    contest.aiCategories.includes("data-science") ||
    contest.aiCategories.includes("computer-vision") ||
    /accuracy|재현|모델|데이터|분석|classification|prediction/.test(summary)
  ) {
    return buildDataBlueprint();
  }

  return buildServiceBlueprint();
}

function buildTeamName(contest: Contest, handoff: ContestTeamHandoff) {
  const baseIdea = handoff.ideaTitle.replace(/\s+/g, " ").trim();

  if (baseIdea.length > 18) {
    return `${contest.title.slice(0, 10).trim()} 팀`;
  }

  return `${baseIdea} 스쿼드`;
}

function buildTeamIntro(contest: Contest, handoff: ContestTeamHandoff) {
  const daysUntil = getDaysUntil(contest.deadline);
  const deadlineLine =
    daysUntil === null ? "마감 일정은 따로 체크해야 해요." : `마감까지 ${daysUntil}일 남았으니 빠르게 역할을 나누고 핵심 제출물을 먼저 잡아야 해요.`;

  return `${handoff.ideaTitle}를 중심으로 심사 기준에 맞는 결과물을 빠르게 쌓는 팀입니다. ${deadlineLine}`;
}

function buildInitialTasks(members: TeamBlueprintMember[], contest: Contest) {
  return [
    {
      title: "심사 기준 한 줄 정리",
      description: "이번 공모전에서 심사위원이 바로 볼 포인트 3개를 정리합니다.",
      priority: "high" as const,
      assigneeKey: members[0]?.memberKey ?? null,
      origin: "bootstrap",
    },
    {
      title: "첫 데모 흐름 만들기",
      description: contest.submissionFormat
        ? `${contest.submissionFormat} 제출 형태에 맞춰 첫 결과물 흐름을 잡습니다.`
        : "심사위원이 1분 안에 이해할 데모 흐름을 만듭니다.",
      priority: "medium" as const,
      assigneeKey: members[1]?.memberKey ?? null,
      origin: "bootstrap",
    },
    {
      title: "제출 체크리스트 초안",
      description: "필수 제출 항목과 단계별 일정을 빠르게 체크리스트로 묶습니다.",
      priority: "medium" as const,
      assigneeKey: members[2]?.memberKey ?? null,
      origin: "bootstrap",
    },
  ] satisfies TeamBlueprintTask[];
}

function buildInitialArtifacts(handoff: ContestTeamHandoff) {
  return [
    {
      artifactType: "brief" as const,
      title: "한 줄 기획 메모",
      summary: "왜 이 아이디어가 심사 기준에 맞는지 먼저 정리한 카드입니다.",
      body: `${handoff.why}\n\n${handoff.how}\n\n핵심 아이디어: ${handoff.ideaTitle}`,
      status: "draft" as const,
      sourceTaskTitle: "심사 기준 한 줄 정리",
    },
  ] satisfies TeamBlueprintArtifact[];
}

export function generateFallbackContestTeam(contest: Contest, handoff: ContestTeamHandoff) {
  const members = pickBlueprint(contest);

  return {
    teamName: buildTeamName(contest, handoff),
    teamIntro: buildTeamIntro(contest, handoff),
    members,
    kickoffOptions: teamKickoffOptions,
    initialTasks: buildInitialTasks(members, contest),
    initialArtifacts: buildInitialArtifacts(handoff),
    reason: `${contest.title}의 심사 기준과 제출 형식에 맞춰 역할을 바로 나눌 수 있는 구성이에요.`,
  };
}

function chooseSpeaker(teamStateMembers: TeamMember[], keyword: string) {
  const lowered = keyword.toLowerCase();

  return (
    teamStateMembers.find((member) => lowered.includes("화면") && /디자이너|프론트/.test(member.role)) ??
    teamStateMembers.find((member) => lowered.includes("데이터") && /데이터|ML/.test(member.role)) ??
    teamStateMembers.find((member) => lowered.includes("코드") && /백엔드|프론트|엔지니어/.test(member.role)) ??
    teamStateMembers.find((member) => member.role.includes("리드") || member.role.includes("PM")) ??
    teamStateMembers.find((member) => member.isActive)
  );
}

export function simulateFallbackTeamTurn(input: {
  contest: Contest;
  handoff: ContestTeamHandoff;
  teamState: {
    members: TeamMember[];
    tasks: Array<{ id: string; title: string; status: string; priority: TeamTaskPriority }>;
    artifacts: Array<{ id: string; title: string; status: string }>;
    kickoffChoice?: string | null;
  };
  lastMessages: TeamMessage[];
  userAction: {
    message?: string | null;
    quickAction?: string | null;
  };
}) {
  const latestText = input.userAction.quickAction ?? input.userAction.message ?? "";
  const speaker = chooseSpeaker(input.teamState.members, latestText);
  const coach = input.teamState.members.find((member) => member.role.includes("리드") || member.role.includes("PM")) ?? speaker;
  const createdTaskId = randomUUID();

  if (input.userAction.quickAction === "refine-idea") {
    return {
      messages: [
        {
          memberKey: coach?.memberKey ?? null,
          authorType: "ai" as const,
          body: "좋아요. 먼저 심사위원이 바로 이해할 한 줄 메시지부터 정리해볼게요. 그다음 데모 흐름을 붙이면 훨씬 설득력이 살아나요.",
          messageKind: "chat" as const,
        },
      ],
      taskMutations: [
        {
          action: "create" as const,
          taskId: createdTaskId,
          title: "한 줄 메시지 선명하게 만들기",
          description: "심사 기준과 연결되는 핵심 메시지를 한 문장으로 줄입니다.",
          priority: "high" as const,
          status: "todo" as const,
          assigneeKey: coach?.memberKey ?? null,
        },
      ],
      artifactMutations: [
        {
          action: "create" as const,
          artifactType: "brief" as const,
          title: "심사 대응 한 줄 메모",
          summary: "심사 포인트와 연결되는 한 줄 메시지를 먼저 잡습니다.",
          body: `${input.handoff.matrixSummary}\n\n핵심 아이디어: ${input.handoff.ideaTitle}`,
          status: "draft" as const,
          sourceTaskTitle: "한 줄 메시지 선명하게 만들기",
        },
      ],
      coachSummary: "핵심 메시지를 먼저 다듬는 방향으로 작업을 열었습니다.",
    };
  }

  if (input.userAction.quickAction === "split-roles") {
    return {
      messages: [
        {
          memberKey: coach?.memberKey ?? null,
          authorType: "ai" as const,
          body: "좋아요. 역할부터 나누면 마감 전에 흔들리지 않아요. 각자 첫 산출물을 하나씩 맡는 구조로 갈게요.",
          messageKind: "chat" as const,
        },
      ],
      taskMutations: input.teamState.members
        .filter((member) => member.isActive && !member.isHuman)
        .slice(0, 3)
        .map((member, index) => ({
          action: "create" as const,
          taskId: randomUUID(),
          title: `${member.role} 첫 산출물 만들기`,
          description: `${member.name}이 맡을 첫 결과물을 빠르게 정의합니다.`,
          priority: index === 0 ? ("high" as const) : ("medium" as const),
          status: "todo" as const,
          assigneeKey: member.memberKey,
        })),
      artifactMutations: [],
      coachSummary: "역할 분담을 기준으로 첫 작업을 열어뒀습니다.",
    };
  }

  if (input.userAction.quickAction === "build-now") {
    return {
      messages: [
        {
          memberKey: speaker?.memberKey ?? null,
          authorType: "ai" as const,
          body: "좋아요. 바로 보이는 결과물부터 만들면 팀 속도가 붙어요. 데모 구조와 제출용 메모를 같이 열어둘게요.",
          messageKind: "chat" as const,
        },
      ],
      taskMutations: [
        {
          action: "create" as const,
          taskId: createdTaskId,
          title: "첫 데모 화면 또는 결과물 구조 만들기",
          description: "심사위원이 30초 안에 이해할 결과물 구조를 먼저 만듭니다.",
          priority: "high" as const,
          status: "todo" as const,
          assigneeKey: speaker?.memberKey ?? null,
        },
      ],
      artifactMutations: [
        {
          action: "create" as const,
          artifactType: "prototype-note" as const,
          title: "첫 데모 구조 메모",
          summary: "바로 보여줄 수 있는 결과물 흐름을 정리한 카드입니다.",
          body: `${input.handoff.ideaDescription}\n\n데모는 시작-핵심 기능-심사 포인트 순으로 보여줍니다.`,
          status: "draft" as const,
          sourceTaskTitle: "첫 데모 화면 또는 결과물 구조 만들기",
        },
      ],
      coachSummary: "가장 빨리 보여줄 수 있는 결과물부터 여는 방향으로 잡았습니다.",
    };
  }

  return {
    messages: [
      {
        memberKey: speaker?.memberKey ?? null,
        authorType: "ai" as const,
        body: "좋아요. 방금 말한 방향을 바로 작업으로 옮겨둘게요. 이 흐름이면 심사 포인트와 연결하기도 쉬워요.",
        messageKind: "chat" as const,
      },
    ],
    taskMutations: [
      {
        action: "create" as const,
        taskId: createdTaskId,
        title: latestText ? `${latestText.slice(0, 24)} 작업하기` : "방금 이야기한 방향 구체화하기",
        description: latestText || "방금 대화에서 나온 방향을 실제 제출물 기준으로 풀어봅니다.",
        priority: "medium" as const,
        status: "todo" as const,
        assigneeKey: speaker?.memberKey ?? null,
      },
    ],
    artifactMutations: [],
    coachSummary: "대화 내용을 새 작업으로 정리했습니다.",
  };
}
