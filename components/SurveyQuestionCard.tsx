import Link from "next/link";
import type { SurveyQuestion } from "@/lib/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SurveyQuestionCard({
  question,
}: {
  question: SurveyQuestion;
}) {
  return (
    <Link
      href={`/survey/${question.id}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      {/* 메타 정보 */}
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        {question.source_title && (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {question.source_title}
          </span>
        )}
        {question.year && <span>{question.year}년</span>}
        {question.source_page != null && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <span>p.{question.source_page}</span>
          </>
        )}
        {question.created_at && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <span>{formatDate(question.created_at)}</span>
          </>
        )}
      </div>

      {/* 원본 질문 */}
      <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        <span className="mr-1.5 inline-block rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          원본
        </span>
        {question.original_q}
      </p>

      {/* 변환된 질문 */}
      <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300">
        <span className="mr-1.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          설문
        </span>
        {question.adapted_q}
      </p>
    </Link>
  );
}
