import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import UserMenu from "@/components/UserMenu";
import { getPaper } from "@/lib/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "날짜 정보 없음";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    arxiv: "arXiv",
    ss: "Semantic Scholar",
  };
  return labels[source] ?? source;
}

export default async function PaperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  let paper;
  try {
    const token = session?.accessToken;
    paper = await getPaper(id, token);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-lg font-bold text-zinc-900 transition-colors hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
          >
            논문집필 도우미
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <Link
            href="/papers"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            논문 검색
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <span className="text-sm text-zinc-400 dark:text-zinc-500">상세</span>
        </div>
        <UserMenu />
      </header>

      {/* 본문 */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-8">
        {/* 메타 정보 */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {sourceLabel(paper.source)}
          </span>
          <span className="font-mono text-xs">{paper.source_id}</span>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span>{formatDate(paper.published_at)}</span>
        </div>

        {/* 제목 */}
        <h1 className="text-2xl font-bold leading-tight text-zinc-900 dark:text-zinc-50">
          {paper.title}
        </h1>

        {/* 저자 */}
        {paper.author_ids && paper.author_ids.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {paper.author_ids.map((author) => (
              <span
                key={author}
                className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                {author}
              </span>
            ))}
          </div>
        )}

        {/* 키워드 */}
        {paper.keywords && paper.keywords.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              키워드
            </h2>
            <div className="flex flex-wrap gap-2">
              {paper.keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {kw}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* AI 요약 */}
        {paper.summary && (
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              AI 요약
            </h2>
            <p className="text-sm leading-relaxed text-blue-900 dark:text-blue-200">
              {paper.summary}
            </p>
          </section>
        )}

        {/* 초록 */}
        {paper.abstract && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              초록 (Abstract)
            </h2>
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {paper.abstract}
            </p>
          </section>
        )}

        {/* 뒤로가기 */}
        <div className="pt-4">
          <Link
            href="/papers"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            목록으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  );
}
