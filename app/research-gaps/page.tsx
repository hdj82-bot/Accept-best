"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import ResearchGapResult from "@/components/ResearchGapResult";
import {
  analyzeResearchGaps,
  getResearchGapResult,
  type ResearchGapAnalysis,
  ApiError,
} from "@/lib/api";

export default function ResearchGapsPage() {
  const { data: session } = useSession();

  const [paperIds, setPaperIds] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<ResearchGapAnalysis | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPolling(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function handlePaperIdChange(index: number, value: string) {
    setPaperIds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addPaperIdField() {
    if (paperIds.length >= 10) return;
    setPaperIds((prev) => [...prev, ""]);
  }

  function removePaperIdField(index: number) {
    if (paperIds.length <= 2) return;
    setPaperIds((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ids = paperIds.map((id) => id.trim()).filter(Boolean);
    if (ids.length < 2) {
      setError("최소 2개의 논문 ID를 입력해 주세요.");
      return;
    }

    const token = session?.accessToken;
    if (!token) {
      setError("로그인이 필요합니다.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    setResult(null);

    try {
      const res = await analyzeResearchGaps(ids, token);
      setMessage(res.message);
      setSubmitting(false);

      // 폴링 시작
      setPolling(true);
      startTimeRef.current = Date.now();

      intervalRef.current = setInterval(async () => {
        // 60초 타임아웃
        if (Date.now() - startTimeRef.current > 60000) {
          clearPolling();
          setError("분석 시간이 초과되었습니다. 나중에 다시 시도해 주세요.");
          return;
        }

        try {
          const pollResult = await getResearchGapResult(res.task_id, token);

          if ("status" in pollResult) {
            if (pollResult.status === "failed") {
              clearPolling();
              setError(pollResult.detail ?? "분석에 실패했습니다.");
            }
            // pending: 계속 폴링
          } else {
            clearPolling();
            setResult(pollResult);
            setMessage(null);
          }
        } catch {
          clearPolling();
          setError("결과를 가져오는 중 오류가 발생했습니다.");
        }
      }, 3000);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("분석 요청 중 오류가 발생했습니다.");
      }
    }
  }

  const validCount = paperIds.filter((id) => id.trim()).length;

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
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            연구 공백 발견
          </span>
        </div>
        <UserMenu />
      </header>

      {/* 메인 */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
        {/* 논문 ID 입력 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            분석할 논문 ID를 입력하세요 (최소 2개, 최대 10개)
          </p>

          <div className="flex flex-col gap-2">
            {paperIds.map((id, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={id}
                  onChange={(e) => handlePaperIdChange(index, e.target.value)}
                  placeholder={`논문 ID ${index + 1}`}
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                />
                {paperIds.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removePaperIdField(index)}
                    className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {paperIds.length < 10 && (
              <button
                type="button"
                onClick={addPaperIdField}
                className="rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              >
                + 논문 추가
              </button>
            )}

            <div className="flex-1" />

            <button
              type="submit"
              disabled={submitting || polling || validCount < 2}
              className="shrink-0 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {submitting ? "제출 중..." : polling ? "분석 중..." : "분석 시작"}
            </button>
          </div>
        </form>

        {/* 메시지 */}
        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* 폴링 로딩 */}
        {polling && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
            <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
              연구 공백을 분석하고 있습니다...
            </span>
          </div>
        )}

        {/* 결과 */}
        {result && <ResearchGapResult result={result} />}
      </main>
    </div>
  );
}
