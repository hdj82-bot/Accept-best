"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  listDiagnoses,
  type Diagnosis,
  ApiError,
} from "@/lib/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-100 dark:bg-emerald-900/30";
  if (score >= 60) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

export default function DiagnosisList({
  paperId,
  refreshKey,
}: {
  paperId?: string;
  refreshKey?: number;
}) {
  const { data: session } = useSession();

  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
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

    async function fetchDiagnoses() {
      setLoading(true);
      setError(null);
      try {
        const offset = (page - 1) * perPage;
        const result = await listDiagnoses(token!, paperId, perPage, offset);
        if (!cancelled) {
          setDiagnoses(result.diagnoses);
          setTotal(result.total);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("진단 결과를 불러오는 중 오류가 발생했습니다.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDiagnoses();
    return () => { cancelled = true; };
  }, [session, paperId, page, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
          진단 결과를 불러오고 있습니다...
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

  if (diagnoses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-zinc-400 dark:text-zinc-500">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
        </svg>
        <p className="text-sm">진단 결과가 없습니다.</p>
        <p className="text-xs">논문 ID를 입력하고 건강검진을 실행해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        총 <span className="font-semibold text-zinc-700 dark:text-zinc-300">{total}</span>건의 진단 결과
      </p>

      <div className="flex flex-col gap-3">
        {diagnoses.map((d) => (
          <Link
            key={d.id}
            href={`/diagnosis/${d.id}`}
            className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
          >
            {/* 점수 뱃지 */}
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${scoreBg(d.overall_score)}`}>
              <span className={`text-lg font-bold ${scoreColor(d.overall_score)}`}>
                {d.overall_score}
              </span>
            </div>

            {/* 정보 */}
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-medium text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300">
                논문 건강검진 결과
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(d.section_scores).slice(0, 4).map(([key, score]) => (
                  <span
                    key={key}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {key} {score}
                  </span>
                ))}
                {Object.keys(d.section_scores).length > 4 && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    +{Object.keys(d.section_scores).length - 4}
                  </span>
                )}
              </div>
            </div>

            {/* 날짜 */}
            {d.created_at && (
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                {formatDate(d.created_at)}
              </span>
            )}
          </Link>
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
