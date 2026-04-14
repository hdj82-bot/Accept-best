"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import UserMenu from "@/components/UserMenu";
import RadarChart from "@/components/RadarChart";
import DiagnosisCard from "@/components/DiagnosisCard";
import { getDiagnosis, type DiagnosisResult, ApiError } from "@/lib/api";

function totalScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export default function DiagnosisPage() {
  const { data: session, status } = useSession();
  const [paperId, setPaperId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (status === "loading") return null;
  if (status === "unauthenticated") redirect("/login");

  async function handleDiagnose(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = paperId.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = (session as any)?.accessToken as string | undefined;
      const data = await getDiagnosis(trimmed, token);
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("진단 중 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleShareLink() {
    const url = `${window.location.origin}/diagnosis?paper=${encodeURIComponent(result?.paper_id ?? paperId)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            논문 건강검진
          </span>
        </div>
        <UserMenu />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
        {/* 입력 폼 */}
        <form onSubmit={handleDiagnose} className="flex w-full gap-3">
          <input
            type="text"
            value={paperId}
            onChange={(e) => setPaperId(e.target.value)}
            placeholder="논문 ID를 입력하세요"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
          />
          <button
            type="submit"
            disabled={loading || !paperId.trim()}
            className="shrink-0 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "진단 중..." : "진단하기"}
          </button>
        </form>

        {/* 로딩 */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
            <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
              논문을 진단하고 있습니다...
            </span>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div className="flex flex-col gap-6">
            {/* 총점 + 한줄 요약 */}
            <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-bold ${totalScoreColor(result.total_score)}`}>
                  {result.total_score}
                </span>
                <span className="text-lg text-zinc-400 dark:text-zinc-500">
                  / 100
                </span>
              </div>
              <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                {result.summary}
              </p>
              {/* 공유 버튼 */}
              <button
                onClick={handleShareLink}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0-12.814a2.25 2.25 0 1 0 0-2.186m0 2.186a2.25 2.25 0 1 0 0 2.186m0-2.186c-.18.324-.283.696-.283 1.093s.103.77.283 1.093" />
                </svg>
                {copied ? "링크 복사됨!" : "결과 공유"}
              </button>
            </div>

            {/* 레이더 차트 */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                항목별 점수
              </h2>
              <RadarChart items={result.items} />
            </div>

            {/* 항목별 상세 피드백 */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                상세 피드백
              </h2>
              <div className="flex flex-col gap-3">
                {result.items.map((item) => (
                  <DiagnosisCard key={item.label} item={item} />
                ))}
              </div>
            </section>

            {/* 개선 제안 */}
            {result.suggestions.length > 0 && (
              <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  개선 제안
                </h2>
                <ul className="flex flex-col gap-2">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-blue-900 dark:text-blue-200">
                      <span className="mt-0.5 shrink-0 text-blue-400 dark:text-blue-500">
                        {i + 1}.
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !error && !result && (
          <div className="flex flex-col items-center gap-2 py-16 text-zinc-400 dark:text-zinc-500">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            <p className="text-sm">논문 ID를 입력하여 건강검진을 시작하세요</p>
          </div>
        )}
      </main>
    </div>
  );
}
