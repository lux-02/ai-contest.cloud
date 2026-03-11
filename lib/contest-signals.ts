import type { ContestOrganizerType } from "../types/contest";

function parseMoneyMentions(text: string) {
  const normalized = text.replace(/,/g, "");
  let total = 0;

  for (const match of normalized.matchAll(/(\d+(?:\.\d+)?)\s*억\s*원?/g)) {
    total += Number(match[1]) * 100_000_000;
  }

  for (const match of normalized.matchAll(/(\d+(?:\.\d+)?)\s*만원/g)) {
    total += Number(match[1]) * 10_000;
  }

  for (const match of normalized.matchAll(/(\d+(?:\.\d+)?)\s*천원/g)) {
    total += Number(match[1]) * 1_000;
  }

  if (total > 0) {
    return total;
  }

  for (const match of normalized.matchAll(/₩\s*(\d+(?:\.\d+)?)/g)) {
    total += Number(match[1]);
  }

  if (total > 0) {
    return total;
  }

  return null;
}

function formatCompactKrw(value: number) {
  if (value >= 100_000_000) {
    return `약 ${(value / 100_000_000).toFixed(value % 100_000_000 === 0 ? 0 : 1)}억원`;
  }

  if (value >= 10_000) {
    return `약 ${new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: value % 10_000 === 0 ? 0 : 1,
    }).format(value / 10_000)}만원`;
  }

  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

export function deriveOrganizerType(
  organizer: string,
  ...contextSignals: Array<string | undefined | null>
): ContestOrganizerType {
  const organizerNormalized = organizer.toLowerCase();
  const contextNormalized = contextSignals
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const combinedNormalized = `${organizerNormalized} ${contextNormalized}`.trim();

  if (
    /정부|공공|부처|청|시청|구청|도청|한국|kotra|진흥원|공사|산업통상|과학기술|ministry|government|agency/.test(
      organizerNormalized,
    )
  ) {
    return "government";
  }

  if (/재단|foundation/.test(organizerNormalized)) {
    return "foundation";
  }

  if (/대학교|대학|university|college/.test(organizerNormalized)) {
    return "university";
  }

  if (
    /openai|google|naver|kakao|samsung|lg|hyundai|volkswagen|폭스바겐|microsoft|amazon|meta|apple|tesla|bmw|benz|mercedes|toyota/.test(
      combinedNormalized,
    )
  ) {
    return "enterprise";
  }

  if (/startup|works|labs|lab|studio|커뮤니케이션|communications|creative/.test(organizerNormalized)) {
    return "startup";
  }

  return "community";
}

export function buildPrizeHeadline(prizeSummary?: string | null, prizePoolKrw?: number | string | null) {
  const source = prizeSummary?.replace(/\r/g, "\n") ?? "";
  const normalizedLines = source
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  const parsedPrize =
    typeof prizePoolKrw === "number"
      ? prizePoolKrw
      : typeof prizePoolKrw === "string"
        ? Number(prizePoolKrw)
        : null;
  const moneyFromText = parseMoneyMentions(source);
  const comparableCash = moneyFromText ?? (parsedPrize && Number.isFinite(parsedPrize) ? parsedPrize : null);
  const hasExperienceReward = /해외|독일|항공권|숙박|행사 참여|프로그램 참여|레이스|투어|초청/.test(source);

  if (comparableCash && comparableCash > 0) {
    if (hasExperienceReward) {
      return `${formatCompactKrw(comparableCash)} + 해외 프로그램`;
    }

    return formatCompactKrw(comparableCash);
  }

  if (normalizedLines.length > 0) {
    const lead = normalizedLines[0];
    return lead.length > 34 ? `${lead.slice(0, 33).trim()}…` : lead;
  }

  return "상금 미정";
}
