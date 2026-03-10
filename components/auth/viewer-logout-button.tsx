import { logoutViewerAction } from "@/app/login/actions";

export function ViewerLogoutButton() {
  return (
    <form action={logoutViewerAction}>
      <button type="submit" className="rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-black/4 hover:text-[var(--foreground)] md:px-4">
        로그아웃
      </button>
    </form>
  );
}
