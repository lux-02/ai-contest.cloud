import "server-only";

import { redirect } from "next/navigation";

import { isAdminEmail, isSupabaseConfigured } from "@/lib/admin-auth";
import { getSupabaseServerClient } from "@/lib/server/supabase";

export function sanitizeViewerNextPath(nextPath?: string | null, fallback = "/my") {
  if (!nextPath || !nextPath.startsWith("/")) {
    return fallback;
  }

  return nextPath;
}

export async function getViewerSession() {
  if (!isSupabaseConfigured()) {
    return {
      enabled: false,
      user: null,
      isAdmin: false,
    };
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      enabled: true,
      user: null,
      isAdmin: false,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    enabled: true,
    user,
    isAdmin: isAdminEmail(user?.email),
  };
}

export async function requireViewerUser(nextPath = "/my") {
  const session = await getViewerSession();

  if (!session.user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return session.user;
}

export async function clearViewerSession() {
  const supabase = await getSupabaseServerClient();
  await supabase?.auth.signOut();
}
