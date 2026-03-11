import { clsx, type ClassValue } from "clsx";

import {
  difficultyOptions,
  getBadgeMeta,
  getCategoryMeta,
  getContestTrackingStatusMeta,
  getOrganizerTypeMeta,
  type ContestBadge,
  type ContestCategory,
  type ContestDifficulty,
  type ContestMode,
  type ContestOrganizerType,
  type ContestSortOption,
  type ContestTeamFilter,
  type ContestTrackingStatus,
} from "@/types/contest";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value?: number) {
  if (!value) {
    return "상금 미정";
  }

  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value?: string) {
  if (!value) {
    return "날짜 미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatLanguage(value?: string) {
  if (!value) {
    return "미정";
  }

  const normalized = value.toLowerCase();

  if (normalized === "korean" || normalized === "ko" || normalized === "ko-kr") {
    return "한국어";
  }

  if (normalized === "english" || normalized === "en" || normalized === "en-us") {
    return "영어";
  }

  return value;
}

export function getDaysUntil(value?: string) {
  if (!value) {
    return null;
  }

  const target = new Date(value);
  const now = new Date();
  const targetStart = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return Math.ceil((targetStart - todayStart) / (1000 * 60 * 60 * 24));
}

export function formatDeadlineLabel(value?: string) {
  const daysUntil = getDaysUntil(value);

  if (daysUntil === null) {
    return "마감 미정";
  }

  if (daysUntil < 0) {
    return "접수 종료";
  }

  if (daysUntil === 0) {
    return "오늘 마감";
  }

  return `${daysUntil}일 남음`;
}

export function formatMode(mode: ContestMode) {
  const labels: Record<ContestMode, string> = {
    online: "온라인",
    offline: "오프라인",
    hybrid: "하이브리드",
  };

  return labels[mode];
}

export function formatDifficulty(difficulty: ContestDifficulty) {
  return difficultyOptions.find((option) => option.id === difficulty)?.label ?? difficulty;
}

export function formatBadge(badge: ContestBadge) {
  return getBadgeMeta(badge).label;
}

export function formatCategory(category: ContestCategory) {
  return getCategoryMeta(category).label;
}

export function formatOrganizerType(organizerType: ContestOrganizerType) {
  return getOrganizerTypeMeta(organizerType).label;
}

export function formatTrackingStatus(status: ContestTrackingStatus) {
  return getContestTrackingStatusMeta(status).label;
}

export function formatReminderLabel(daysBefore = 3) {
  return `마감 ${daysBefore}일 전 deadline reminder`;
}

export function formatCompactNumber(value?: number) {
  return new Intl.NumberFormat("ko-KR", {
    notation: value && value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

export function getContestPopularityScore(viewCount = 0, applyCount = 0) {
  return viewCount + applyCount * 8;
}

export function formatContestSort(sort: ContestSortOption) {
  const labels: Record<ContestSortOption, string> = {
    deadline: "마감임박순",
    prize: "상금순",
    popular: "인기순",
  };

  return labels[sort];
}

export function formatContestTeamFilter(teamType: ContestTeamFilter) {
  const labels: Record<ContestTeamFilter, string> = {
    individual: "개인전",
    team: "팀전",
  };

  return labels[teamType];
}
