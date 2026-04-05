"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import EmptyState from "@/components/EmptyState";
import { SkeletonCard } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
  listSurvey,
  createSurvey,
  deleteSurvey,
  generateSurvey,
  type SurveyQuestion,
} from "@/lib/api";

export default function SurveyPage() {
  return (
    <AuthGuard>
      <SurveyContent />
    </AuthGuard>
  );
}

function SurveyContent() {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPaperId, setFilterPaperId] = useState("");
  const [filterInput, setFilterInput] = useState("");
  const [newQ, setNewQ] = useState("");
  const [newPaperId, setNewPaperId] = useState("");
  const [genPaperId, setGenPaperId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const load = useCallback((paperId?: string) => {
    setLoading(true);
    listSurvey(paperId)
      .then(setQuestions)
      .catch(() => toast("목록 로드 실패", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleFilter = () => {
    setFilterPaperId(filterInput.trim());
    load(filterInput.trim() || undefined);
  };

  const handleCreate = async () => {
    if (!newQ.trim()) return;
    setSubmitting(true);
    try {
      const q = await createSurvey({
        paper_id: newPaperId.trim() || "",
        original_q: newQ.trim(),
        adapted_q: newQ.trim(),
      });
      setQuestions((prev) => [q, ...prev]);
      setNewQ("");
      setNewPaperId("");
      toast("질문이 저장되었습니다.", "success");
    } catch {
      toast("저장 실패", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    if (!genPaperId.trim()) return;
    setGenerating(true);
    try {
      const result = await generateSurvey(genPaperId.trim());
      const newItems = Array.isArray(result) ? result : [];
      setQuestions((prev) => [...newItems, ...prev]);
      toast(`${newItems.length}개 질문이 생성되었습니다.`, "success");
    } catch {
      toast("AI 생성 실패", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 질문을 삭제하시겠습니까?")) return;
    try {
      await deleteSurvey(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      toast("삭제되었습니다.", "success");
    } catch {
      toast("삭제 실패", "error");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:text-slate-200">
            ← 대시보드
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">설문문항 생성기</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {/* AI 자동 생성 */}
        <section aria-labelledby="ai-gen-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 id="ai-gen-heading" className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">AI 자동 생성</h2>
          <div className="flex gap-2">
            <label htmlFor="gen-paper-id" className="sr-only">Paper ID 입력</label>
            <input
              id="gen-paper-id"
              type="text"
              placeholder="Paper ID 입력"
              value={genPaperId}
              onChange={(e) => setGenPaperId(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !genPaperId.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 disabled:opacity-50"
            >
              {generating ? "생성 중..." : "AI 생성"}
            </button>
          </div>
        </section>

        {/* 수동 추가 */}
        <section aria-labelledby="manual-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 id="manual-heading" className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">직접 추가</h2>
          <label htmlFor="manual-paper-id" className="sr-only">Paper ID (선택)</label>
          <input
            id="manual-paper-id"
            type="text"
            placeholder="Paper ID (선택)"
            value={newPaperId}
            onChange={(e) => setNewPaperId(e.target.value)}
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <label htmlFor="manual-question" className="sr-only">질문 내용</label>
          <textarea
            id="manual-question"
            placeholder="질문 내용을 입력하세요"
            value={newQ}
            onChange={(e) => setNewQ(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting || !newQ.trim()}
            className="mt-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-500 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            {submitting ? "저장 중..." : "저장"}
          </button>
        </section>

        {/* 필터 */}
        <div className="flex gap-2">
          <label htmlFor="filter-paper-id" className="sr-only">Paper ID로 필터링</label>
          <input
            id="filter-paper-id"
            type="text"
            placeholder="Paper ID로 필터링"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFilter()}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button type="button" onClick={handleFilter} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            필터
          </button>
          {filterPaperId && (
            <button
              type="button"
              onClick={() => { setFilterInput(""); setFilterPaperId(""); load(); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
            >
              초기화
            </button>
          )}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="space-y-3" role="status" aria-busy="true">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : questions.length === 0 ? (
          <EmptyState
            icon="❓"
            title={filterPaperId ? "해당 Paper ID에 대한 설문문항이 없습니다" : "저장된 설문문항이 없습니다"}
            description={filterPaperId ? "다른 Paper ID를 시도하거나 필터를 초기화하세요." : "위에서 AI 생성하거나 직접 추가하세요."}
            action={filterPaperId ? { label: "필터 초기화", onClick: () => { setFilterInput(""); setFilterPaperId(""); load(); } } : undefined}
          />
        ) : (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">총 {questions.length}개</p>
            <ul className="space-y-3" aria-label="설문문항 목록">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex-1">
                    <p className="text-sm text-slate-800 dark:text-slate-100">{q.original_q}</p>
                    {q.source_title && (
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">출처: {q.source_title}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    aria-label={`"${q.original_q.slice(0, 20)}" 질문 삭제`}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950/40"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
