"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import TagInput from "@/components/TagInput";
import CollectionPanel from "@/components/CollectionPanel";
import EmptyState from "@/components/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { useCollections, invalidate } from "@/lib/hooks";
import { useLocale } from "@/lib/i18n";
import {
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
  const [paperTags, setPaperTags] = useState<Record<string, string[]>>({});

  useEffect(() => {
    getCollectionPapers(collection.id)
      .then((ps) => {
        setPapers(ps);
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
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${collection.name} 컬렉션 논문 목록`}
        className="fixed right-0 top-0 z-50 flex h-full w-96 flex-col bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: collection.color ?? "#3b82f6" }}
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {collection.name}
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {collection.paper_count}편
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div role="status" aria-busy="true" className="space-y-3">
              <Skeleton height={80} />
              <Skeleton height={80} />
              <Skeleton height={80} />
            </div>
          ) : papers.length === 0 ? (
            <EmptyState
              icon="📄"
              title={t("collections.noPapersInCol")}
              description={t("collections.noPapersInColDesc")}
            />
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
  const { data: collections, isLoading: loadingCols, error: colsError } = useCollections();
  const { t } = useLocale();
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagPapers, setTagPapers] = useState<Paper[]>([]);
  const [loadingTag, setLoadingTag] = useState(false);

  const [openCollection, setOpenCollection] = useState<Collection | null>(null);
  const [collectionTargetPaper, setCollectionTargetPaper] = useState<string | null>(null);

  useEffect(() => {
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
      setTagPapers(result);
    } catch { setTagPapers([]); }
    setLoadingTag(false);
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm(t("collections.deleteConfirm"))) return;
    try {
      await deleteCollection(id);
      invalidate("collections");
    } catch { /* ignore */ }
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-200">
            {t("common.backToDashboard")}
          </Link>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t("collections.title")}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">

        {/* Collections grid */}
        <section aria-labelledby="collections-heading">
          <h2 id="collections-heading" className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">{t("collections.heading")}</h2>
          {loadingCols ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : colsError ? (
            <EmptyState
              icon="⚠️"
              tone="error"
              title={t("collections.loadError")}
              description={t("collections.loadErrorDesc")}
            />
          ) : !collections || collections.length === 0 ? (
            <EmptyState
              icon="📁"
              title={t("collections.empty")}
              description={t("collections.emptyDesc")}
              action={{ label: t("collections.goSearch"), href: "/research" }}
            />
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
                      aria-hidden="true"
                    />
                    <h3 className="flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {col.name}
                    </h3>
                    <button
                      onClick={() => handleDeleteCollection(col.id)}
                      className="hidden group-hover:block text-slate-300 hover:text-red-500 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label={`${col.name} 삭제`}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{col.paper_count}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t("collections.papers")}</p>
                  <button
                    onClick={() => setOpenCollection(col)}
                    className="mt-4 rounded-lg border border-slate-200 py-1.5 text-xs text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    {t("collections.viewPapers")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tag cloud */}
        {tags.length > 0 && (
          <section aria-labelledby="tags-heading">
            <h2 id="tags-heading" className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">{t("collections.tags")}</h2>
            <div className="flex flex-wrap gap-2" role="list" aria-label="태그 목록">
              {tags.map(({ tag, count }) => (
                <button
                  key={tag}
                  role="listitem"
                  onClick={() => handleTagClick(tag)}
                  aria-pressed={activeTag === tag}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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

            {activeTag && (
              <div className="mt-4">
                <h3 className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                  #{activeTag} 논문
                </h3>
                {loadingTag ? (
                  <div className="space-y-2" role="status" aria-busy="true">
                    <Skeleton height={64} />
                    <Skeleton height={64} />
                  </div>
                ) : tagPapers.length === 0 ? (
                  <EmptyState icon="📄" title={t("collections.noTagPapers")} description={t("collections.noTagPapersDesc")} />
                ) : (
                  <ul className="space-y-2" aria-label={`#${activeTag} 태그 논문 목록`}>
                    {tagPapers.map((p) => (
                      <li
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
                          className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:text-slate-400"
                        >
                          {t("collections.addToCollection")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {openCollection && (
        <PaperListPanel collection={openCollection} onClose={() => setOpenCollection(null)} />
      )}

      {collectionTargetPaper && (
        <CollectionPanel paperId={collectionTargetPaper} onClose={() => setCollectionTargetPaper(null)} />
      )}
    </main>
  );
}
