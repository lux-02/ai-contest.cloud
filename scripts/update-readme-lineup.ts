import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  contestBadgeOptions,
  contestCategoryOptions,
  organizerTypeOptions,
  type ContestBadge,
  type ContestCategory,
  type ContestOrganizerType,
} from "../types/contest";

type ReadmeContestRow = {
  id: string;
  title: string;
  slug: string;
  organizer: string;
  organizer_type: ContestOrganizerType | null;
  deadline: string | null;
  prize_pool_krw: number | string | null;
  ai_categories: ContestCategory[] | null;
  eligibility_segments: string[] | null;
  short_description: string | null;
  view_count: number | null;
  apply_count: number | null;
  contest_badges: { badge: ContestBadge; reason: string | null }[] | null;
  status: string;
};

type ExportedContest = {
  id: string;
  title: string;
  slug: string;
  url: string;
  organizer: string;
  organizerType: ContestOrganizerType | null;
  organizerTypeLabel: string | null;
  deadline: string | null;
  deadlineDate: string;
  prizePoolKrw: number | null;
  prizeLabel: string;
  viewCount: number;
  applyCount: number;
  categories: ContestCategory[];
  categoryLabels: string[];
  badges: ContestBadge[];
  badgeLabels: string[];
  eligibilitySegments: string[];
  shortDescription: string | null;
  featuredSections: string[];
  featuredReason: string | null;
};

const README_PATH = path.resolve(process.cwd(), "README.md");
const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_PATH = path.resolve(DATA_DIR, "contests.json");
const LINEUP_START = "<!-- lineup:start -->";
const LINEUP_END = "<!-- lineup:end -->";
const APP_BASE_URL = "https://ai-contest-cloud.vercel.app";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required to refresh README lineup.",
    );
  }

  return { url, key };
}

