"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PaperCard from "@/components/PaperCard";
import { getSimilarPapers, type Paper, ApiError } from "@/lib/api";

export default function SimilarPaperList({ paperId }: { paperId: string }) {
  const { data: session } = useSession();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSimilar() {
      setLoading(true);
      setError(null);
      try {
        const token = (session as any)?.accessToken as string | undefined;
        const result = await getSimilarPapers(paperId, token);
        if (!cancelled) {
          setPapers(result);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("유사 논문을 불러오지 못했습니다.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSimilar();
    return () => { cancelled = true; };
  }, [paperId, session]);

  if (loading) {
    return (
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          유사 논문 추천
        </h2>
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
          <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
            유사 논문을 찾고 있습니다...
          </span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          유사 논문 추천
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {error}
        </div>
      </section>
    );
  }

  if (papers.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        유사 논문 추천
      </h2>
      <div className="flex flex-col gap-3">
        {papers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
      </div>
    </section>
  );
}
