"use client";

import { useState, useRef, useEffect } from "react";
import { searchPapers, type Paper, type SearchFilters } from "@/lib/api";

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
}

function PaperCard({ paper, onClick }: PaperCardProps) {
  const score = paper.similarity_score;
  const scoreColor =
    score === null ? "text-slate-400"
      : score >= 0.85 ? "text-emerald-600"
      : score >= 0.70 ? "text-amber-600"
      : "text-slate-500";

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
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
 * Paper search panel with results list, filter toggle, and slide-over detail.
 *
 * Props:
 *   onSelectPaper  — callback when user clicks "노트에 추가" in the detail panel
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = async (q: string, f: SearchFilters = filters) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const papers = await searchPapers(trimmed, f);
      setResults(papers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-run if initialQuery supplied
  useEffect(() => {
    if (initialQuery.trim()) runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  // Re-run search when filter changes (only if there's an active query)
  const handleFilterChange = (f: SearchFilters) => {
    setFilters(f);
    if (query.trim()) runSearch(query, f);
  };

  const hasActiveFilters =
    !!filters.year_from || !!filters.year_to || (filters.source && filters.source !== "all");

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="mb-2 flex gap-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="논문 키워드·제목 검색…"
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
