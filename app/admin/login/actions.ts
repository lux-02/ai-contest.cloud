"use server";

import { redirect } from "next/navigation";

import type { AdminLoginState } from "@/lib/server/admin-auth";
import { createAdminSession, sanitizeAdminNextPath } from "@/lib/server/admin-auth";

export async function loginAdminAction(
  _previousState: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeAdminNextPath(String(formData.get("next") ?? "/admin/contests"));
  const created = await createAdminSession(email, password);

  if (!created.ok) {
    return {
      status: "error",
      message: created.message,
    };
  }

  redirect(nextPath);
}
