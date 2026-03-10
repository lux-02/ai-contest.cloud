import { redirect } from "next/navigation";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { isSupabaseConfigured } from "@/lib/admin-auth";
import { isGoogleAuthProviderEnabled } from "@/lib/server/auth-provider";
import { getViewerSession, sanitizeViewerNextPath } from "@/lib/server/viewer-auth";
import { getViewerReturnDescription } from "@/lib/viewer-next-path";

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
  const returnDescription = getViewerReturnDescription(nextPath);
  const errorMessage =
    error === "oauth_provider"
      ? googleEnabled
        ? "로그인 연결에 문제가 있었습니다. 다시 시도해 주세요."
        : "Google 로그인이 아직 준비되지 않았습니다. 잠시 후 다시 확인해 주세요."
      : error === "oauth"
        ? "로그인을 마치지 못했습니다. 다시 시도해 주세요."
        : undefined;

  if (session.user) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-96px)] max-w-7xl items-center px-6 py-12">
      <section className="surface-card mx-auto w-full max-w-xl rounded-[34px] p-8 md:p-10">
        <div className="eyebrow">로그인</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-5xl">
          저장과 진행 관리를 쓰려면 로그인해 주세요.
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          저장, 준비 중, 지원 완료 상태를 남기고 마감 알림까지 이어서 관리할 수 있습니다.
        </p>

        <div className="mt-6 rounded-[22px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
          {returnDescription} 로그인 후에는 <span className="font-semibold text-[var(--foreground)]">내 활동</span>에서 저장한 공고와 진행 상태도 함께 볼 수 있습니다.
        </div>

        {!isSupabaseConfigured() ? (
          <div className="mt-6 rounded-[18px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
            Supabase Auth 설정이 아직 연결되지 않았습니다.
          </div>
        ) : null}

        {isSupabaseConfigured() && !googleEnabled ? (
          <div className="mt-6 rounded-[18px] border border-[rgba(196,76,58,0.16)] bg-[rgba(196,76,58,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
            Google 로그인 설정이 아직 꺼져 있어 로그인 창을 열 수 없습니다.
          </div>
        ) : null}

        <div className="mt-8">
          <GoogleLoginButton nextPath={nextPath} errorMessage={errorMessage} disabled={!googleEnabled} />
        </div>
      </section>
    </main>
  );
}
