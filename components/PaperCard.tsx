import Link from "next/link";
import type { Paper } from "@/lib/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
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

export default function PaperCard({ paper }: { paper: Paper }) {
  return (
    <Link
      href={`/papers/${paper.id}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      {/* 출처 + 날짜 */}
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {sourceLabel(paper.source)}
        </span>
        {paper.published_at && <span>{formatDate(paper.published_at)}</span>}
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <span className="font-mono">{paper.source_id}</span>
      </div>

      {/* 제목 */}
      <h3 className="text-base font-semibold leading-snug text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300">
        {paper.title}
      </h3>

      {/* 초록 */}
      {paper.abstract && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {paper.abstract}
        </p>
      )}

      {/* 키워드 */}
      {paper.keywords && paper.keywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {paper.keywords.map((kw) => (
            <span
              key={kw}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
