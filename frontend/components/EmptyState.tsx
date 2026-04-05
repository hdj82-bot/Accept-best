"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 통일된 빈 상태(Empty State) UI.
 *
 * 사용 예:
 *   <EmptyState
 *     icon="📄"
 *     title="노트가 없습니다"
 *     description="첫 연구 노트를 작성해 보세요."
 *     action={{ label: "새 노트 만들기", href: "/research" }}
 *   />
 */
export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = "",
  tone = "neutral",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  tone?: "neutral" | "error";
}) {
  const border =
    tone === "error"
      ? "border-red-200 dark:border-red-900"
      : "border-slate-200 dark:border-slate-700";
  const bg =
    tone === "error"
      ? "bg-red-50/50 dark:bg-red-950/20"
      : "bg-white dark:bg-slate-900";

  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center ${border} ${bg} ${className}`}
    >
      {icon && (
        <div className="text-4xl" aria-hidden="true">
          {icon}
        </div>
      )}
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action && <EmptyStateButton variant="primary" action={action} />}
          {secondaryAction && (
            <EmptyStateButton variant="secondary" action={secondaryAction} />
          )}
        </div>
      )}
    </div>
  );
}

function EmptyStateButton({
  action,
  variant,
}: {
  action: EmptyStateAction;
  variant: "primary" | "secondary";
}) {
  const base =
    "rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500";
  const styles =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";
  const className = `${base} ${styles}`;

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}
