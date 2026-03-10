import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/admin-auth";
import { isGoogleAuthProviderEnabled } from "@/lib/server/auth-provider";
import { sanitizeViewerNextPath } from "@/lib/server/viewer-auth";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

export async function GET(request: NextRequest) {
  const nextPath = sanitizeViewerNextPath(request.nextUrl.searchParams.get("next"), "/my");
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);

  if (!isSupabaseConfigured()) {
    loginUrl.searchParams.set("error", "oauth_provider");
    return NextResponse.redirect(loginUrl);
  }

  if (!(await isGoogleAuthProviderEnabled())) {
    loginUrl.searchParams.set("error", "oauth_provider");
    return NextResponse.redirect(loginUrl);
  }

  const cookiesToSet: CookieToSet[] = [];
  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items) {
        items.forEach((item) => cookiesToSet.push(item));
      },
    },
  });

  const callbackUrl = new URL("/auth/callback", request.url);
  callbackUrl.searchParams.set("next", nextPath);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data.url) {
    loginUrl.searchParams.set("error", "oauth_provider");
    const errorResponse = NextResponse.redirect(loginUrl);

    cookiesToSet.forEach(({ name, value, options }) => {
      errorResponse.cookies.set(name, value, options);
    });

    return errorResponse;
  }

  const response = NextResponse.redirect(data.url);

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