function formatDate(value: string | null) {
  if (!value) {
    return "TBD";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return date.toISOString().slice(0, 10);
}

function parsePrize(value: number | string | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatCurrency(value: number | string | null) {
  const amount = parsePrize(value);

  if (amount === null || amount <= 0) {
    return "TBD";
  }

  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCategories(categories: ContestCategory[] | null) {
  if (!categories || categories.length === 0) {
    return ["AI Contest"];
  }

  return categories.map(
    (category) => contestCategoryOptions.find((option) => option.id === category)?.label ?? category,
  );
}

function formatOrganizerType(value: ContestOrganizerType | null) {
  if (!value) {
    return null;
  }

  return organizerTypeOptions.find((option) => option.id === value)?.label ?? value;
}

function deriveOrganizerType(organizer: string): ContestOrganizerType {
  const normalized = organizer.toLowerCase();

  if (
    /정부|공공|부처|청|시청|구청|도청|한국|kotra|진흥원|공사|산업통상|과학기술|ministry|government|agency/.test(
      normalized,
    )
  ) {
    return "government";
  }

  if (/재단|foundation/.test(normalized)) {
    return "foundation";
  }

  if (/대학교|대학|university|college/.test(normalized)) {
    return "university";
  }

  if (/openai|google|naver|kakao|samsung|lg|hyundai|volkswagen|microsoft|amazon|meta/.test(normalized)) {
    return "enterprise";
  }

  if (/startup|works|labs|lab|studio/.test(normalized)) {
    return "startup";
  }

  return "community";
}

function formatBadgeLabels(badges: ContestBadge[]) {
  return badges.map((badge) => contestBadgeOptions.find((option) => option.id === badge)?.label ?? badge);
}

function buildLineupTable(contests: ExportedContest[]) {
  const lines = [
    "| Deadline | Contest | Organizer | Prize | Category |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const contest of contests) {
    lines.push(
      `| ${contest.deadlineDate} | [${contest.title}](${contest.url}) | ${contest.organizer} | ${contest.prizeLabel} | ${contest.categoryLabels.join(", ")} |`,
    );
  }

  return lines.join("\n");
}

function buildSection(title: string, description: string, contests: ExportedContest[]) {
  return [
    `### ${title}`,
    description,
    "",
    buildLineupTable(contests),
  ].join("\n");
}

function getDaysUntil(deadline: string | null) {
  if (!deadline) {
    return null;
  }

  const target = new Date(deadline);

  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const diff = target.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function hasBadge(contest: ReadmeContestRow, badge: ContestBadge) {
  return (contest.contest_badges ?? []).some((item) => item.badge === badge);
}

function toExportedContest(contest: ReadmeContestRow): ExportedContest {
  const badges = (contest.contest_badges ?? []).map((item) => item.badge);
  const organizerType = contest.organizer_type ?? deriveOrganizerType(contest.organizer);

  return {
    id: contest.id,
    title: contest.title,
    slug: contest.slug,
    url: `${APP_BASE_URL}/contests/${contest.slug}`,
    organizer: contest.organizer,
    organizerType,
    organizerTypeLabel: formatOrganizerType(organizerType),
    deadline: contest.deadline,
    deadlineDate: formatDate(contest.deadline),
    prizePoolKrw: parsePrize(contest.prize_pool_krw),
    prizeLabel: formatCurrency(contest.prize_pool_krw),
    viewCount: contest.view_count ?? 0,
    applyCount: contest.apply_count ?? 0,
    categories: contest.ai_categories ?? [],
    categoryLabels: formatCategories(contest.ai_categories),
    badges,
    badgeLabels: formatBadgeLabels(badges),
    eligibilitySegments: contest.eligibility_segments ?? [],
    shortDescription: contest.short_description ?? null,
    featuredSections: [],
    featuredReason: null,
  };
}

function buildFeaturedSections(contests: ReadmeContestRow[]) {
  const exported = contests.map(toExportedContest);
  const exportedById = new Map(exported.map((contest) => [contest.id, contest]));

  const urgent = exported
    .filter((contest) => {
      const source = contests.find((item) => item.id === contest.id);
      const daysUntil = getDaysUntil(contest.deadline);
      return (source && hasBadge(source, "deadline_urgent")) || (daysUntil !== null && daysUntil <= 7);
    })
    .sort((left, right) => left.deadlineDate.localeCompare(right.deadlineDate))
    .slice(0, 5);

  for (const contest of urgent) {
    const target = exportedById.get(contest.id);

    if (!target) {
      continue;
    }

    target.featuredSections.push("deadlineUrgent");
    target.featuredReason ??= "마감이 7일 이내로 가까워 빠른 지원 판단이 필요한 대회";
  }

  const highPrize = [...exported]
    .sort((left, right) => (right.prizePoolKrw ?? 0) - (left.prizePoolKrw ?? 0))
    .slice(0, 5);

  for (const contest of highPrize) {
    const target = exportedById.get(contest.id);

    if (!target) {
      continue;
    }

    target.featuredSections.push("highPrize");
    target.featuredReason ??= "총상금 규모가 커서 상금순 추천 섹션에 포함된 대회";
  }

  const studentFriendly = exported
    .filter((contest) => {
      const source = contests.find((item) => item.id === contest.id);
      return (
        (source && hasBadge(source, "student_friendly")) ||
        contest.eligibilitySegments.includes("student") ||
        contest.eligibilitySegments.includes("education")
      );
    })
    .slice(0, 5);

  for (const contest of studentFriendly) {
    const target = exportedById.get(contest.id);

    if (!target) {
      continue;
    }

    target.featuredSections.push("studentFriendly");
    target.featuredReason ??= "대학생 지원 적합도가 높아 학생 추천 섹션에 포함된 대회";
  }

  return {
    urgent,
    highPrize,
    studentFriendly,
    all: exported,
  };
}

async function fetchPublishedContests() {
  const { url, key } = getSupabaseConfig();
  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase
    .from("contests")
    .select(
      "id, title, slug, organizer, organizer_type, deadline, prize_pool_krw, ai_categories, eligibility_segments, short_description, view_count, apply_count, status, contest_badges (badge, reason)",
    )
    .eq("status", "published")
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Could not fetch contests for README refresh: ${error.message}`);
  }

  return ((data ?? []) as ReadmeContestRow[]).filter((contest) => contest.status === "published");
}

async function writeDataFile(contests: ReadmeContestRow[]) {
  const sections = buildFeaturedSections(contests);

  await mkdir(DATA_DIR, { recursive: true });

  const payload = {
    source: "supabase",
    appBaseUrl: APP_BASE_URL,
    sections: {
      deadlineUrgent: sections.urgent.map((contest) => contest.slug),
      highPrize: sections.highPrize.map((contest) => contest.slug),
      studentFriendly: sections.studentFriendly.map((contest) => contest.slug),
    },
    contests: sections.all,
  };

  await writeFile(DATA_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function updateReadme() {
  const contests = await fetchPublishedContests();
  const sections = buildFeaturedSections(contests);
  const readme = await readFile(README_PATH, "utf8");
  const startIndex = readme.indexOf(LINEUP_START);
  const endIndex = readme.indexOf(LINEUP_END);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("README lineup markers are missing or malformed.");
  }

  const generatedSections = [
    buildSection("마감임박", "곧 닫히는 공모전부터 빠르게 확인할 수 있게 정리한 섹션입니다.", sections.urgent),
    "",
    buildSection("상금순", "총상금 규모가 큰 순서대로 상위 라인업을 모았습니다.", sections.highPrize),
    "",
    buildSection("대학생 추천", "학생 포트폴리오와 첫 지원 경험에 잘 맞는 대회를 우선 모았습니다.", sections.studentFriendly),
  ].join("\n");

  const nextBlock = `${LINEUP_START}\n${generatedSections}\n${LINEUP_END}`;
  const previousBlock = readme.slice(startIndex, endIndex + LINEUP_END.length);
  const nextReadme = readme.replace(previousBlock, nextBlock);

  await writeDataFile(contests);

  if (nextReadme === readme) {
    await writeFile(README_PATH, nextReadme, "utf8");
    console.log(`README lineup checked and data export refreshed with ${contests.length} contests.`);
    return;
  }

  await writeFile(README_PATH, nextReadme, "utf8");
  console.log(`README lineup and data export refreshed with ${contests.length} contests.`);
}

updateReadme().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
