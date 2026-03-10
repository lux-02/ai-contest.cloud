import "server-only";

import type { Contest } from "@/types/contest";

export type CollectedStrategySource = {
  label: string;
  sourceType: string;
  url?: string | null;
  title: string;
  snippet: string;
  contentText: string;
  httpStatus?: number | null;
  searchQuery?: string | null;
  rankingScore: number;
  citationScore: number;
  selectedForCitation: boolean;
};

type SearchQuery = {
  query: string;
  reason: string;
};

type SourceCandidate = {
  sourceType: string;
  url?: string | null;
  titleHint: string;
  contentText?: string;
  snippet?: string;
  searchQuery?: string | null;
};

type SearchResult = {
  provider: string;
  query: string;
  url: string;
  title: string;
  snippet: string;
};

const SOURCE_TIMEOUT_MS = 5000;
const SEARCH_TIMEOUT_MS = 4000;
const SEARCH_QUERY_LIMIT = 4;
const SEARCH_RESULTS_PER_QUERY = 3;
const MAX_FETCHED_SEARCH_RESULTS = 5;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number) {
  return Number(clamp(value).toFixed(4));
}

function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlToText(html: string) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/h\d)>/gi, "\n")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function stripHtml(html: string) {
  return normalizeWhitespace(decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")));
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit).trim()}…`;
}

function extractTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return normalizeWhitespace(decodeHtmlEntities(titleMatch[1]));
  }

  return null;
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url.startsWith("//") ? `https:${url}` : url);
    const redirected = parsed.searchParams.get("uddg");

    if (redirected) {
      return normalizeUrl(decodeURIComponent(redirected));
    }

    parsed.hash = "";
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("utm_content");
    parsed.searchParams.delete("utm_term");
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function getHostname(url?: string | null) {
  if (!url) {
    return "";
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function tokenize(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  );
}

function overlapRatio(haystack: string, needles: string[]) {
  if (needles.length === 0) {
    return 0;
  }

  const lower = haystack.toLowerCase();
  const hits = needles.filter((token) => lower.includes(token.toLowerCase())).length;
  return hits / needles.length;
}

function buildContestSignals(contest: Contest) {
  const titleTokens = tokenize(contest.title);
  const organizerTokens = tokenize(contest.organizer);
  const tagTokens = contest.tags.flatMap(tokenize);
  const categoryTokens = contest.aiCategories.flatMap(tokenize);

  return Array.from(new Set([...titleTokens, ...organizerTokens, ...tagTokens, ...categoryTokens])).slice(0, 18);
}

function buildContestSpecificSignals(contest: Contest) {
  return Array.from(
    new Set(tokenize([contest.title, contest.shortDescription, contest.description.slice(0, 220)].filter(Boolean).join(" "))),
  ).slice(0, 12);
}

function buildOfficialHosts(contest: Contest) {
  return new Set([contest.url, contest.sourceUrl, contest.applyUrl].map(getHostname).filter(Boolean));
}

function buildHeuristicQueries(contest: Contest) {
  const queries: SearchQuery[] = [
    { query: `${contest.title} 공모전`, reason: "공식 공고와 요강 찾기" },
    { query: `${contest.title} 심사 기준`, reason: "평가 기준 검증" },
    { query: `${contest.title} 신청 링크`, reason: "접수 페이지 검증" },
    { query: `${contest.organizer} ${contest.title}`, reason: "주최 측 출처 찾기" },
    { query: `${contest.title} 생성형 AI`, reason: "관련 맥락 자료 찾기" },
  ];

  return dedupeQueries(queries).slice(0, SEARCH_QUERY_LIMIT);
}

function dedupeQueries(queries: SearchQuery[]) {
  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = query.query.toLowerCase().trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function generateSearchQueries(contest: Contest) {
  const heuristics = buildHeuristicQueries(contest);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    return heuristics;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "contest_search_queries",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                queries: {
                  type: "array",
                  minItems: 3,
                  maxItems: SEARCH_QUERY_LIMIT,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      query: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["query", "reason"],
                  },
                },
              },
              required: ["queries"],
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "Generate Korean web search queries for verifying AI contest information. Prioritize official pages, judging criteria, application pages, and coverage that can support citations.",
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                title: contest.title,
                organizer: contest.organizer,
                summary: contest.shortDescription,
                tags: contest.tags,
                url: contest.url,
                sourceUrl: contest.sourceUrl,
                applyUrl: contest.applyUrl,
              },
              null,
              2,
            ),
          },
        ],
      }),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return heuristics;
    }

    const raw = await response.json();
    const content = raw?.choices?.[0]?.message?.content;

    if (!content) {
      return heuristics;
    }

    const parsed = JSON.parse(content) as { queries?: SearchQuery[] };
    return dedupeQueries([...(parsed.queries ?? []), ...heuristics]).slice(0, SEARCH_QUERY_LIMIT);
  } catch {
    return heuristics;
  }
}

async function searchWithTavily(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return [];
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_raw_content: false,
      max_results: SEARCH_RESULTS_PER_QUERY,
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    results?: { url: string; title: string; content?: string }[];
  };

  return (payload.results ?? []).map((item) => ({
    provider: "tavily",
    query,
    url: normalizeUrl(item.url),
    title: item.title,
    snippet: item.content ?? "",
  }));
}

async function searchWithSerper(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    return [];
  }

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: SEARCH_RESULTS_PER_QUERY,
      hl: "ko",
      gl: "kr",
    }),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    organic?: { link: string; title: string; snippet?: string }[];
  };

  return (payload.organic ?? []).map((item) => ({
    provider: "serper",
    query,
    url: normalizeUrl(item.link),
    title: item.title,
    snippet: item.snippet ?? "",
  }));
}

async function searchWithBingRss(query: string): Promise<SearchResult[]> {
  const response = await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": "AIContestCloudResearchBot/1.0 (+https://ai-contest.cloud)",
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
    },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    return [];
  }

  const xml = await response.text();
  const matches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));

  return matches.slice(0, SEARCH_RESULTS_PER_QUERY).map((match) => {
    const item = match[1] ?? "";
    const title = stripHtml(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const link = decodeHtmlEntities(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "").trim();
    const description = stripHtml(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "");

    return {
      provider: "bing-rss",
      query,
      url: normalizeUrl(link),
      title,
      snippet: description,
    };
  });
}

async function searchWithDuckDuckGo(query: string): Promise<SearchResult[]> {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      "User-Agent": "AIContestCloudResearchBot/1.0 (+https://ai-contest.cloud)",
    },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const links = Array.from(
    html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi),
  ).slice(0, SEARCH_RESULTS_PER_QUERY);

  return links.map((match) => ({
    provider: "duckduckgo-html",
    query,
    url: normalizeUrl(decodeHtmlEntities(match[1] ?? "")),
    title: stripHtml(match[2] ?? ""),
    snippet: "",
  }));
}

async function searchExternal(query: string) {
  const providers = [searchWithTavily, searchWithSerper, searchWithBingRss, searchWithDuckDuckGo];

  for (const provider of providers) {
    try {
      const results = await provider(query);
      if (results.length > 0) {
        return results;
      }
    } catch {
      continue;
    }
  }

  return [];
}

function getTrustScore(hostname: string) {
  if (!hostname) {
    return 0.2;
  }

  if (/\.gov(\.|$)|\.go\.kr$/.test(hostname)) {
    return 1;
  }

  if (/\.edu(\.|$)|\.ac\.kr$/.test(hostname)) {
    return 0.92;
  }

  if (/forms\.gle$|docs\.google\.com$/.test(hostname)) {
    return 0.72;
  }

  if (/notion\.site$|medium\.com$|velog\.io$/.test(hostname)) {
    return 0.48;
  }

  return 0.58;
}

function scoreMetadataResult(result: SearchResult, contest: Contest, officialHosts: Set<string>) {
  const hostname = getHostname(result.url);
  const signals = buildContestSignals(contest);
  const titleScore = overlapRatio(result.title, signals);
  const snippetScore = overlapRatio(result.snippet, signals);
  const officialScore = officialHosts.has(hostname) ? 1 : 0;
  const trustScore = getTrustScore(hostname);

  return roundScore(0.42 * officialScore + 0.26 * titleScore + 0.16 * snippetScore + 0.16 * trustScore);
}

async function fetchSource(candidate: SourceCandidate) {
  if (!candidate.url) {
    const contentText = truncate(candidate.contentText ?? "", 6000);
    return {
      title: candidate.titleHint,
      snippet: truncate(candidate.snippet ?? candidate.contentText ?? "", 280),
      contentText,
      httpStatus: 200,
    };
  }

  try {
    const response = await fetch(candidate.url, {
      headers: {
        "User-Agent": "AIContestCloudResearchBot/1.0 (+https://ai-contest.cloud)",
      },
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") ?? "";
    const rawText = await response.text();
    const contentText = contentType.includes("text/html") ? htmlToText(rawText) : normalizeWhitespace(rawText);

    return {
      title: extractTitle(rawText) ?? candidate.titleHint,
      snippet: truncate(candidate.snippet ?? contentText, 280),
      contentText: truncate(contentText, 6000),
      httpStatus: response.status,
    };
  } catch {
    return {
      title: `${candidate.titleHint} 수집 실패`,
      snippet: candidate.snippet ?? "웹 페이지를 자동으로 읽지 못해 저장된 공고 본문을 우선 사용합니다.",
      contentText: "",
      httpStatus: null,
    };
  }
}

function scoreFetchedSource(
  source: {
    sourceType: string;
    url?: string | null;
    title: string;
    snippet: string;
    contentText: string;
    httpStatus?: number | null;
    searchQuery?: string | null;
    provisionalRanking?: number;
  },
  contest: Contest,
  officialHosts: Set<string>,
) {
  const hostname = getHostname(source.url);
  const signals = buildContestSignals(contest);
  const specificSignals = buildContestSpecificSignals(contest);
  const contentScore = overlapRatio(source.contentText, signals);
  const titleScore = overlapRatio(source.title, signals);
  const specificScore = overlapRatio(`${source.title}\n${source.snippet}\n${source.contentText.slice(0, 1500)}`, specificSignals);
  const officialScore = officialHosts.has(hostname) ? 1 : source.sourceType === "stored_brief" ? 1 : 0;
  const trustScore = getTrustScore(hostname);
  const lengthScore = clamp(source.contentText.length / 2500);
  const requirementHits = Array.from(source.contentText.matchAll(/심사|평가|모집|접수|신청|대상|마감|제출/g)).length;
  const requirementScore = requirementHits >= 2 ? 1 : requirementHits === 1 ? 0.55 : 0.15;
  const statusScore = source.httpStatus && source.httpStatus >= 200 && source.httpStatus < 400 ? 1 : 0.45;

  const rankingScore = roundScore(
    0.24 * officialScore +
      0.2 * titleScore +
      0.2 * contentScore +
      0.14 * specificScore +
      0.12 * trustScore +
      0.12 * lengthScore +
      0.1 * (source.provisionalRanking ?? 0),
    );

  const citationScore = roundScore(
    0.26 * officialScore +
      0.24 * specificScore +
      0.18 * contentScore +
      0.12 * titleScore +
      0.1 * requirementScore +
      0.06 * lengthScore +
      0.04 * statusScore,
  );

  return {
    rankingScore,
    citationScore,
  };
}

function selectCitationSources(
  sources: Array<CollectedStrategySource & { sourcePriority: number }>,
) {
  const sorted = [...sources].sort(
    (left, right) =>
      right.citationScore - left.citationScore ||
      right.rankingScore - left.rankingScore ||
      right.sourcePriority - left.sourcePriority,
  );

  const picked = new Set<string>();

  for (const source of sorted) {
    const shouldKeep =
      source.sourceType === "stored_brief" ||
      source.sourceType === "original_notice" ||
      (picked.size < 4 &&
        source.sourceType.startsWith("search_result:")
        ? source.citationScore >= 0.48 && source.rankingScore >= 0.34
        : source.citationScore >= 0.4);

    if (shouldKeep) {
      picked.add(`${source.title}|${source.url ?? source.sourceType}`);
    }
  }

  return sources.map((source) => ({
    ...source,
    selectedForCitation: picked.has(`${source.title}|${source.url ?? source.sourceType}`),
  }));
}

export async function collectContestSources(contest: Contest): Promise<CollectedStrategySource[]> {
  const officialHosts = buildOfficialHosts(contest);
  const queries = await generateSearchQueries(contest);
  const baseCandidates: Array<SourceCandidate & { sourcePriority: number; provisionalRanking?: number }> = [
    {
      sourceType: "stored_brief",
      titleHint: "저장된 공고 본문",
      contentText: contest.description,
      snippet: contest.shortDescription,
      sourcePriority: 10,
      searchQuery: null,
      provisionalRanking: 1,
    },
  ];

  const seenUrls = new Set<string>();

  const seedCandidates: Array<(SourceCandidate & { sourcePriority: number; provisionalRanking?: number }) | null> = [
    { sourceType: "original_notice", url: contest.url, titleHint: "원문 공고", sourcePriority: 9, searchQuery: null },
    contest.sourceUrl
      ? { sourceType: "source_page", url: contest.sourceUrl, titleHint: "수집 소스", sourcePriority: 8, searchQuery: null }
      : null,
    contest.applyUrl
      ? { sourceType: "apply_page", url: contest.applyUrl, titleHint: "신청 페이지", sourcePriority: 7, searchQuery: null }
      : null,
  ];

  for (const candidate of seedCandidates) {
    if (!candidate?.url) {
      continue;
    }

    const normalized = normalizeUrl(candidate.url);
    if (seenUrls.has(normalized)) {
      continue;
    }

    seenUrls.add(normalized);
    baseCandidates.push({ ...candidate, url: normalized });
  }

  const rawSearchResults = (
    await Promise.all(queries.map((query) => searchExternal(query.query)))
  ).flat();

  const dedupedSearchResults = rawSearchResults.filter((result) => {
    const normalized = normalizeUrl(result.url);
    if (!normalized || seenUrls.has(normalized)) {
      return false;
    }

    seenUrls.add(normalized);
    result.url = normalized;
    return true;
  });

  const topSearchResults = dedupedSearchResults
    .map((result) => ({
      result,
      provisionalRanking: scoreMetadataResult(result, contest, officialHosts),
    }))
    .sort((left, right) => right.provisionalRanking - left.provisionalRanking)
    .slice(0, MAX_FETCHED_SEARCH_RESULTS);

  for (const [index, searchResult] of topSearchResults.entries()) {
    baseCandidates.push({
      sourceType: `search_result:${searchResult.result.provider}`,
      url: searchResult.result.url,
      titleHint: searchResult.result.title,
      snippet: searchResult.result.snippet,
      searchQuery: searchResult.result.query,
      sourcePriority: 6 - index,
      provisionalRanking: searchResult.provisionalRanking,
    });
  }

  const fetched = await Promise.all(baseCandidates.map((candidate) => fetchSource(candidate)));

  const scored = fetched.map((source, index) => {
    const candidate = baseCandidates[index];
    const scores = scoreFetchedSource(
      {
        ...candidate,
        title: source.title,
        snippet: source.snippet,
        contentText: source.contentText,
        httpStatus: source.httpStatus,
      },
      contest,
      officialHosts,
    );

    return {
      label: "",
      sourceType: candidate.sourceType,
      url: candidate.url ?? null,
      title: source.title,
      snippet: source.snippet,
      contentText: source.contentText,
      httpStatus: source.httpStatus,
      searchQuery: candidate.searchQuery ?? null,
      rankingScore: scores.rankingScore,
      citationScore: scores.citationScore,
      selectedForCitation: false,
      sourcePriority: candidate.sourcePriority,
    };
  });

  const selected = selectCitationSources(scored)
    .sort(
      (left, right) =>
        Number(right.selectedForCitation) - Number(left.selectedForCitation) ||
        right.citationScore - left.citationScore ||
        right.rankingScore - left.rankingScore ||
        right.sourcePriority - left.sourcePriority,
    )
    .map(({ sourcePriority: _sourcePriority, ...source }, index) => ({
      ...source,
      label: `S${index + 1}`,
    }));

  return selected;
}
