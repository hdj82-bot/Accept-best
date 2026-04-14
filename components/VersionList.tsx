"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import VersionCard from "@/components/VersionCard";
import {
  listVersions,
  type PaperVersion,
  ApiError,
} from "@/lib/api";

export default function VersionList({
  refreshKey,
}: {
  refreshKey?: number;
}) {
  const { data: session } = useSession();

  const [versions, setVersions] = useState<PaperVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    const token = (session as any)?.accessToken as string | undefined;
    if (!token) return;

    let cancelled = false;

    async function fetchVersions() {
      setLoading(true);
      setError(null);
      try {
        const offset = (page - 1) * perPage;
        const result = await listVersions(token!, perPage, offset);
        if (!cancelled) {
          setVersions(result.versions);
          setTotal(result.total);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("버전 목록을 불러오는 중 오류가 발생했습니다.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchVersions();
    return () => { cancelled = true; };
  }, [session, page, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
          버전을 불러오고 있습니다...
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

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-zinc-400 dark:text-zinc-500">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <p className="text-sm">저장된 버전이 없습니다.</p>
        <p className="text-xs">수동 저장 버튼을 눌러 첫 버전을 저장해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        총 <span className="font-semibold text-zinc-700 dark:text-zinc-300">{total}</span>건의 버전
      </p>

      <div className="flex flex-col gap-3">
        {versions.map((v) => (
          <VersionCard key={v.id} version={v} />
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
