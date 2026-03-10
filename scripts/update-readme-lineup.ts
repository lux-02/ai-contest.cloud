import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { contestCategoryOptions, type ContestCategory } from "../types/contest";

type ReadmeContestRow = {
  title: string;
  slug: string;
  organizer: string;
  deadline: string | null;
  prize_pool_krw: number | string | null;
  ai_categories: ContestCategory[] | null;
  status: string;
};

const README_PATH = path.resolve(process.cwd(), "README.md");
const LINEUP_START = "<!-- lineup:start -->";
const LINEUP_END = "<!-- lineup:end -->";

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

function formatCurrency(value: number | string | null) {
  const amount = typeof value === "string" ? Number(value) : value;

  if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
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
    return "AI Contest";
  }

  return categories
    .map((category) => contestCategoryOptions.find((option) => option.id === category)?.label ?? category)
    .join(", ");
}

function buildLineupTable(contests: ReadmeContestRow[]) {
  const lines = [
    "| Deadline | Contest | Organizer | Prize | Category |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const contest of contests) {
    lines.push(
      `| ${formatDate(contest.deadline)} | [${contest.title}](https://ai-contest-cloud.vercel.app/contests/${contest.slug}) | ${contest.organizer} | ${formatCurrency(contest.prize_pool_krw)} | ${formatCategories(contest.ai_categories)} |`,
    );
  }

  return lines.join("\n");
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
    .select("title, slug, organizer, deadline, prize_pool_krw, ai_categories, status")
    .eq("status", "published")
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Could not fetch contests for README refresh: ${error.message}`);
  }

  return ((data ?? []) as ReadmeContestRow[]).filter((contest) => contest.status === "published");
}

async function updateReadme() {
  const contests = await fetchPublishedContests();
  const readme = await readFile(README_PATH, "utf8");
  const startIndex = readme.indexOf(LINEUP_START);
  const endIndex = readme.indexOf(LINEUP_END);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("README lineup markers are missing or malformed.");
  }

  const nextBlock = `${LINEUP_START}\n${buildLineupTable(contests)}\n${LINEUP_END}`;
  const previousBlock = readme.slice(startIndex, endIndex + LINEUP_END.length);
  const nextReadme = readme.replace(previousBlock, nextBlock);

  if (nextReadme === readme) {
    console.log("README lineup is already up to date.");
    return;
  }

  await writeFile(README_PATH, nextReadme, "utf8");
  console.log(`README lineup refreshed with ${contests.length} contests.`);
}

updateReadme().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
