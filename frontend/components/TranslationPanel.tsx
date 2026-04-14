"use client";

import { useState } from "react";

interface TranslationPanelProps {
  original: string;
  translated: string;
}

export default function TranslationPanel({
  original,
  translated,
}: TranslationPanelProps) {
  const [copiedSide, setCopiedSide] = useState<"original" | "translated" | null>(null);

  async function handleCopy(text: string, side: "original" | "translated") {
    await navigator.clipboard.writeText(text);
    setCopiedSide(side);
    setTimeout(() => setCopiedSide(null), 2000);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* 원문 */}
      <div className="flex flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            원문
          </span>
          <button
            onClick={() => handleCopy(original, "original")}
            className="rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            {copiedSide === "original" ? "복사됨" : "복사"}
          </button>
        </div>
        <div className="flex-1 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {original}
          </p>
        </div>
      </div>

      {/* 번역문 */}
      <div className="flex flex-col rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex items-center justify-between border-b border-blue-200 px-4 py-3 dark:border-blue-900">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            번역문
          </span>
          <button
            onClick={() => handleCopy(translated, "translated")}
            className="rounded px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-800 dark:text-blue-400 dark:hover:bg-blue-900 dark:hover:text-blue-200"
          >
            {copiedSide === "translated" ? "복사됨" : "복사"}
          </button>
        </div>
        <div className="flex-1 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-blue-900 dark:text-blue-200">
            {translated}
          </p>
        </div>
      </div>
    </div>
  );
}
