import Link from "next/link";
import type { Reference } from "@/lib/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ReferenceCard({
  reference,
}: {
  reference: Reference;
}) {
  return (
    <Link
      href={`/references/${reference.id}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      {/* 메타 */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        {reference.year && <span>{reference.year}년</span>}
        {reference.journal && (
          <>
            {reference.year && <span className="text-zinc-300 dark:text-zinc-700">|</span>}
            <span className="italic">{reference.journal}</span>
          </>
        )}
        {reference.doi && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <span className="font-mono">{reference.doi}</span>
          </>
        )}
        {reference.created_at && (
          <>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <span>{formatDate(reference.created_at)}</span>
          </>
        )}
      </div>

      {/* 제목 */}
      <h3 className="text-base font-semibold leading-snug text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300">
        {reference.title}
      </h3>

      {/* 저자 */}
      {reference.authors && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {reference.authors}
        </p>
      )}

      {/* 메모 */}
      {reference.memo && (
        <p className="mt-2 line-clamp-2 text-sm text-zinc-400 dark:text-zinc-500">
          {reference.memo}
        </p>
      )}
    </Link>
  );
}
