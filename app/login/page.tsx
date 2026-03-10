import { redirect } from "next/navigation";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { isGoogleAuthProviderEnabled } from "@/lib/server/auth-provider";
import { getViewerSession, sanitizeViewerNextPath } from "@/lib/server/viewer-auth";

type PageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { next, error } = await searchParams;
  const nextPath = sanitizeViewerNextPath(next, "/my");
  const session = await getViewerSession();
  const googleEnabled = await isGoogleAuthProviderEnabled();
  const errorMessage =
    error === "oauth_provider"
      ? googleEnabled
        ? "이전 로그인 시도에서 연결 오류가 있었지만 지금은 Google 로그인이 활성화되어 있습니다. 다시 시도해 주세요."
        : "Supabase에서 Google Provider가 아직 활성화되지 않았습니다. Dashboard에서 Google 로그인 설정을 먼저 켜야 합니다."
      : error === "oauth"
        ? "Google 로그인 응답을 처리하지 못했습니다. Supabase의 Google Provider와 허용 Redirect URL 설정을 확인해 주세요."
        : undefined;

  if (session.user) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] max-w-7xl items-center px-6 py-12">
      <section className="surface-card mx-auto w-full max-w-xl rounded-[34px] p-8 md:p-10">
        <div className="eyebrow">로그인</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
          참가 상태와 마감 알림을 저장하려면 로그인이 필요합니다.
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          Google로 로그인하면 Saved, Planning, Applied 상태를 남기고 마감 3일 전 reminder도 켤 수 있습니다.
        </p>

        <div className="mt-6 rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
          로그인 후에는 <span className="font-semibold text-[var(--foreground)]">내 활동</span>에서 저장한 대회와 신청 진행 상태를 한 번에 볼 수 있습니다.
        </div>

        {!isSupabaseConfigured() ? (
          <div className="mt-6 rounded-[18px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
            Supabase Auth 설정이 아직 연결되지 않았습니다.
          </div>
        ) : null}

        {isSupabaseConfigured() && !googleEnabled ? (
          <div className="mt-6 rounded-[18px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
            Supabase 프로젝트에서 Google Provider가 꺼져 있습니다. 먼저 Google 로그인 설정을 활성화해야 실제 OAuth가 동작합니다.
          </div>
        ) : null}

        <div className="mt-8">
          <GoogleLoginButton nextPath={nextPath} errorMessage={errorMessage} disabled={!googleEnabled} />
        </div>
      </section>
    </main>
  );
}
