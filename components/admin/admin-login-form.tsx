"use client";

import { useActionState } from "react";

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
  "w-full rounded-[18px] border border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[rgba(15,111,255,0.18)]";

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
        {isPending ? "확인 중..." : "관리자 로그인"}
      </button>
    </form>
  );
}
