import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-6 py-20">
      <div className="surface-card w-full rounded-[34px] p-10 text-center">
        <div className="eyebrow">Not Found</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
          해당 공모전을 찾지 못했습니다.
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          슬러그가 바뀌었거나 아직 게시되지 않은 대회일 수 있습니다.
        </p>
        <Link href="/contests" className="primary-button mt-8">
          공모전 목록으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
