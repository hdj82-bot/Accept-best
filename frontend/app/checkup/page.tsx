"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import {
  getMe,
  getNotes,
  checkupNote,
  type User,
  type ResearchNote,
  type CheckupResult,
} from "@/lib/api";

export default function CheckupPage() {
  return (
    <AuthGuard>
      <CheckupContent />
    </AuthGuard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Score card
// ────────────────────────────────────────────────────────────────────────────

function ScoreCard({ label, score }: { label: string; score: number }) {
  const color =
    score >= 8
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : score >= 6
      ? "bg-yellow-50 border-yellow-200 text-yellow-700"
      : "bg-red-50 border-red-200 text-red-700";
  const badge =
    score >= 8
      ? "bg-emerald-100 text-emerald-700"
      : score >= 6
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  return (
    <div className={`flex flex-col items-center rounded-2xl border p-5 ${color}`}>
      <span className="text-4xl font-bold">{score}</span>
      <span className={`mt-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}>
        {label}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main content
// ────────────────────────────────────────────────────────────────────────────

function CheckupContent() {
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe().then(setUser).catch(() => null);
    getNotes().then(setNotes).catch(() => null);
  }, []);

  const handleCheckup = async () => {
    if (!selectedNoteId) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await checkupNote(selectedNoteId);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "건강검진 실패");
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
            논문 건강검진
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
              AI 논문 건강검진은 Pro 플랜 이상에서 사용할 수 있습니다.
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
                onClick={handleCheckup}
                disabled={!selectedNoteId || loading}
                className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "AI가 분석 중입니다…" : "건강검진 시작"}
              </button>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center py-12">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  AI가 분석 중입니다…
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
                {/* Scores */}
                <div>
                  <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
                    점수
                  </h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <ScoreCard label="구조" score={result.scores.structure} />
                    <ScoreCard label="명확성" score={result.scores.clarity} />
                    <ScoreCard label="독창성" score={result.scores.originality} />
                    <ScoreCard label="종합" score={result.scores.overall} />
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    종합 의견
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {result.summary}
                  </p>
                </div>

                {/* Strengths */}
                {result.strengths.length > 0 && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/30">
                    <h3 className="mb-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      강점
                    </h3>
                    <ul className="space-y-2">
                      {result.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                          <span className="mt-0.5 shrink-0">✓</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggestions */}
                {result.suggestions.length > 0 && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950/30">
                    <h3 className="mb-3 text-sm font-semibold text-blue-700 dark:text-blue-400">
                      개선 제안
                    </h3>
                    <ul className="space-y-2">
                      {result.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
                          <span className="mt-0.5 shrink-0">→</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
