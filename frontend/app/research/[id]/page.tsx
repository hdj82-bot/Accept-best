"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import ResearchEditor, {
  type ResearchEditorHandle,
} from "@/components/ResearchEditor";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { getNote, updateNote, type Paper, type ResearchNote } from "@/lib/api";

// ── Lazy-loaded components (reduce initial bundle ~40KB) ────────────────────
const PaperSearchPanel = dynamic(() => import("@/components/PaperSearchPanel"), {
  loading: () => <div className="h-40 animate-pulse rounded-xl bg-slate-100" />,
});
const SurveyPanel = dynamic(() => import("@/components/SurveyPanel"), {
  loading: () => <div className="h-32 animate-pulse rounded-xl bg-slate-100" />,
});
const VersionHistory = dynamic(() => import("@/components/VersionHistory"), {
  ssr: false,
});
const ExportButton = dynamic(() => import("@/components/ExportButton"), {
  ssr: false,
  loading: () => <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />,
});
const ShareButton = dynamic(() => import("@/components/ShareButton"), {
  ssr: false,
  loading: () => <div className="h-9 w-20 animate-pulse rounded-xl bg-slate-100" />,
});

export default function ResearchDetailPage() {
  return (
    <AuthGuard>
      <ResearchDetailContent />
    </AuthGuard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main content
// ────────────────────────────────────────────────────────────────────────────

function ResearchDetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  // ── Note state ──
  const [note, setNote] = useState<ResearchNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Selected paper (drives SurveyPanel) ──
  const [activePaper, setActivePaper] = useState<Paper | null>(null);

  // ── VersionHistory open/close ──
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Ref to editor — for insertText ──
  const editorRef = useRef<ResearchEditorHandle>(null);

  useEffect(() => {
    if (!id) return;
    getNote(id)
      .then((n) => {
        const restored = localStorage.getItem("restored_content");
        if (restored) {
          localStorage.removeItem("restored_content");
          setNote({ ...n, content: restored });
        } else {
          setNote(n);
        }
      })
      .catch(() => setFetchError("노트를 불러오는 데 실패했습니다."))
      .finally(() => setLoading(false));
  }, [id]);

  // Called from SurveyPanel — insert adapted_q at cursor
  const handleInsertText = (text: string) => {
    editorRef.current?.insertText(text);
  };

  // Called from ResearchEditor manual save — keep note metadata in sync
  const handleManualSave = async (content: string) => {
    if (!id) return;
    try {
      const updated = await updateNote(id, content);
      setNote(updated);
    } catch { /* non-critical */ }
  };

  // Called after version restore — close history, update editor
  const handleRestore = (content: string) => {
    editorRef.current?.insertText(""); // focus editor
    // Easiest approach: re-mount editor with new initial content
    setNote((prev) => prev ? { ...prev, content } : prev);
    setHistoryOpen(false);
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <main className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950" role="status" aria-busy="true">
        <div className="border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <Skeleton height={20} width={160} />
        </div>
        <div className="flex flex-1 gap-4 p-6">
          <Skeleton className="w-72 flex-none" rounded="rounded-2xl" />
          <Skeleton className="flex-1" rounded="rounded-2xl" />
        </div>
        <span className="sr-only">연구 노트를 불러오는 중</span>
      </main>
    );
  }

  // ── Error state ──
  if (fetchError && !note) {
    return (
      <main className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-6">
        <EmptyState
          icon="⚠️"
          tone="error"
          title="노트를 불러오지 못했습니다"
          description={fetchError}
          action={{ label: "대시보드로 돌아가기", href: "/dashboard" }}
        />
      </main>
    );
  }

  const searchHint = (note?.content ?? "").split(/\s+/).slice(0, 6).join(" ");

  return (
    <main className="flex h-screen flex-col bg-slate-50">
      {/* ── Header ── */}
      <header className="border-b border-slate-200 bg-white px-6 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              ← 대시보드
            </button>
            <h1 className="text-base font-semibold text-slate-800">연구 노트 편집</h1>
            {note && (
              <span className="text-xs text-slate-400">
                {new Date(note.created_at).toLocaleDateString("ko-KR")} 작성
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Share button */}
            {id && <ShareButton noteId={id} />}

            {/* Export button */}
            {id && <ExportButton noteId={id} />}

            {/* Version history toggle */}
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition ${
                historyOpen
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>🕐</span>
              버전 히스토리
            </button>
          </div>
        </div>
      </header>

      {/* ── Three-column body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Col 1: Paper search + Survey ── */}
        <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white p-4">
          {/* Paper search */}
          <div className="flex flex-col" style={{ minHeight: activePaper ? "220px" : "100%" }}>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">논문 검색</h2>
            <PaperSearchPanel
              onSelectPaper={(paper) => setActivePaper(paper)}
              initialQuery={searchHint}
            />
          </div>

          {/* Survey panel — appears when a paper is selected */}
          {activePaper && (
            <div className="flex-1 min-h-0">
              <SurveyPanel
                paperId={activePaper.id}
                paperTitle={activePaper.title}
                onInsert={handleInsertText}
                onClose={() => setActivePaper(null)}
              />
            </div>
          )}
        </div>

        {/* ── Col 2: Research editor (flex-1) ── */}
        <div className="flex flex-1 flex-col overflow-hidden p-6 min-w-0">
          {note && (
            // key forces re-mount when content is restored from a version
            <ResearchEditor
              key={note.content.slice(0, 20) + note.content.length}
              ref={editorRef}
              noteId={id}
              initialContent={note.content}
              onManualSave={handleManualSave}
            />
          )}
        </div>
      </div>

      {/* ── Version history slide panel (overlays from right) ── */}
      {id && (
        <VersionHistory
          noteId={id}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={handleRestore}
        />
      )}
    </main>
  );
}
