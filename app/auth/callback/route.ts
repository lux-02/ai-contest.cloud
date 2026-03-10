import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/admin-auth";
import { sanitizeViewerNextPath } from "@/lib/server/viewer-auth";

export async function GET(request: NextRequest) {
  const nextPath = sanitizeViewerNextPath(request.nextUrl.searchParams.get("next"), "/my");
  const code = request.nextUrl.searchParams.get("code");
  const redirectUrl = new URL(nextPath, request.url);

  if (!isSupabaseConfigured() || !code) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set("error", "oauth");
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set("error", "oauth");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
