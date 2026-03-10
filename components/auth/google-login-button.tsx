import { FaGoogle } from "react-icons/fa6";

type GoogleLoginButtonProps = {
  nextPath: string;
  errorMessage?: string;
  disabled?: boolean;
};

export function GoogleLoginButton({ nextPath, errorMessage, disabled = false }: GoogleLoginButtonProps) {
  return (
    <div className="space-y-3">
      {disabled ? (
        <span className="primary-button w-full cursor-not-allowed gap-2 opacity-50">
          <FaGoogle className="text-[13px]" aria-hidden="true" />
          Google 설정 필요
        </span>
      ) : (
        <a href={`/auth/google?next=${encodeURIComponent(nextPath)}`} className="primary-button w-full gap-2">
          <FaGoogle className="text-[13px]" aria-hidden="true" />
          Google로 10초 만에 시작하기
        </a>
      )}
      {errorMessage ? (
        <div className="rounded-[18px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
