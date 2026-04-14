"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import PaperCard from "@/components/PaperCard";
import { searchPapers, type Paper, type PaperSearchResult, ApiError } from "@/lib/api";

export default function PaperList() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const query = searchParams.get("q") ?? "";

  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    if (!query) {
      setPapers([]);
      setTotal(0);
      setSearched(false);
      return;
    }

    let cancelled = false;

    async function fetchPapers() {
      setLoading(true);
      setError(null);
      try {
        const token = (session as any)?.accessToken as string | undefined;
        const result: PaperSearchResult = await searchPapers(query, page, perPage, token);
        if (!cancelled) {
          setPapers(result.papers);
          setTotal(result.total);
          setSearched(true);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("논문 검색 중 오류가 발생했습니다. 다시 시도해 주세요.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPapers();
    return () => { cancelled = true; };
  }, [query, page, session]);

  // 쿼리 변경 시 페이지 리셋
  useEffect(() => {
    setPage(1);
  }, [query]);

  if (!query) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-zinc-400 dark:text-zinc-500">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <p className="text-sm">키워드를 입력하여 논문을 검색하세요</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
          논문을 검색하고 있습니다...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (searched && papers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-zinc-400 dark:text-zinc-500">
        <p className="text-sm">
          &ldquo;{query}&rdquo;에 대한 검색 결과가 없습니다.
        </p>
        <p className="text-xs">다른 키워드로 다시 검색해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 결과 카운트 */}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        총 <span className="font-semibold text-zinc-700 dark:text-zinc-300">{total}</span>건의 논문
      </p>

      {/* 논문 목록 */}
      <div className="flex flex-col gap-3">
        {papers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
          >
            이전
          </button>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-zinc-700"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
