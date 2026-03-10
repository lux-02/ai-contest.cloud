import { FaGoogle } from "react-icons/fa6";

import { getViewerGoogleActionLabel, getViewerReturnDescription } from "@/lib/viewer-next-path";

type GoogleLoginButtonProps = {
  nextPath: string;
  errorMessage?: string;
  disabled?: boolean;
};

export function GoogleLoginButton({ nextPath, errorMessage, disabled = false }: GoogleLoginButtonProps) {
  const buttonLabel = getViewerGoogleActionLabel(nextPath);
  const returnDescription = getViewerReturnDescription(nextPath);

  return (
    <div className="space-y-3">
      {disabled ? (
        <span className="primary-button w-full cursor-not-allowed gap-2 opacity-50">
          <FaGoogle className="text-[13px]" aria-hidden="true" />
          Google 로그인 준비 중
        </span>
      ) : (
        <a href={`/auth/google?next=${encodeURIComponent(nextPath)}`} className="primary-button w-full gap-2">
          <FaGoogle className="text-[13px]" aria-hidden="true" />
          {buttonLabel}
        </a>
      )}
      <p className="text-sm leading-6 text-[var(--muted)]">{returnDescription}</p>
      {errorMessage ? (
        <div className="rounded-[18px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
