"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/Skeleton";

/**
 * 관리자 대시보드용 KPI 카드.
 */
export default function StatCard({
  label,
  value,
  sublabel,
  icon,
  loading = false,
  trend,
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
  loading?: boolean;
  trend?: { value: number; positive?: boolean };
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {icon && (
          <span className="text-xl" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2">
        {loading ? (
          <Skeleton height={36} width={120} />
        ) : (
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {value}
          </p>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${
              trend.positive ?? trend.value >= 0
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
            aria-label={`변화율 ${trend.value}%`}
          >
            {(trend.positive ?? trend.value >= 0) ? "↑" : "↓"}
            {Math.abs(trend.value)}%
          </span>
        )}
        {sublabel && (
          <span className="text-slate-500 dark:text-slate-400">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
