import Image from "next/image";

import type { Contest } from "@/types/contest";
import { formatCategory, formatDeadlineLabel, formatMode } from "@/lib/utils";

type ContestPosterProps = {
  contest: Contest;
};

function getPosterAccent(category?: Contest["aiCategories"][number]) {
  switch (category) {
    case "llm-agents":
      return "from-[#f6f2e9] via-[#ede7dc] to-[#e7e0d2]";
    case "generative-ai":
      return "from-[#f7efe7] via-[#f0e4d7] to-[#ebe0d4]";
    case "computer-vision":
      return "from-[#f3f1ea] via-[#e7ecdf] to-[#dde6d7]";
    case "multimodal-ai":
      return "from-[#f6f1ea] via-[#ece7e4] to-[#e4dfeb]";
    default:
      return "from-[#f6f2ea] via-[#ece7df] to-[#e6e1d7]";
  }
}

export function ContestPoster({ contest }: ContestPosterProps) {
  if (contest.posterImageUrl) {
    return (
      <div className="poster-shell">
        <Image
          src={contest.posterImageUrl}
          alt={`${contest.title} 공고 이미지`}
          fill
          unoptimized
          sizes="(max-width: 1024px) 100vw, 420px"
          className="object-cover"
        />
      </div>
    );
  }

  const leadCategory = contest.aiCategories[0];

  return (
    <div className={`poster-shell bg-gradient-to-br ${getPosterAccent(leadCategory)}`}>
      <div className="poster-noise" />
      <div className="absolute -right-10 top-5 h-32 w-32 rounded-full bg-black/4 blur-3xl" />
      <div className="absolute left-8 top-20 h-40 w-40 rounded-full border border-black/6 bg-white/50" />
      <div className="relative flex h-full flex-col justify-between p-5 text-[var(--foreground)]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">공고 포스터</div>
          <div className="mt-4 max-w-[88%] text-[1.7rem] font-semibold leading-[1.04] tracking-[-0.06em]">{contest.title}</div>
          <div className="mt-3 text-sm font-medium text-[var(--muted)]">{contest.organizer}</div>
          <div className="mt-3 inline-flex rounded-full border border-black/8 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
            {leadCategory ? formatCategory(leadCategory) : "AI Contest"}
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--foreground)]">
            <div className="rounded-[18px] border border-black/8 bg-white/66 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">마감</div>
              <div className="mt-1 text-sm font-semibold">{formatDeadlineLabel(contest.deadline)}</div>
            </div>
            <div className="rounded-[18px] border border-black/8 bg-white/66 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">방식</div>
              <div className="mt-1 text-sm font-semibold">{formatMode(contest.participationMode)}</div>
            </div>
          </div>
          <p className="max-w-[92%] text-sm leading-6 text-[var(--muted)]">{contest.analysis.summary || contest.shortDescription}</p>
        </div>
      </div>
    </div>
  );
}
