"use client";

import { useEffect, useState } from "react";
import {
  getDiagnosisShareCard,
  type DiagnosisShareCard as DiagnosisShareCardType,
  ApiError,
} from "@/lib/api";

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export default function ShareCard({
  diagnosisId,
}: {
  diagnosisId: string;
}) {
  const [card, setCard] = useState<DiagnosisShareCardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchCard() {
      setLoading(true);
      setError(null);
      try {
        const result = await getDiagnosisShareCard(diagnosisId);
        if (!cancelled) setCard(result);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("공유 카드를 불러오는 중 오류가 발생했습니다.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCard();
    return () => { cancelled = true; };
  }, [diagnosisId]);

  async function handleCopy() {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.createElement("input");
      input.value = card.share_url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
        {error ?? "공유 카드를 불러올 수 없습니다."}
      </div>
    );
  }

  const entries = Object.entries(card.section_scores);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      {/* 헤더 */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            논문 건강검진 결과
          </p>
          <h3 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {card.paper_title}
          </h3>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-current">
          <span className={`text-lg font-bold ${scoreColor(card.overall_score)}`}>
            {card.overall_score}
          </span>
        </div>
      </div>

      {/* 항목별 미니 바 */}
      {entries.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {entries.map(([key, score]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 text-zinc-500 dark:text-zinc-400">{key}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full ${scoreBg(score)}`}
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>
              <span className={`w-6 text-right font-medium ${scoreColor(score)}`}>{score}</span>
            </div>
          ))}
        </div>
      )}

      {/* 공유 URL + 복사 버튼 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={card.share_url}
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
        />
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {copied ? "복사됨!" : "URL 복사"}
        </button>
      </div>
    </div>
  );
}
