import type { DiagnosisItem } from "@/lib/api";

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-600 dark:text-green-400";
  if (score >= 5) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-green-500";
  if (score >= 5) return "bg-yellow-500";
  return "bg-red-500";
}

export default function DiagnosisCard({ item }: { item: DiagnosisItem }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {item.label}
        </span>
        <span className={`text-sm font-bold ${scoreColor(item.score)}`}>
          {item.score}/10
        </span>
      </div>
      {/* Score bar */}
      <div className="mb-2 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-1.5 rounded-full ${scoreBg(item.score)}`}
          style={{ width: `${item.score * 10}%` }}
        />
      </div>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {item.feedback}
      </p>
    </div>
  );
}
