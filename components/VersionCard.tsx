import Link from "next/link";
import type { PaperVersion } from "@/lib/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function contentPreview(content: Record<string, unknown>): string {
  const keys = Object.keys(content);
  if (keys.length === 0) return "(빈 내용)";

  const parts: string[] = [];
  for (const key of keys.slice(0, 3)) {
    const val = content[key];
    const str = typeof val === "string" ? val : JSON.stringify(val);
    parts.push(`${key}: ${str}`);
  }

  const preview = parts.join(" / ");
  const suffix = keys.length > 3 ? ` (+${keys.length - 3})` : "";
  return preview.length > 120
    ? preview.slice(0, 120) + "..." + suffix
    : preview + suffix;
}

export default function VersionCard({
  version,
}: {
  version: PaperVersion;
}) {
  const isAuto = version.save_type === "auto";

  return (
    <Link
      href={`/versions/${version.id}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      {/* 메타 */}
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
        <span
          className={`rounded px-1.5 py-0.5 font-medium ${
            isAuto
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          }`}
        >
          {isAuto ? "자동" : "수동"}
        </span>
        {version.created_at && <span>{formatDate(version.created_at)}</span>}
      </div>

      {/* 미리보기 */}
      <p className="line-clamp-2 text-sm leading-relaxed text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200">
        {contentPreview(version.content)}
      </p>
    </Link>
  );
}
