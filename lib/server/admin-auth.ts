import "server-only";

import { redirect } from "next/navigation";

import { getDefaultAdminEmail, isAdminAuthEnabled, isAdminEmail } from "@/lib/admin-auth";
import { getSupabaseServerClient } from "@/lib/server/supabase";

export type AdminLoginState = {
  status: "idle" | "error";
  message?: string;
};

export const adminLoginInitialState: AdminLoginState = {
  status: "idle",
};

export function sanitizeAdminNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/admin/contests";
  }

  return nextPath;
}

export async function getAdminSession() {
  if (!isAdminAuthEnabled()) {
    return {
      enabled: false,
      user: null,
      accessToken: null,
    };
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      enabled: true,
      user: null,
      accessToken: null,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return {
      enabled: true,
      user: null,
      accessToken: null,
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    enabled: true,
    user,
    accessToken: session?.access_token ?? null,
  };
}

export async function isAdminSessionAuthenticated() {
  const session = await getAdminSession();
  return !session.enabled || Boolean(session.user);
}

export async function requireAdminSession(nextPath = "/admin/contests") {
  const authenticated = await isAdminSessionAuthenticated();

  if (!authenticated) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
}

export async function assertAdminAction(nextPath = "/admin/contests") {
  const authenticated = await isAdminSessionAuthenticated();

  if (!authenticated) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
}

export async function createAdminSession(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isAdminAuthEnabled()) {
    return {
      ok: true,
    };
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      ok: false,
      message: "Supabase 설정을 먼저 확인해 주세요.",
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.user) {
    return {
      ok: false,
      message: "이메일 또는 비밀번호가 맞지 않습니다.",
    };
  }

  if (!isAdminEmail(data.user.email)) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "관리자 권한이 없는 계정입니다.",
    };
  }

  return {
    ok: true,
  };
}

export async function clearAdminSession() {
  const supabase = await getSupabaseServerClient();
  await supabase?.auth.signOut();
}

export function getAdminLoginDefaultEmail() {
  return getDefaultAdminEmail();
}
