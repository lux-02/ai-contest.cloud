import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAdminAuthEnabled, isAdminEmail } from "@/lib/admin-auth";
import { updateSupabaseSession } from "@/lib/supabase-proxy";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);
  const pathname = request.nextUrl.pathname;

  if (pathname === "/login" && user) {
    const nextPath = request.nextUrl.searchParams.get("next");
    const redirectUrl = new URL(nextPath && nextPath.startsWith("/") ? nextPath : "/my", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (!pathname.startsWith("/admin")) {
    return response;
  }

  if (!isAdminAuthEnabled()) {
    return response;
  }

  const isAdmin = isAdminEmail(user?.email);

  if (pathname === "/admin/login") {
    if (!isAdmin) {
      return response;
    }

    const nextPath = request.nextUrl.searchParams.get("next");
    const redirectUrl = new URL(nextPath && nextPath.startsWith("/") ? nextPath : "/admin/contests", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAdmin) {
    return response;
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
