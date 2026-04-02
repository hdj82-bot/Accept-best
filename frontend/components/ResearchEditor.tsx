"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { saveVersion } from "@/lib/api";

// ────────────────────────────────────────────────────────────────────────────
// Public handle exposed via ref
// ────────────────────────────────────────────────────────────────────────────

export interface ResearchEditorHandle {
  /** Insert text at the current cursor position (or end if no focus) */
  insertText(text: string): void;
}

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface ResearchEditorProps {
  /** The note ID — used to scope saved versions */
  noteId: string;
  /** Initial content loaded from the server */
  initialContent: string;
  /** Optional callback fired after a manual save */
  onManualSave?: (content: string) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Auto-save status indicator
// ────────────────────────────────────────────────────────────────────────────

type AutoSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
  const map: Record<AutoSaveStatus, { label: string; cls: string }> = {
    idle:    { label: "",          cls: "" },
    pending: { label: "변경됨",    cls: "text-slate-400" },
    saving:  { label: "저장 중…",  cls: "text-slate-500" },
    saved:   { label: "자동저장됨 ✓", cls: "text-emerald-600" },
    error:   { label: "자동저장 실패", cls: "text-red-500" },
  };
  const { label, cls } = map[status];
  if (!label) return null;
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const AUTO_SAVE_DELAY_MS = 3_000;

/**
 * Note editor with:
 *   - 3-second debounce auto-save (save_type: "auto")
 *   - Manual save button (save_type: "manual")
 *   - `insertText(text)` exposed via ref for cursor-position insertion
 *
 * Props:
 *   noteId         — scopes versions to this note
 *   initialContent — content loaded from server
 *   onManualSave   — optional callback after manual save
 *
 * Ref handle:
 *   insertText(text) — inserts at cursor, falls back to append
 */
const ResearchEditor = forwardRef<ResearchEditorHandle, ResearchEditorProps>(
  function ResearchEditor({ noteId, initialContent, onManualSave }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [content, setContent] = useState(initialContent);
    const [autoStatus, setAutoStatus] = useState<AutoSaveStatus>("idle");
    const [manualSaving, setManualSaving] = useState(false);
    const [manualSaved, setManualSaved] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track the last auto-saved content to avoid redundant saves
    const lastSavedRef = useRef(initialContent);

    // ── Expose insertText via ref ──
    useImperativeHandle(ref, () => ({
      insertText(text: string) {
        const ta = textareaRef.current;
        if (!ta) {
          setContent((prev) => prev + "\n" + text);
          return;
        }
        const start = ta.selectionStart ?? content.length;
        const end = ta.selectionEnd ?? content.length;
        const next =
          content.slice(0, start) +
          (start > 0 && content[start - 1] !== "\n" ? "\n" : "") +
          text +
          "\n" +
          content.slice(end);
        setContent(next);
        // Restore cursor after the inserted text
        requestAnimationFrame(() => {
          const cursorPos = start + text.length + 2;
          ta.setSelectionRange(cursorPos, cursorPos);
          ta.focus();
        });
      },
    }));

    // ── Debounce auto-save on content change ──
    useEffect(() => {
      if (content === lastSavedRef.current) return;
      setAutoStatus("pending");

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        setAutoStatus("saving");
        try {
          await saveVersion(content, "auto", noteId);
          lastSavedRef.current = content;
          setAutoStatus("saved");
          setTimeout(() => setAutoStatus("idle"), 2_000);
        } catch {
          setAutoStatus("error");
        }
      }, AUTO_SAVE_DELAY_MS);

      return () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
      };
    }, [content, noteId]);

    // ── Manual save ──
    const handleManualSave = async () => {
      if (!content.trim()) return;
      setManualSaving(true);
      try {
        await saveVersion(content, "manual", noteId);
        lastSavedRef.current = content;
        setManualSaved(true);
        setAutoStatus("idle");
        onManualSave?.(content);
        setTimeout(() => setManualSaved(false), 2_000);
      } catch {
        // ignore — auto-save indicator covers errors
      } finally {
        setManualSaving(false);
      }
    };

    return (
      <div className="flex h-full flex-col">
        {/* Toolbar */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">노트 내용</h2>
          <div className="flex items-center gap-3">
            <AutoSaveIndicator status={autoStatus} />
            {manualSaved && (
              <span className="text-xs font-medium text-emerald-600">저장됨 ✓</span>
            )}
            <button
              onClick={handleManualSave}
              disabled={manualSaving || !content.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {manualSaving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="논문을 검색하고 설문 질문을 삽입하거나 자유롭게 작성하세요…"
          className="flex-1 w-full resize-none rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800 placeholder-slate-400 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />

        <p className="mt-2 text-right text-xs text-slate-400">
          {content.length.toLocaleString("ko-KR")}자
        </p>
      </div>
    );
  }
);

export default ResearchEditor;
