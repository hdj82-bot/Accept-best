"use client";

import { useEffect, useState } from "react";
import {
  getCollections,
  createCollection,
  addPaperToCollection,
  removePaperFromCollection,
  getCollectionPapers,
  type Collection,
} from "@/lib/api";

// ────────────────────────────────────────────────────────────────────────────
// Colour swatches
// ────────────────────────────────────────────────────────────────────────────

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
];

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface CollectionPanelProps {
  paperId: string;
  onClose: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export default function CollectionPanel({ paperId, onClose }: CollectionPanelProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // New collection form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);

  // Load collections + which ones contain this paper
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCollections()
      .then(async (cols) => {
        if (!alive) return;
        setCollections(cols);
        // Check membership for each collection in parallel
        const results = await Promise.all(
          cols.map((c) =>
            getCollectionPapers(c.id)
              .then((papers) => papers.some((p) => p.id === paperId) ? c.id : null)
              .catch(() => null)
          )
        );
        if (!alive) return;
        setMemberIds(new Set(results.filter(Boolean) as string[]));
      })
      .catch(() => null)
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [paperId]);

  const handleToggle = async (collectionId: string) => {
    setToggling(collectionId);
    const isMember = memberIds.has(collectionId);
    try {
      if (isMember) {
        await removePaperFromCollection(collectionId, paperId);
        setMemberIds((s) => { const n = new Set(s); n.delete(collectionId); return n; });
        setCollections((cs) =>
          cs.map((c) => c.id === collectionId ? { ...c, paper_count: c.paper_count - 1 } : c)
        );
      } else {
        await addPaperToCollection(collectionId, paperId);
        setMemberIds((s) => new Set([...s, collectionId]));
        setCollections((cs) =>
          cs.map((c) => c.id === collectionId ? { ...c, paper_count: c.paper_count + 1 } : c)
        );
      }
    } catch { /* ignore */ }
    setToggling(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createCollection({ name, color: newColor });
      setCollections((cs) => [...cs, created]);
      setNewName("");
      setNewColor(COLORS[0]);
      setShowForm(false);
    } catch { /* ignore */ }
    setCreating(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-80 flex-col bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            컬렉션에 추가
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : collections.length === 0 && !showForm ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-8">
              컬렉션이 없습니다.
            </p>
          ) : (
            collections.map((col) => {
              const isMember = memberIds.has(col.id);
              const isToggling = toggling === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => handleToggle(col.id)}
                  disabled={isToggling}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-60 ${
                    isMember
                      ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: col.color ?? "#3b82f6" }}
                  />
                  <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                    {col.name}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {col.paper_count}편
                  </span>
                  {isMember && (
                    <span className="text-blue-500 text-xs font-semibold">✓</span>
                  )}
                </button>
              );
            })
          )}

          {/* New collection form */}
          {showForm && (
            <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 p-3 space-y-2 dark:border-slate-700">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="컬렉션 이름"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              {/* Color picker */}
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`h-5 w-5 rounded-full border-2 transition ${
                      newColor === c ? "border-slate-600 dark:border-slate-200 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? "생성 중…" : "생성"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:text-slate-400"
          >
            + 새 컬렉션
          </button>
        </div>
      </aside>
    </>
  );
}
