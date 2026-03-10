import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Instrument_Serif, Manrope } from "next/font/google";

import { ViewerLogoutButton } from "@/components/auth/viewer-logout-button";
import { getViewerSession } from "@/lib/server/viewer-auth";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: {
    default: "AI Contest Cloud",
    template: "%s | AI Contest Cloud",
  },
  description: "한국 대학생과 취준생을 위한 AI 공모전 전략 플랫폼. 대회 탐색, 우승 전략 분석, 포트폴리오 연결까지 한 번에.",
  icons: {
    icon: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewerSession = await getViewerSession();

  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body className={`${manrope.variable} ${instrumentSerif.variable} antialiased`}>
        <div className="relative min-h-screen">
          <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(247,244,238,0.82)] backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <Link href="/" className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#111111] p-2 shadow-[0_8px_18px_rgba(17,17,17,0.14)]">
                  <Image src="/ai-contest-logo.svg" alt="AI Contest Cloud 로고" width={32} height={36} priority />
                </span>
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--muted)] md:text-sm">
                    AI CONTEST CLOUD
                  </div>
                  <div className="hidden text-sm text-[var(--foreground)] md:block">AI Contest Intelligence</div>
                </div>
              </Link>

              <nav className="flex items-center gap-2 text-sm">
                <Link href="/" className="rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-black/4 hover:text-[var(--foreground)] md:px-4">
                  홈
                </Link>
                <Link
                  href="/contests"
                  className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-2 text-[var(--foreground)] transition hover:border-black/14 hover:bg-white md:px-4"
                >
                  탐색
                </Link>
                {viewerSession.user ? (
                  <Link
                    href="/my"
                    className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-2 text-[var(--foreground)] transition hover:border-black/14 hover:bg-white md:px-4"
                  >
                    내 활동
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-2 text-[var(--foreground)] transition hover:border-black/14 hover:bg-white md:px-4"
                  >
                    로그인
                  </Link>
                )}
                {viewerSession.isAdmin ? (
                  <Link
                    href="/admin/contests"
                    className="rounded-full border border-[var(--border)] bg-white/70 px-3 py-2 text-[var(--foreground)] transition hover:border-black/14 hover:bg-white md:px-4"
                  >
                    관리
                  </Link>
                ) : null}
                {viewerSession.user ? <ViewerLogoutButton /> : null}
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
