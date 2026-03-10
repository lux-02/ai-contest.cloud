import Link from "next/link";

import {
  setContestTrackingStatusAction,
  toggleContestReminderAction,
} from "@/app/contests/actions";
import { cn, formatReminderLabel } from "@/lib/utils";
import type { ContestTrackingState } from "@/types/contest";
import { contestTrackingStatusOptions } from "@/types/contest";

type ContestTrackingPanelProps = {
  contestId: string;
  slug: string;
  tracking: ContestTrackingState | null;
  isLoggedIn: boolean;
};

export function ContestTrackingPanel({
  contestId,
  slug,
  tracking,
  isLoggedIn,
}: ContestTrackingPanelProps) {
  const nextPath = `/contests/${slug}`;

  if (!isLoggedIn) {
    return (
      <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
        <div className="text-sm font-semibold text-[var(--foreground)]">참가 트래킹</div>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          로그인하면 Saved, Planning, Applied 상태를 남기고 마감 3일 전 reminder를 켤 수 있습니다.
        </p>
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="primary-button mt-4 w-full">
          Google로 로그인
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--foreground)]">참가 트래킹</div>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            상태를 저장하고 마감 reminder를 켜두면 내 활동 페이지에서 모아볼 수 있습니다.
          </p>
        </div>
        <Link href="/my" className="secondary-button">
          내 활동 보기
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {contestTrackingStatusOptions.map((option) => {
          const isActive = tracking?.status === option.id;

          return (
            <form key={option.id} action={setContestTrackingStatusAction}>
              <input type="hidden" name="contestId" value={contestId} />
              <input type="hidden" name="status" value={option.id} />
              <input type="hidden" name="next" value={nextPath} />
              <button
                type="submit"
                className={cn(
                  "w-full rounded-[18px] border px-4 py-3 text-sm font-semibold transition",
                  isActive
                    ? "border-[rgba(245,241,232,0.18)] bg-[var(--accent)] text-[#090b0f]"
                    : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)] hover:border-[rgba(245,241,232,0.18)]",
                )}
              >
                {option.label}
              </button>
            </form>
          );
        })}
      </div>

      <form action={toggleContestReminderAction} className="mt-4">
        <input type="hidden" name="contestId" value={contestId} />
        <input type="hidden" name="next" value={nextPath} />
        <input
          type="hidden"
          name="reminderEnabled"
          value={tracking?.reminderEnabled ? "false" : "true"}
        />
        <input type="hidden" name="reminderDaysBefore" value={tracking?.reminderDaysBefore ?? 3} />
        <button
          type="submit"
          className={cn(
            "w-full rounded-[18px] border px-4 py-3 text-sm font-semibold transition",
            tracking?.reminderEnabled
              ? "border-[rgba(85,122,87,0.2)] bg-[rgba(85,122,87,0.08)] text-[var(--success)]"
              : "border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)] hover:border-[rgba(245,241,232,0.18)]",
          )}
        >
          {tracking?.reminderEnabled
            ? `${formatReminderLabel(tracking.reminderDaysBefore)} 켜짐`
            : formatReminderLabel(3)}
        </button>
      </form>
    </div>
  );
}
