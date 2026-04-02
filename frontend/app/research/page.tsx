"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import PaperSearchPanel from "@/components/PaperSearchPanel";
import { createNote, type Paper } from "@/lib/api";

export default function ResearchPage() {
  return (
    <AuthGuard>
      <ResearchContent />
    </AuthGuard>
  );
}

function ResearchContent() {
  const router = useRouter();
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Append a paper reference snippet to the note textarea */
  const handleSelectPaper = (paper: Paper) => {
    const snippet =
      `\n[${paper.title}] — ${paper.authors.slice(0, 2).join(", ")}` +
      (paper.year ? ` (${paper.year})` : "") +
      "\n";
    setNoteContent((prev) => prev + snippet);
  };

  const handleSave = async () => {
    if (!noteContent.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const note = await createNote(noteContent);
      router.push(`/research/${note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
      setSaving(false);
    }
  };

  return (
    <main className="flex h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← 뒤로
          </button>
          <h1 className="text-base font-semibold text-slate-800">새 연구 노트</h1>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden px-6 py-6 gap-6">
        {/* ── Left: Paper search ── */}
        <div className="flex w-[420px] shrink-0 flex-col">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">논문 검색</h2>
          <div className="flex-1 overflow-hidden">
            <PaperSearchPanel onSelectPaper={handleSelectPaper} />
          </div>
        </div>

        {/* ── Right: Note editor ── */}
        <div className="flex flex-1 flex-col min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">연구 노트</h2>
            <button
              onClick={handleSave}
              disabled={saving || !noteContent.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="논문을 검색하고 선택하면 참조가 자동으로 추가됩니다.
아이디어, 메모, 요약을 자유롭게 작성하세요…"
            className="flex-1 w-full resize-none rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800 placeholder-slate-400 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />

          <p className="mt-2 text-right text-xs text-slate-400">
            {noteContent.length.toLocaleString("ko-KR")}자
          </p>
        </div>
      </div>
    </main>
  );
}
