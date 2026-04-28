"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ReferenceCard from "@/components/ReferenceCard";
import {
  listReferences,
  type Reference,
  ApiError,
} from "@/lib/api";

export default function ReferenceList({
  paperId,
  refreshKey,
}: {
  paperId?: string;
  refreshKey?: number;
}) {
  const { data: session } = useSession();

  const [references, setReferences] = useState<Reference[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    const token = session?.accessToken;
    if (!token) return;

    let cancelled = false;

    async function fetchReferences() {
      setLoading(true);
      setError(null);
      try {
        const offset = (page - 1) * perPage;
        const result = await listReferences(token!, paperId, perPage, offset);
        if (!cancelled) {
          setReferences(result.references);
          setTotal(result.total);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("참고문헌을 불러오는 중 오류가 발생했습니다.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReferences();
    return () => { cancelled = true; };
  }, [session, paperId, page, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
          참고문헌을 불러오고 있습니다...
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

  if (references.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-zinc-400 dark:text-zinc-500">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
        <p className="text-sm">등록된 참고문헌이 없습니다.</p>
        <p className="text-xs">수동으로 추가하거나 논문에서 자동 추출해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        총 <span className="font-semibold text-zinc-700 dark:text-zinc-300">{total}</span>건의 참고문헌
      </p>

      <div className="flex flex-col gap-3">
        {references.map((ref) => (
          <ReferenceCard key={ref.id} reference={ref} />
        ))}
      </div>

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
