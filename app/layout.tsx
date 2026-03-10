import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Instrument_Serif, Manrope } from "next/font/google";
import {
  FaArrowRightFromBracket,
  FaArrowRightToBracket,
  FaGear,
  FaHouse,
  FaMagnifyingGlass,
  FaRegBookmark,
} from "react-icons/fa6";

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
  const navButtonBaseClassName =
    "inline-flex h-10 w-10 items-center justify-center rounded-full px-0 text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)] sm:h-auto sm:w-auto sm:gap-2 sm:px-4";
  const navSecondaryClassName = `${navButtonBaseClassName} border border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--foreground)] hover:border-[rgba(245,241,232,0.18)] hover:bg-[rgba(255,255,255,0.06)]`;
  const navPrimaryClassName = `${navButtonBaseClassName} sm:px-3`;

  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body className={`${manrope.variable} ${instrumentSerif.variable} antialiased`}>
        <div className="relative min-h-screen">
          <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(5,6,8,0.82)] backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
              <Link href="/" className="flex items-center gap-3" aria-label="홈으로 이동">
                <span className="flex h-10 w-10 items-center justify-center p-1 sm:h-12 sm:w-12 sm:p-0">
                  <Image src="/ai-contest-logo.svg" alt="AI Contest Cloud 로고" width={32} height={36} priority />
                </span>
                <div className="hidden sm:block">
                  <div className="text-[11px] font-semibold tracking-[0.2em] text-[var(--muted)] md:text-sm">
                    AI CONTEST CLOUD
                  </div>
                  <div className="hidden text-sm text-[var(--foreground)] md:block">AI Contest Intelligence</div>
                </div>
              </Link>

              <nav className="flex shrink-0 items-center gap-1 text-sm sm:gap-2">
                <Link
                  href="/"
                  aria-label="홈"
                  title="홈"
                  className={navPrimaryClassName}
                >
                  <FaHouse className="text-[13px] sm:text-[11px]" aria-hidden="true" />
                  <span className="hidden sm:inline">홈</span>
                </Link>
                <Link
                  href="/contests"
                  aria-label="탐색"
                  title="탐색"
                  className={navSecondaryClassName}
                >
                  <FaMagnifyingGlass className="text-[13px] sm:text-[11px]" aria-hidden="true" />
                  <span className="hidden sm:inline">탐색</span>
                </Link>
                {viewerSession.user ? (
                  <Link
                    href="/my"
                    aria-label="내 활동"
                    title="내 활동"
                    className={navSecondaryClassName}
                  >
                    <FaRegBookmark className="text-[13px] sm:text-[11px]" aria-hidden="true" />
                    <span className="hidden sm:inline">내 활동</span>
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    aria-label="로그인"
                    title="로그인"
                    className={navSecondaryClassName}
                  >
                    <FaArrowRightToBracket className="text-[13px] sm:text-[11px]" aria-hidden="true" />
                    <span className="hidden sm:inline">로그인</span>
                  </Link>
                )}
                {viewerSession.isAdmin ? (
                  <Link
                    href="/admin/contests"
                    aria-label="관리"
                    title="관리"
                    className={navSecondaryClassName}
                  >
                    <FaGear className="text-[13px] sm:text-[11px]" aria-hidden="true" />
                    <span className="hidden sm:inline">관리</span>
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
