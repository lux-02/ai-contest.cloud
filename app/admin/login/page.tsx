import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { isAdminAuthEnabled } from "@/lib/admin-auth";
import { loginAdminAction } from "@/app/admin/login/actions";
import {
  getAdminLoginDefaultEmail,
  isAdminSessionAuthenticated,
  sanitizeAdminNextPath,
} from "@/lib/server/admin-auth";

type PageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const nextPath = sanitizeAdminNextPath(next);

  if (!isAdminAuthEnabled()) {
    redirect(nextPath);
  }

  const authenticated = await isAdminSessionAuthenticated();

  if (authenticated) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] max-w-7xl items-center px-6 py-12">
      <section className="surface-card mx-auto w-full max-w-xl rounded-[34px] p-8 md:p-10">
        <div className="eyebrow">관리자 접근</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
          관리자 화면은 Supabase 로그인으로 보호됩니다.
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          공모전 등록, 수정, 삭제와 포스터 업로드는 로그인한 관리자 세션에서만 열립니다.
        </p>
        <div className="mt-6 rounded-[22px] border border-[var(--border)] bg-white/80 px-4 py-4 text-sm leading-6 text-[var(--muted)]">
          관리자 이메일과 비밀번호를 입력하면 직전에 요청한 관리자 페이지로 바로 이동합니다.
        </div>
        <div className="mt-8">
          <AdminLoginForm
            action={loginAdminAction}
            nextPath={nextPath}
            defaultEmail={getAdminLoginDefaultEmail()}
          />
        </div>
      </section>
    </main>
  );
}
