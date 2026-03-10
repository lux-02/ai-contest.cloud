import Link from "next/link";
import { FaMagnifyingGlass } from "react-icons/fa6";

import { cn } from "@/lib/utils";
import {
  contestBadgeOptions,
  contestCategoryOptions,
  difficultyOptions,
  type ContestBadge,
  type ContestCategory,
  type ContestDifficulty,
} from "@/types/contest";

interface FilterBarProps {
  searchQuery?: string;
  selectedCategory?: ContestCategory;
  selectedBadge?: ContestBadge;
  selectedDifficulty?: ContestDifficulty;
  total: number;
}

function buildHref({
  query,
  category,
  badge,
  difficulty,
}: {
  query?: string;
  category?: ContestCategory;
  badge?: ContestBadge;
  difficulty?: ContestDifficulty;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (category) {
    params.set("category", category);
  }

  if (badge) {
    params.set("badge", badge);
  }

  if (difficulty) {
    params.set("difficulty", difficulty);
  }

  const serializedParams = params.toString();
  return serializedParams ? `/contests?${serializedParams}` : "/contests";
}

function FilterChip({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "rounded-full border px-3 py-2 text-sm font-semibold transition",
        isActive
          ? "border-[rgba(245,241,232,0.18)] bg-[rgba(255,255,255,0.08)] text-[var(--foreground)]"
          : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted)] hover:border-[rgba(245,241,232,0.18)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </Link>
  );
}

export function FilterBar({ searchQuery, selectedCategory, selectedBadge, selectedDifficulty, total }: FilterBarProps) {
  const hasExtraFilters = Boolean(selectedBadge || selectedDifficulty);
  const hasFilters = Boolean(searchQuery || selectedCategory || selectedBadge || selectedDifficulty);
  const activeFilters = [
    searchQuery ? `검색: ${searchQuery}` : null,
    selectedCategory ? contestCategoryOptions.find((option) => option.id === selectedCategory)?.label : null,
    selectedBadge ? contestBadgeOptions.find((option) => option.id === selectedBadge)?.label : null,
    selectedDifficulty ? difficultyOptions.find((option) => option.id === selectedDifficulty)?.label : null,
  ].flatMap((item) => (item ? [item] : []));

  return (
    <div className="surface-card sticky top-20 rounded-[28px] p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="eyebrow">탐색 필터</div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)] md:text-2xl">내 상황에 맞게 추리기</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            카테고리를 먼저 좁히고, 그다음 마감과 난도를 보세요. 결과물이 나올 확률이 높은 대회가 더 빨리 남습니다.
          </p>
          <p className="text-sm text-[var(--muted)]">{total}개 대회 표시 중</p>
        </div>

        <form action="/contests" className="flex flex-col gap-3">
          <label htmlFor="contest-search" className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            검색
          </label>
          <div className="flex items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
            <FaMagnifyingGlass className="h-4 w-4 text-[var(--muted)]" aria-hidden />
            <input
              id="contest-search"
              name="q"
              type="search"
              defaultValue={searchQuery}
              placeholder="대회명, 주최기관, 기술 스택으로 검색"
              className="h-full w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
            />
          </div>
          {selectedCategory ? <input type="hidden" name="category" value={selectedCategory} /> : null}
          {selectedBadge ? <input type="hidden" name="badge" value={selectedBadge} /> : null}
          {selectedDifficulty ? <input type="hidden" name="difficulty" value={selectedDifficulty} /> : null}
          <button type="submit" className="secondary-button w-full">
            검색 적용
          </button>
        </form>

        {hasFilters ? (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <span key={filter} className="signal-chip">
                <span className="signal-dot" />
                {filter}
              </span>
            ))}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">AI 분야</div>
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2 px-1">
              <FilterChip
                href={buildHref({ query: searchQuery, badge: selectedBadge, difficulty: selectedDifficulty })}
                isActive={!selectedCategory}
              >
                전체
              </FilterChip>
              {contestCategoryOptions.map((category) => (
                <FilterChip
                  key={category.id}
                  href={buildHref({
                    query: searchQuery,
                    category: category.id,
                    badge: selectedBadge,
                    difficulty: selectedDifficulty,
                  })}
                  isActive={selectedCategory === category.id}
                >
                  {category.label}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>

        <details
          className="rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
          open={hasExtraFilters}
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--foreground)]">
            추가 필터 {hasExtraFilters ? "적용됨" : ""}
          </summary>
          <div className="mt-4 space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">배지</div>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  href={buildHref({ query: searchQuery, category: selectedCategory, difficulty: selectedDifficulty })}
                  isActive={!selectedBadge}
                >
                  전체
                </FilterChip>
                {contestBadgeOptions.map((badge) => (
                  <FilterChip
                    key={badge.id}
                    href={buildHref({
                      query: searchQuery,
                      category: selectedCategory,
                      badge: badge.id,
                      difficulty: selectedDifficulty,
                    })}
                    isActive={selectedBadge === badge.id}
                  >
                    {badge.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">난도</div>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  href={buildHref({ query: searchQuery, category: selectedCategory, badge: selectedBadge })}
                  isActive={!selectedDifficulty}
                >
                  전체
                </FilterChip>
                {difficultyOptions.map((difficulty) => (
                  <FilterChip
                    key={difficulty.id}
                    href={buildHref({
                      query: searchQuery,
                      category: selectedCategory,
                      badge: selectedBadge,
                      difficulty: difficulty.id,
                    })}
                    isActive={selectedDifficulty === difficulty.id}
                  >
                    {difficulty.label}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>
        </details>

        {hasFilters ? (
          <Link href="/contests" scroll={false} className="secondary-button w-full">
            필터 초기화
          </Link>
        ) : null}
      </div>
    </div>
  );
}
