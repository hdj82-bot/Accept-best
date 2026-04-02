"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import TagInput from "@/components/TagInput";
import CollectionPanel from "@/components/CollectionPanel";
import {
  getCollections,
  deleteCollection,
  getCollectionPapers,
  getTags,
  getPapersByTag,
  addTag,
  removeTag,
  type Collection,
  type Paper,
  type TagWithCount,
} from "@/lib/api";

export default function CollectionsPage() {
  return (
    <AuthGuard>
      <CollectionsContent />
    </AuthGuard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Paper slide panel
// ────────────────────────────────────────────────────────────────────────────

interface PaperListPanelProps {
  collection: Collection;
  onClose: () => void;
}

function PaperListPanel({ collection, onClose }: PaperListPanelProps) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  // Track tags per paper: paperId → string[]
  const [paperTags, setPaperTags] = useState<Record<string, string[]>>({});

  useEffect(() => {
    getCollectionPapers(collection.id)
      .then((ps) => {
        setPapers(ps);
        // Initialize tag map with empty arrays
        const init: Record<string, string[]> = {};
        ps.forEach((p) => { init[p.id] = []; });
        setPaperTags(init);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [collection.id]);

  const handleAddTag = async (paperId: string, tag: string) => {
    try {
      await addTag(paperId, tag);
      setPaperTags((t) => ({ ...t, [paperId]: [...(t[paperId] ?? []), tag] }));
    } catch { /* ignore */ }
  };

  const handleRemoveTag = async (paperId: string, tag: string) => {
    try {
      await removeTag(paperId, tag);
      setPaperTags((t) => ({ ...t, [paperId]: (t[paperId] ?? []).filter((x) => x !== tag) }));
    } catch { /* ignore */ }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-96 flex-col bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: collection.color ?? "#3b82f6" }}
            />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {collection.name}
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {collection.paper_count}편
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))
          ) : papers.length === 0 ? (
            <p className="text-center text-sm text-slate-400 mt-8">논문이 없습니다.</p>
          ) : (
            papers.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                  {p.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {p.authors.slice(0, 2).join(", ")}{p.authors.length > 2 ? " 외" : ""}
                  {p.year ? ` · ${p.year}` : ""}
                </p>
                <div className="mt-2">
                  <TagInput
                    tags={paperTags[p.id] ?? []}
                    onAdd={(tag) => handleAddTag(p.id, tag)}
                    onRemove={(tag) => handleRemoveTag(p.id, tag)}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main content
// ────────────────────────────────────────────────────────────────────────────

function CollectionsContent() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCols, setLoadingCols] = useState(true);
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagPapers, setTagPapers] = useState<Paper[]>([]);
  const [loadingTag, setLoadingTag] = useState(false);

  // Which collection's paper list is open
  const [openCollection, setOpenCollection] = useState<Collection | null>(null);
  // Which paper's "add to collection" panel is open
  const [collectionTargetPaper, setCollectionTargetPaper] = useState<string | null>(null);

  useEffect(() => {
    getCollections()
      .then(setCollections)
      .catch(() => null)
      .finally(() => setLoadingCols(false));
    getTags().then(setTags).catch(() => null);
  }, []);

  const handleTagClick = async (tag: string) => {
    if (activeTag === tag) {
      setActiveTag(null);
      setTagPapers([]);
      return;
    }
    setActiveTag(tag);
    setLoadingTag(true);
    try {
      const result = await getPapersByTag(tag);
      setTagPapers(result.items);
    } catch { setTagPapers([]); }
    setLoadingTag(false);
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm("이 컬렉션을 삭제하시겠습니까?")) return;
    try {
      await deleteCollection(id);
      setCollections((cs) => cs.filter((c) => c.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            ← 대시보드
          </Link>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">내 컬렉션</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">

        {/* ── Collections grid ── */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">컬렉션</h2>
          {loadingCols ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-slate-400 dark:text-slate-500 text-sm">컬렉션이 없습니다.</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">논문 검색에서 컬렉션에 추가해보세요.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {collections.map((col) => (
                <div
                  key={col.id}
                  className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="h-3.5 w-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: col.color ?? "#3b82f6" }}
                    />
                    <h3 className="flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {col.name}
                    </h3>
                    <button
                      onClick={() => handleDeleteCollection(col.id)}
                      className="hidden group-hover:block text-slate-300 hover:text-red-500 text-xs"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{col.paper_count}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">편의 논문</p>
                  <button
                    onClick={() => setOpenCollection(col)}
                    className="mt-4 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    논문 보기 →
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Tag cloud ── */}
        {tags.length > 0 && (
          <section>
            <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">태그</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    activeTag === tag
                      ? "border-blue-400 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  #{tag}
                  <span className="ml-1 text-slate-400 dark:text-slate-500">{count}</span>
                </button>
              ))}
            </div>

            {/* Tag papers */}
            {activeTag && (
              <div className="mt-4">
                <h3 className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                  #{activeTag} 논문
                </h3>
                {loadingTag ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                    ))}
                  </div>
                ) : tagPapers.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500">논문이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {tagPapers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-1">
                            {p.title}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {p.authors.slice(0, 2).join(", ")}{p.authors.length > 2 ? " 외" : ""}
                            {p.year ? ` · ${p.year}` : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => setCollectionTargetPaper(p.id)}
                          className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600 dark:border-slate-600 dark:text-slate-400"
                        >
                          + 컬렉션
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Paper list slide panel */}
      {openCollection && (
        <PaperListPanel
          collection={openCollection}
          onClose={() => setOpenCollection(null)}
        />
      )}

      {/* Add to collection panel */}
      {collectionTargetPaper && (
        <CollectionPanel
          paperId={collectionTargetPaper}
          onClose={() => setCollectionTargetPaper(null)}
        />
      )}
    </main>
  );
}
