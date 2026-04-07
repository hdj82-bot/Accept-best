"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import DiagnosisScoreCard from "@/components/DiagnosisScoreCard";
import ShareCard from "@/components/ShareCard";
import { getDiagnosis, type Diagnosis, ApiError } from "@/lib/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "날짜 정보 없음";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DiagnosisDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();

  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const token = (session as any)?.accessToken as string | undefined;
    if (!token || !params.id) return;

    let cancelled = false;

    async function fetchDiagnosis() {
      setLoading(true);
      setError(null);
      try {
        const result = await getDiagnosis(params.id, token!);
        if (!cancelled) setDiagnosis(result);
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

    fetchDiagnosis();
    return () => { cancelled = true; };
  }, [session, params.id]);

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
            href="/diagnosis"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            논문 건강검진
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <span className="text-sm text-zinc-400 dark:text-zinc-500">상세</span>
        </div>
        <UserMenu />
      </header>

      {/* 본문 */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
            <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
              진단 결과를 불러오고 있습니다...
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {diagnosis && (
          <>
            {/* 메타 정보 */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span>{formatDate(diagnosis.created_at)}</span>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span className="font-mono text-xs">{diagnosis.paper_id}</span>
            </div>

            {/* 점수 시각화 */}
            <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <DiagnosisScoreCard diagnosis={diagnosis} />
            </section>

            {/* 피드백 */}
            {diagnosis.feedback && (
              <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  AI 피드백
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-blue-900 dark:text-blue-200">
                  {diagnosis.feedback}
                </p>
              </section>
            )}

            {/* 관련 논문 + 공유하기 */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/papers/${diagnosis.paper_id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                논문 상세 보기
              </Link>
              <button
                onClick={() => setShowShare((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                </svg>
                {showShare ? "공유 닫기" : "공유하기"}
              </button>
            </div>

            {/* 공유 카드 */}
            {showShare && (
              <ShareCard diagnosisId={diagnosis.id} />
            )}

            {/* 뒤로가기 */}
            <div className="pt-4">
              <Link
                href="/diagnosis"
                className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                목록으로 돌아가기
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
