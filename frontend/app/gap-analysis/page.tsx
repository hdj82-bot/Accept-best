"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import {
  getMe,
  getNotes,
  analyzeGap,
  type User,
  type ResearchNote,
  type GapAnalysisResult,
  type GapItem,
} from "@/lib/api";

export default function GapAnalysisPage() {
  return (
    <AuthGuard>
      <GapAnalysisContent />
    </AuthGuard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Gap card
// ────────────────────────────────────────────────────────────────────────────

function GapCard({ gap }: { gap: GapItem }) {
  const border =
    gap.severity === "high"
      ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30"
      : gap.severity === "medium"
      ? "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30"
      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900";
  const badge =
    gap.severity === "high"
      ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
      : gap.severity === "medium"
      ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
  const severityLabel =
    gap.severity === "high" ? "높음" : gap.severity === "medium" ? "중간" : "낮음";

  return (
    <div className={`rounded-2xl border p-5 ${border}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
          {severityLabel}
        </span>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{gap.title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {gap.description}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main content
// ────────────────────────────────────────────────────────────────────────────

function GapAnalysisContent() {
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GapAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe().then(setUser).catch(() => null);
    getNotes().then(setNotes).catch(() => null);
  }, []);

  const handleAnalyze = async () => {
    if (!selectedNoteId) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await analyzeGap(selectedNoteId);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 실패");
    } finally {
      setLoading(false);
    }
  };

  const isPro = user?.plan === "pro" || user?.plan === "admin";

  return (
    <main className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ← 대시보드
          </Link>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            연구 공백 발견
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        {/* Pro-only gate */}
        {user && !isPro ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center dark:border-slate-700 dark:bg-slate-900">
            <span className="mb-4 text-5xl">🔒</span>
            <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">
              Pro 플랜 전용 기능입니다
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              연구 공백 분석은 Pro 플랜 이상에서 사용할 수 있습니다.
            </p>
            <Link
              href="/billing"
              className="mt-6 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Pro로 업그레이드 →
            </Link>
          </div>
        ) : (
          <>
            {/* Note selector */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
                노트 선택
              </h2>
              <select
                value={selectedNoteId}
                onChange={(e) => { setSelectedNoteId(e.target.value); setResult(null); }}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">-- 노트를 선택하세요 --</option>
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.content.slice(0, 60) || "(빈 노트)"}
                    {" · "}
                    {new Date(n.created_at).toLocaleDateString("ko-KR")}
                  </option>
                ))}
              </select>

              <button
                onClick={handleAnalyze}
                disabled={!selectedNoteId || loading}
                className="mt-4 w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {loading ? "AI가 논문을 분석하고 있습니다..." : "공백 분석 시작"}
              </button>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center py-12">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  AI가 논문을 분석하고 있습니다… (최대 30초)
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-50 px-5 py-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      분석 요약
                    </h3>
                    <span className="text-xs text-slate-400">
                      분석된 논문 {result.paper_count}편
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {result.summary}
                  </p>
                </div>

                {/* Gaps */}
                {result.gaps.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-base font-semibold text-slate-700 dark:text-slate-300">
                      연구 공백
                    </h3>
                    <div className="space-y-4">
                      {result.gaps.map((gap, i) => (
                        <GapCard key={i} gap={gap} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Opportunities */}
                {result.opportunities.length > 0 && (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-800 dark:bg-violet-950/30">
                    <h3 className="mb-3 text-sm font-semibold text-violet-700 dark:text-violet-400">
                      연구 기회
                    </h3>
                    <ol className="space-y-2">
                      {result.opportunities.map((opp, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-violet-700 dark:text-violet-300"
                        >
                          <span className="mt-0.5 shrink-0 font-semibold">{i + 1}.</span>
                          {opp}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Reset */}
                <button
                  onClick={() => { setResult(null); setSelectedNoteId(""); }}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                >
                  다시 분석
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
