"use client";

import type { CSSProperties } from "react";

/**
 * 공용 스켈레톤 로더.
 * - tailwind `animate-pulse` 기반, 다크모드 지원
 * - `aria-busy="true"` + `role="status"` + `sr-only` 텍스트로 스크린리더 사용자에게 로딩 상태 전달
 */
export function Skeleton({
  className = "",
  width,
  height,
  rounded = "rounded-lg",
  label = "불러오는 중",
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
  rounded?: string;
  label?: string;
}) {
  const style: CSSProperties = {};
  if (width !== undefined) style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 ${rounded} ${className}`}
      style={style}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** 텍스트 여러 줄 스켈레톤 */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-slate-200 dark:bg-slate-800"
          style={{ width: `${100 - i * 8}%` }}
        />
      ))}
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}

/** 카드 스켈레톤 */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      <div className="h-3 w-1/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-3 h-6 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 space-y-2">
        <div className="h-2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-2 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}

/** 표 행 스켈레톤 */
export function SkeletonTableRows({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="space-y-1" role="status" aria-busy="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 rounded-lg border border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
        >
          {Array.from({ length: columns }).map((_, c) => (
            <div
              key={c}
              className="h-3 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-800"
              style={{ maxWidth: c === 0 ? "40%" : undefined }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">표 불러오는 중</span>
    </div>
  );
}
