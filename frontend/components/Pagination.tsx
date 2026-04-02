"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Page navigator with prev/next and up to 5 numbered buttons.
 *
 * Props:
 *   page         — current page (1-based)
 *   totalPages   — total number of pages
 *   onPageChange — called with new page number
 */
export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build a window of up to 5 pages centred on current page
  const half = 2;
  let start = Math.max(1, page - half);
  let end   = Math.min(totalPages, page + half);

  // Shift window if near edges
  if (end - start < 4) {
    if (start === 1) end   = Math.min(totalPages, start + 4);
    else             start = Math.max(1, end - 4);
  }

  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const btnBase =
    "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition";
  const btnActive = "bg-blue-600 text-white shadow-sm";
  const btnIdle   = "text-slate-600 hover:bg-slate-100";
  const btnDisabled = "text-slate-300 cursor-not-allowed";

  return (
    <nav
      className="flex items-center justify-center gap-1 pt-4"
      aria-label="페이지 탐색"
    >
      {/* Previous */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={`${btnBase} ${page <= 1 ? btnDisabled : btnIdle}`}
        aria-label="이전 페이지"
      >
        ‹
      </button>

      {/* First page + ellipsis */}
      {start > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className={`${btnBase} ${btnIdle}`}>
            1
          </button>
          {start > 2 && <span className="px-1 text-slate-400 text-sm">…</span>}
        </>
      )}

      {/* Page window */}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={`${btnBase} ${p === page ? btnActive : btnIdle}`}
        >
          {p}
        </button>
      ))}

      {/* Ellipsis + last page */}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && (
            <span className="px-1 text-slate-400 text-sm">…</span>
          )}
          <button
            onClick={() => onPageChange(totalPages)}
            className={`${btnBase} ${btnIdle}`}
          >
            {totalPages}
          </button>
        </>
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className={`${btnBase} ${page >= totalPages ? btnDisabled : btnIdle}`}
        aria-label="다음 페이지"
      >
        ›
      </button>
    </nav>
  );
}
