"use client";

import { useState } from "react";
import {
  FaArrowUpRightFromSquare,
  FaBell,
  FaBookmark,
  FaCheck,
  FaEye,
  FaLightbulb,
  FaXmark,
} from "react-icons/fa6";

import {
  setContestTrackingStatusAction,
  toggleContestReminderAction,
} from "@/app/contests/actions";
import { cn, formatCompactNumber, formatReminderLabel } from "@/lib/utils";
import { getViewerContinueActionLabel, getViewerReturnDescription } from "@/lib/viewer-next-path";
import type { ContestTrackingState, ContestTrackingStatus } from "@/types/contest";

type ContestHeroActionsProps = {
  contestId: string;
  slug: string;
  tracking: ContestTrackingState | null;
  isLoggedIn: boolean;
  viewCount?: number;
  applyCount?: number;
};

type TrackingOption = {
  id: ContestTrackingStatus;
  label: string;
  icon: typeof FaBookmark;
};

const trackingOptions: TrackingOption[] = [
  { id: "saved", label: "Saved", icon: FaBookmark },
  { id: "planning", label: "Planning", icon: FaLightbulb },
  { id: "applied", label: "Applied", icon: FaCheck },
];

function MetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FaEye;
  label: string;
  value?: number;
}) {
  return (
    <div className="metric-icon-pill" title={label}>
      <Icon className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
      <span>{formatCompactNumber(value)}</span>
    </div>
  );
}

export function ContestHeroActions({
  contestId,
  slug,
  tracking,
  isLoggedIn,
  viewCount,
  applyCount,
}: ContestHeroActionsProps) {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const nextPath = `/contests/${slug}`;
  const loginActionLabel = getViewerContinueActionLabel(nextPath);
  const returnDescription = getViewerReturnDescription(nextPath);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <MetricPill icon={FaEye} label="조회수" value={viewCount} />
        <MetricPill icon={FaArrowUpRightFromSquare} label="신청 클릭" value={applyCount} />

        {trackingOptions.map((option) => {
          const Icon = option.icon;
          const isActive = tracking?.status === option.id;

          if (!isLoggedIn) {
            return (
              <button
                key={option.id}
                type="button"
                title={option.label}
                aria-label={option.label}
                onClick={openLoginModal}
                className={cn("hero-action-button", isActive && "is-active")}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </button>
            );
          }

          return (
            <form key={option.id} action={setContestTrackingStatusAction}>
              <input type="hidden" name="contestId" value={contestId} />
              <input type="hidden" name="status" value={option.id} />
              <input type="hidden" name="next" value={nextPath} />
              <button
                type="submit"
                title={option.label}
                aria-label={option.label}
                aria-pressed={isActive}
                className={cn("hero-action-button", isActive && "is-active")}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </button>
            </form>
          );
        })}

        {isLoggedIn ? (
          <form action={toggleContestReminderAction}>
            <input type="hidden" name="contestId" value={contestId} />
            <input type="hidden" name="next" value={nextPath} />
            <input type="hidden" name="reminderEnabled" value={tracking?.reminderEnabled ? "false" : "true"} />
            <input type="hidden" name="reminderDaysBefore" value={tracking?.reminderDaysBefore ?? 3} />
            <button
              type="submit"
              title={tracking?.reminderEnabled ? `${formatReminderLabel(tracking.reminderDaysBefore)} 끄기` : formatReminderLabel(3)}
              aria-label="마감 알림"
              aria-pressed={tracking?.reminderEnabled ?? false}
              className={cn("hero-action-button", tracking?.reminderEnabled && "is-reminder")}
            >
              <FaBell className="h-3.5 w-3.5" aria-hidden />
            </button>
          </form>
        ) : (
          <button type="button" onClick={openLoginModal} aria-label="마감 알림" className="hero-action-button">
            <FaBell className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      {isLoginModalOpen ? (
        <div className="login-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="contest-login-title">
          <div className="login-modal-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow">로그인 필요</div>
                <h3 id="contest-login-title" className="mt-3 text-xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  로그인 후 저장과 진행 상태를 바로 이어서 관리할 수 있습니다.
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {returnDescription} 저장한 공고와 마감 알림은 내 활동에서 다시 볼 수 있습니다.
                </p>
              </div>
              <button type="button" onClick={closeLoginModal} className="hero-action-button shrink-0" aria-label="닫기">
                <FaXmark className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href={`/auth/google?next=${encodeURIComponent(nextPath)}`} className="primary-button flex-1">
                {loginActionLabel}
              </a>
              <button type="button" onClick={closeLoginModal} className="secondary-button flex-1">
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
