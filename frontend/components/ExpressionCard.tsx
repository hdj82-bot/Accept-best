"use client";

import { useState } from "react";
import type { Expression } from "@/lib/api";

export default function ExpressionCard({ expr }: { expr: Expression }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(expr.english);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      {/* 한국어 */}
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {expr.korean}
      </p>

      {/* 영어 */}
      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
          {expr.english}
        </p>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>

      {/* 사용 예시 */}
      {expr.example && (
        <div className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            사용 예시
          </span>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 italic dark:text-zinc-400">
            {expr.example}
          </p>
        </div>
      )}
    </div>
  );
}
