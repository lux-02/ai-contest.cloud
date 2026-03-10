import { logoutViewerAction } from "@/app/login/actions";
import { FaArrowRightFromBracket } from "react-icons/fa6";

export function ViewerLogoutButton() {
  return (
    <form action={logoutViewerAction}>
      <button
        type="submit"
        aria-label="로그아웃"
        title="로그아웃"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full px-0 text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)] sm:h-auto sm:w-auto sm:gap-2 sm:px-3"
      >
        <FaArrowRightFromBracket className="text-[13px] sm:text-[11px]" aria-hidden="true" />
        <span className="hidden sm:inline">로그아웃</span>
      </button>
    </form>
  );
}
