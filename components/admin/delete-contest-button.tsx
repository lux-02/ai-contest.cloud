"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type DeleteContestButtonProps = {
  action: () => Promise<void>;
  subject?: string;
  fullWidth?: boolean;
};

export function DeleteContestButton({
  action,
  subject = "이 대회",
  fullWidth = false,
}: DeleteContestButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className={cn("danger-button", fullWidth && "w-full")}
        onClick={() => setConfirming(true)}
      >
        삭제
      </button>
    );
  }

  return (
    <div className={cn("space-y-2", fullWidth && "w-full")}>
      <div className="rounded-[18px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
        {subject}를 삭제하면 분석 결과와 배지도 함께 사라집니다.
      </div>
      <div className="flex flex-wrap gap-2">
        <form action={action} className={cn(fullWidth && "flex-1")}>
          <button type="submit" className={cn("danger-button", fullWidth && "w-full")}>
            정말 삭제
          </button>
        </form>
        <button
          type="button"
          className={cn("secondary-button", fullWidth && "flex-1")}
          onClick={() => setConfirming(false)}
        >
          취소
        </button>
      </div>
    </div>
  );
}
