"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
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
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = (paperId?: string) => {
    setLoading(true);
    listSurvey(paperId)
      .then(setQuestions)
      .catch(() => showToast("목록 로드 실패", false))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
      showToast("질문이 저장되었습니다.");
    } catch {
      showToast("저장 실패", false);
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
      showToast(`${newItems.length}개 질문이 생성되었습니다.`);
    } catch {
      showToast("AI 생성 실패", false);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 질문을 삭제하시겠습니까?")) return;
    try {
      await deleteSurvey(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      showToast("삭제되었습니다.");
    } catch {
      showToast("삭제 실패", false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toast.ok ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
            ← 대시보드
          </Link>
          <h1 className="text-lg font-semibold text-slate-800">설문문항 생성기</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {/* AI 자동 생성 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-700">AI 자동 생성</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paper ID 입력"
              value={genPaperId}
              onChange={(e) => setGenPaperId(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !genPaperId.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? "생성 중..." : "AI 생성"}
            </button>
          </div>
        </div>

        {/* 수동 추가 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-slate-700">직접 추가</p>
          <input
            type="text"
            placeholder="Paper ID (선택)"
            value={newPaperId}
            onChange={(e) => setNewPaperId(e.target.value)}
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <textarea
            placeholder="질문 내용을 입력하세요"
            value={newQ}
            onChange={(e) => setNewQ(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <button
            onClick={handleCreate}
            disabled={submitting || !newQ.trim()}
            className="mt-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>

        {/* 필터 */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paper ID로 필터링"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFilter()}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <button
            onClick={handleFilter}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            필터
          </button>
          {filterPaperId && (
            <button
              onClick={() => { setFilterInput(""); setFilterPaperId(""); load(); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400 hover:bg-slate-50"
            >
              초기화
            </button>
          )}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <span className="mb-3 text-4xl">❓</span>
            <p className="font-semibold text-slate-600">저장된 설문문항이 없습니다</p>
            <p className="mt-1 text-sm text-slate-400">위에서 AI 생성하거나 직접 추가하세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">총 {questions.length}개</p>
            {questions.map((q) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex-1">
                  <p className="text-sm text-slate-800">{q.original_q}</p>
                  {q.source_title && (
                    <p className="mt-1 text-xs text-slate-400">출처: {q.source_title}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
