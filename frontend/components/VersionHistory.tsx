"use client";

import { useEffect, useState } from "react";
import {
  listVersions,
  restoreVersion,
  type PaperVersion,
  type SaveType,
} from "@/lib/api";

interface VersionHistoryProps {
  /** The note ID to scope versions */
  noteId: string;
  /** Whether the slide panel is visible */
  open: boolean;
  /** Close the panel */
  onClose: () => void;
  /** Called after a version is restored — parent should update editor content */
  onRestore: (content: string) => void;
}

function SaveTypeBadge({ type }: { type: SaveType }) {
  return type === "manual" ? (
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
      수동
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
      자동
    </span>
  );
}

function PreviewModal({
  version,
  onClose,
  onRestore,
}: {
  version: PaperVersion;
  onClose: () => void;
  onRestore: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-8 left-1/2 z-50 flex w-[600px] max-w-[90vw] -translate-x-1/2 flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <SaveTypeBadge type={version.save_type} />
            <span className="text-sm text-slate-600">
              {new Date(version.created_at).toLocaleString("ko-KR")}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 font-sans">
            {version.content}
          </pre>
        </div>
        <div className="border-t border-slate-200 px-5 py-3">
          <button
            onClick={onRestore}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            이 버전으로 복원
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Slide-over version history panel.
 *
 * Props:
 *   noteId    — scopes version list to this note
 *   open      — controls panel visibility (translate-x animation)
 *   onClose   — close handler
 *   onRestore — called with restored content string after successful restore
 */
export default function VersionHistory({
  noteId,
  open,
  onClose,
  onRestore,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<PaperVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState<PaperVersion | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Fetch when panel opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listVersions(noteId)
      .then(setVersions)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [open, noteId]);

  const handleRestore = async (version: PaperVersion) => {
    setRestoring(version.id);
    try {
      const restored = await restoreVersion(version.id);
      onRestore(restored.content);
      setPreviewing(null);
      onClose();
    } catch {
      // silent — parent will surface errors if needed
    } finally {
      setRestoring(null);
    }
  };

  return (
    <>
      {/* Backdrop (only when open) */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/20"
          aria-hidden
          onClick={onClose}
        />
      )}

      {/* Slide panel */}
      <div
        className={`fixed inset-y-0 right-0 z-30 flex w-80 flex-col bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">버전 히스토리</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              저장된 버전이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {versions.map((v) => (
                <li key={v.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <SaveTypeBadge type={v.save_type} />
                      <p className="mt-1 text-xs text-slate-600">
                        {new Date(v.created_at).toLocaleString("ko-KR")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                        {v.content.slice(0, 60)}…
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setPreviewing(v)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      미리보기
                    </button>
                    <button
                      onClick={() => handleRestore(v)}
                      disabled={restoring === v.id}
                      className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      {restoring === v.id ? "복원 중…" : "복원"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewing && (
        <PreviewModal
          version={previewing}
          onClose={() => setPreviewing(null)}
          onRestore={() => handleRestore(previewing)}
        />
      )}
    </>
  );
}
