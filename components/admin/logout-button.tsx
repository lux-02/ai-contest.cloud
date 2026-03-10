import { logoutAdminAction } from "@/app/admin/logout/actions";

export function LogoutButton() {
  return (
    <form action={logoutAdminAction}>
      <button type="submit" className="secondary-button">
        로그아웃
      </button>
    </form>
  );
}
