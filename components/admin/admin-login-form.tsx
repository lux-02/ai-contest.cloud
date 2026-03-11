"use client";

import { useActionState } from "react";
import { FaSpinner } from "react-icons/fa6";

export type AdminLoginState = {
  status: "idle" | "error";
  message?: string;
};

const adminLoginInitialState: AdminLoginState = {
  status: "idle",
};

type AdminLoginFormProps = {
  action: (state: AdminLoginState, formData: FormData) => Promise<AdminLoginState>;
  nextPath: string;
  defaultEmail?: string;
};

const fieldClassName =
  "w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[rgba(245,241,232,0.18)] focus:bg-[rgba(255,255,255,0.05)]";

export function AdminLoginForm({ action, nextPath, defaultEmail }: AdminLoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, adminLoginInitialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-[var(--foreground)]">관리자 이메일</span>
        <input
          name="email"
          type="email"
          className={fieldClassName}
          placeholder="admin@example.com"
          autoComplete="username"
          autoCapitalize="none"
          defaultValue={defaultEmail}
          required
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-[var(--foreground)]">관리자 비밀번호</span>
        <input
          name="password"
          type="password"
          className={fieldClassName}
          placeholder="관리자 비밀번호 입력"
          autoComplete="current-password"
          autoFocus
          required
        />
      </label>

      {state.status === "error" ? (
        <div className="rounded-[18px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.message}
        </div>
      ) : null}

      <button type="submit" disabled={isPending} className="primary-button w-full disabled:opacity-50">
        {isPending ? (
          <>
            <FaSpinner className="h-3.5 w-3.5 animate-spin" aria-hidden />
            확인 중...
          </>
        ) : (
          "관리자 로그인"
        )}
      </button>

      {isPending ? (
        <div className="loading-note">
          <span className="loading-note-spinner" aria-hidden />
          <div className="min-w-0">
            <div className="loading-note-title">관리자 세션을 확인하는 중</div>
            <div className="loading-note-body">로그인 정보와 권한을 검증하고 있습니다.</div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
