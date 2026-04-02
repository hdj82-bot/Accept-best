"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listSurvey,
  generateSurvey,
  deleteSurvey,
  type SurveyQuestion,
} from "@/lib/api";

interface SurveyPanelProps {
  /** The paper to load/generate questions for */
  paperId: string;
  /** Paper title — displayed in the panel header */
  paperTitle: string;
  /** Called when user clicks "노트에 삽입" — receives the adapted_q text */
  onInsert: (text: string) => void;
  /** Close the panel */
  onClose: () => void;
}

function QuestionCard({
  q,
  onInsert,
  onDelete,
}: {
  q: SurveyQuestion;
  onInsert: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSurvey(q.id);
      onDelete(q.id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Original question */}
      <p className="text-xs text-slate-400 mb-1">원문 질문</p>
      <p className="text-sm text-slate-600 mb-3 leading-snug">{q.original_q}</p>

      {/* Adapted question */}
      <p className="text-xs font-medium text-slate-500 mb-1">적용 질문</p>
      <p className="text-sm font-medium leading-snug text-slate-800">{q.adapted_q}</p>

      {/* Source */}
      {q.source_title && (
        <p className="mt-2 text-xs text-slate-400">
          출처: {q.source_title}
          {q.source_page ? `, p.${q.source_page}` : ""}
          {q.year ? ` (${q.year})` : ""}
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onInsert(q.adapted_q)}
          className="flex-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
        >
          노트에 삽입
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-50 disabled:opacity-50"
          aria-label="삭제"
        >
          {deleting ? "…" : "삭제"}
        </button>
      </div>
    </div>
  );
}

/**
 * Panel showing survey questions for a selected paper.
 *
 * Props:
 *   paperId     — paper to load / generate questions for
 *   paperTitle  — shown in header
 *   onInsert    — receives adapted_q text; parent inserts into editor
 *   onClose     — close button handler
 */
export default function SurveyPanel({
  paperId,
  paperTitle,
  onInsert,
  onClose,
}: SurveyPanelProps) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = await listSurvey(paperId);
      setQuestions(qs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const generated = await generateSurvey(paperId);
      setQuestions((prev) => [...generated, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 rounded-t-2xl">
        <div className="min-w-0">
          <p className="text-xs text-slate-400">설문문항</p>
          <p className="text-sm font-semibold text-slate-800 truncate">{paperTitle}</p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {/* Generate button */}
      <div className="border-b border-slate-200 bg-white px-4 py-2">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {generating ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              AI 질문 생성 중…
            </>
          ) : (
            "AI 질문 생성"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Question list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />
          ))
        ) : questions.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            생성된 질문이 없습니다.
            <br />
            위 버튼으로 AI 질문을 생성하세요.
          </p>
        ) : (
          questions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              onInsert={onInsert}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
