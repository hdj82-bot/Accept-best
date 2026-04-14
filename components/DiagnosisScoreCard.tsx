import type { Diagnosis } from "@/lib/api";

const SECTION_LABELS: Record<string, string> = {
  introduction: "서론",
  methodology: "연구 방법",
  results: "결과",
  discussion: "논의",
  conclusion: "결론",
  references: "참고문헌",
  abstract: "초록",
  literature_review: "문헌 검토",
};

function scoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreRingColor(score: number): string {
  if (score >= 80) return "border-emerald-500";
  if (score >= 60) return "border-amber-500";
  return "border-red-500";
}

export default function DiagnosisScoreCard({
  diagnosis,
}: {
  diagnosis: Diagnosis;
}) {
  const entries = Object.entries(diagnosis.section_scores);

  return (
    <div className="flex flex-col gap-6">
      {/* Overall Score — 원형 게이지 */}
      <div className="flex flex-col items-center gap-2">
        <div
          className={`flex h-28 w-28 items-center justify-center rounded-full border-4 ${scoreRingColor(diagnosis.overall_score)}`}
        >
          <span className={`text-3xl font-bold ${scoreTextColor(diagnosis.overall_score)}`}>
            {diagnosis.overall_score}
          </span>
        </div>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          종합 점수
        </p>
      </div>

      {/* 항목별 바 차트 */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {entries.map(([key, score]) => (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {SECTION_LABELS[key] ?? key}
                </span>
                <span className={`font-semibold ${scoreTextColor(score)}`}>
                  {score}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all ${scoreColor(score)}`}
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
