"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  searchPapers,
  getSearchHistory,
  type Paper,
  type SearchFilters,
  type SearchHistoryItem,
} from "@/lib/api";
import BookmarkButton from "@/components/BookmarkButton";
import Pagination from "@/components/Pagination";

interface PaperSearchPanelProps {
  /** Called when the user selects a paper to add to the current note */
  onSelectPaper?: (paper: Paper) => void;
  /** Initial query to pre-fill the search box */
  initialQuery?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Skeleton card shown while loading
// ────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
      <div className="mb-3 h-3 w-1/2 rounded bg-slate-100" />
      <div className="space-y-1.5">
        <div className="h-3 rounded bg-slate-100" />
        <div className="h-3 w-5/6 rounded bg-slate-100" />
        <div className="h-3 w-4/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Paper result card
// ────────────────────────────────────────────────────────────────────────────

interface PaperCardProps {
  paper: Paper;
  onClick: () => void;
  isBookmarked?: boolean;
}

function PaperCard({ paper, onClick, isBookmarked = false }: PaperCardProps) {
  const score = paper.similarity_score;
  const scoreColor =
    score === null ? "text-slate-400"
      : score >= 0.85 ? "text-emerald-600"
      : score >= 0.70 ? "text-amber-600"
      : "text-slate-500";

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md">
      {/* Bookmark button — top-right, above the click area */}
      <div className="absolute right-2 top-2 z-10">
        <BookmarkButton paperId={paper.id} isBookmarked={isBookmarked} size="sm" />
      </div>

      <button
        onClick={onClick}
        className="w-full p-4 text-left"
      >
      <div className="mb-1 flex items-start justify-between gap-2 pr-7">
        <h3 className="text-sm font-semibold leading-snug text-slate-800 line-clamp-2">
          {paper.title}
        </h3>
        {score !== null && (
          <span className={`shrink-0 text-xs font-medium ${scoreColor}`}>
            {(score * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-slate-500">
        {paper.authors.slice(0, 3).join(", ")}
        {paper.authors.length > 3 ? " 외" : ""}
        {paper.year ? ` · ${paper.year}` : ""}
        {" · "}
        <span className="capitalize">{paper.source.replace("_", " ")}</span>
      </p>
      {paper.abstract && (
        <p className="text-xs leading-relaxed text-slate-600 line-clamp-3">
          {paper.abstract}
        </p>
      )}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Detail slide panel
// ────────────────────────────────────────────────────────────────────────────

interface DetailPanelProps {
  paper: Paper;
  onClose: () => void;
  onSelect?: (paper: Paper) => void;
}

function DetailPanel({ paper, onClose, onSelect }: DetailPanelProps) {
  // Trap focus & close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/30"
        aria-hidden
        onClick={onClose}
      />
      {/* Slide panel */}
      <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-800">논문 상세</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <h3 className="text-base font-bold leading-snug text-slate-900">
            {paper.title}
          </h3>

          <div className="text-sm text-slate-600">
            <span className="font-medium">저자: </span>
            {paper.authors.join(", ") || "—"}
          </div>

          {paper.year && (
            <div className="text-sm text-slate-600">
              <span className="font-medium">출판연도: </span>{paper.year}
            </div>
          )}

          <div className="text-sm text-slate-600">
            <span className="font-medium">출처: </span>
            <span className="capitalize">{paper.source.replace("_", " ")}</span>
            {" · "}
            <span className="font-mono text-xs">{paper.source_id}</span>
          </div>

          {paper.similarity_score !== null && (
            <div className="text-sm text-slate-600">
              <span className="font-medium">유사도: </span>
              {(paper.similarity_score * 100).toFixed(1)}%
            </div>
          )}

          {paper.abstract && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">초록</p>
              <p className="text-sm leading-relaxed text-slate-600">{paper.abstract}</p>
            </div>
          )}
        </div>

        {onSelect && (
          <div className="border-t border-slate-200 px-6 py-4">
            <button
              onClick={() => { onSelect(paper); onClose(); }}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              노트에 추가
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Filter panel
// ────────────────────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
}

function FilterPanel({ filters, onChange }: FilterPanelProps) {
  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      {/* Year range */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-600">출판 연도</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="시작"
            min={1900}
            max={new Date().getFullYear()}
            value={filters.year_from ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                year_from: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
          />
          <span className="text-xs text-slate-400">~</span>
          <input
            type="number"
            placeholder="종료"
            min={1900}
            max={new Date().getFullYear()}
            value={filters.year_to ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                year_to: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Source radio */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-600">출처</p>
        <div className="flex gap-3">
          {(
            [
              { value: "all",              label: "전체" },
              { value: "arxiv",            label: "arXiv" },
              { value: "semantic_scholar", label: "Semantic Scholar" },
            ] as const
          ).map(({ value, label }) => (
            <label key={value} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="source"
                value={value}
                checked={(filters.source ?? "all") === value}
                onChange={() => onChange({ ...filters, source: value })}
                className="accent-blue-600"
              />
              <span className="text-xs text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

/**
 * Paper search panel with history dropdown, filter toggle, bookmark buttons,
 * paginated results, and slide-over detail view.
 *
 * Props:
 *   onSelectPaper  — callback when user clicks "노트에 추가"
 *   initialQuery   — pre-fills and auto-runs the first search
 */
export default function PaperSearchPanel({
  onSelectPaper,
  initialQuery = "",
}: PaperSearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>({ source: "all" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [results, setResults] = useState<Paper[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  // History dropdown
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Close history dropdown on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHistoryOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const runSearch = useCallback(async (
    q: string,
    f: SearchFilters = filters,
    p = 1,
  ) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setHistoryOpen(false);
    try {
      const result = await searchPapers(trimmed, f, p);
      setResults(result.items);
      setPage(result.page);
      setTotalPages(result.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Auto-run if initialQuery supplied
  useEffect(() => {
    if (initialQuery.trim()) runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFocus = async () => {
    if (history.length === 0) {
      try {
        const h = await getSearchHistory();
        setHistory(h.slice(0, 5));
      } catch { /* ignore */ }
    }
    if (history.length > 0 || !query) setHistoryOpen(true);
  };

  // Show dropdown whenever we have history and input is focused
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (history.length > 0) setHistoryOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query, filters, 1);
  };

  const handleHistoryClick = (q: string) => {
    setQuery(q);
    runSearch(q, filters, 1);
  };

  const handleFilterChange = (f: SearchFilters) => {
    setFilters(f);
    if (query.trim()) runSearch(query, f, 1);
  };

  const handlePageChange = (p: number) => {
    runSearch(query, filters, p);
  };

  const hasActiveFilters =
    !!filters.year_from || !!filters.year_to || (filters.source && filters.source !== "all");

  return (
    <div className="flex h-full flex-col">
      {/* Search bar + history dropdown */}
      <div ref={historyRef} className="relative mb-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={handleQueryChange}
            onFocus={handleFocus}
            placeholder="논문 키워드·제목 검색…"
            autoComplete="off"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            검색
          </button>
        </form>

        {/* History dropdown */}
        {historyOpen && history.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              최근 검색어
            </p>
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => handleHistoryClick(item.query)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="text-slate-400">🕐</span>
                {item.query}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter toggle */}
      <button
        type="button"
        onClick={() => setFiltersOpen((o) => !o)}
        className={`mb-3 flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1 text-xs transition ${
          hasActiveFilters
            ? "bg-blue-50 text-blue-700 font-medium"
            : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        <span>{filtersOpen ? "▲" : "▼"}</span>
        필터{hasActiveFilters ? " (적용 중)" : ""}
      </button>

      {/* Filter panel */}
      {filtersOpen && (
        <FilterPanel filters={filters} onChange={handleFilterChange} />
      )}

      {/* Error */}
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : results.length > 0
          ? results.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onClick={() => setSelectedPaper(paper)}
              />
            ))
          : !loading && query && (
              <p className="py-8 text-center text-sm text-slate-400">
                검색 결과가 없습니다.
              </p>
            )}

        {/* Pagination */}
        {!loading && results.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {/* Detail slide panel */}
      {selectedPaper && (
        <DetailPanel
          paper={selectedPaper}
          onClose={() => setSelectedPaper(null)}
          onSelect={onSelectPaper}
        />
      )}
    </div>
  );
}
