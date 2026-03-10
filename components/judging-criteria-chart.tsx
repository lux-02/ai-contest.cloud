import type { ContestJudgingCriterion } from "@/types/contest";

type JudgingCriteriaChartProps = {
  criteria: ContestJudgingCriterion[];
};

function normalizeCriteria(criteria: ContestJudgingCriterion[]) {
  const weighted = criteria.filter((criterion) => typeof criterion.weight === "number" && criterion.weight > 0);

  if (weighted.length === criteria.length && weighted.length > 0) {
    const totalWeight = weighted.reduce((sum, criterion) => sum + Number(criterion.weight ?? 0), 0) || 1;

    return criteria.map((criterion) => ({
      ...criterion,
      displayWeight: Number(criterion.weight ?? 0),
      widthPercent: Math.max(10, (Number(criterion.weight ?? 0) / totalWeight) * 100),
    }));
  }

  const evenWidth = criteria.length > 0 ? 100 / criteria.length : 0;

  return criteria.map((criterion) => ({
    ...criterion,
    displayWeight: criterion.weight ?? null,
    widthPercent: Math.max(16, evenWidth),
  }));
}

export function JudgingCriteriaChart({ criteria }: JudgingCriteriaChartProps) {
  const normalized = normalizeCriteria(criteria);

  if (normalized.length === 0) {
    return <p className="mt-3 text-sm leading-6 text-[var(--muted)]">심사 기준 정보 미정</p>;
  }

  return (
    <div className="mt-4 space-y-4">
      {normalized.map((criterion) => (
        <div key={`${criterion.label}-${criterion.weight ?? "none"}`} className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--foreground)]">{criterion.label}</div>
            {criterion.displayWeight ? (
              <div className="text-xs font-semibold text-[var(--muted)]">{criterion.displayWeight}%</div>
            ) : null}
          </div>
          <div className="judging-bar">
            <div className="judging-bar-fill" style={{ width: `${criterion.widthPercent}%` }} />
          </div>
          {criterion.description ? (
            <p className="text-sm leading-6 text-[var(--muted)]">{criterion.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
