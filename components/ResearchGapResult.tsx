import type { ResearchGapAnalysis } from "@/lib/api";

export default function ResearchGapResult({
  result,
}: {
  result: ResearchGapAnalysis;
}) {
  return (
    <div className="flex flex-col gap-8">
      {/* 연구 공백 */}
      {result.gaps.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            연구 공백 ({result.gaps.length})
          </h2>
          <div className="flex flex-col gap-3">
            {result.gaps.map((gap, i) => (
              <div
                key={i}
                className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950"
              >
                {"topic" in gap && gap.topic ? (
                  <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                    {String(gap.topic)}
                  </h3>
                ) : null}
                {"description" in gap && gap.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-300">
                    {String(gap.description)}
                  </p>
                ) : null}
                {Array.isArray(gap.related_papers) && gap.related_papers.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(gap.related_papers as string[]).map((pid, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-amber-200/50 px-2 py-0.5 text-xs font-mono text-amber-700 dark:bg-amber-800/30 dark:text-amber-400"
                      >
                        {pid}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 논문 간 연결점 */}
      {result.connections.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            논문 간 연결점 ({result.connections.length})
          </h2>
          <div className="flex flex-col gap-3">
            {result.connections.map((conn, i) => (
              <div
                key={i}
                className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950"
              >
                {"theme" in conn && conn.theme ? (
                  <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                    {String(conn.theme)}
                  </h3>
                ) : null}
                {"description" in conn && conn.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-blue-800 dark:text-blue-300">
                    {String(conn.description)}
                  </p>
                ) : null}
                {Array.isArray(conn.papers) && conn.papers.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(conn.papers as string[]).map((pid, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-blue-200/50 px-2 py-0.5 text-xs font-mono text-blue-700 dark:bg-blue-800/30 dark:text-blue-400"
                      >
                        {pid}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 후속 연구 제안 */}
      {result.suggestions.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            후속 연구 제안 ({result.suggestions.length})
          </h2>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950">
            <ul className="flex flex-col gap-2">
              {result.suggestions.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-emerald-800 dark:text-emerald-300">
                  <span className="shrink-0 font-semibold text-emerald-600 dark:text-emerald-400">
                    {i + 1}.
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
