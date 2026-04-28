"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import { getVersion, deleteVersion, type PaperVersion, ApiError } from "@/lib/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "날짜 정보 없음";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderContent(content: Record<string, unknown>, depth = 0): React.ReactNode {
  const entries = Object.entries(content);
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-400 dark:text-zinc-500">(빈 내용)</p>;
  }

  return (
    <div className={`flex flex-col gap-3 ${depth > 0 ? "ml-4 border-l-2 border-zinc-200 pl-4 dark:border-zinc-800" : ""}`}>
      {entries.map(([key, value]) => (
        <div key={key}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {key}
          </h4>
          {typeof value === "object" && value !== null && !Array.isArray(value) ? (
            renderContent(value as Record<string, unknown>, depth + 1)
          ) : Array.isArray(value) ? (
            <ul className="mt-1 list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
              {value.map((item, i) => (
                <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {typeof value === "string" ? value : JSON.stringify(value)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function VersionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  const [version, setVersion] = useState<PaperVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token || !params.id) return;

    let cancelled = false;

    async function fetchVersion() {
      setLoading(true);
      setError(null);
      try {
        const result = await getVersion(params.id, token!);
        if (!cancelled) setVersion(result);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("버전을 불러오는 중 오류가 발생했습니다.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchVersion();
    return () => { cancelled = true; };
  }, [session, params.id]);

  async function handleDelete() {
    if (!version) return;
    const token = session?.accessToken;
    if (!token) return;

    setDeleting(true);
    try {
      await deleteVersion(version.id, token);
      router.push("/versions");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("삭제 중 오류가 발생했습니다.");
      }
      setDeleting(false);
    }
  }

  const isAuto = version?.save_type === "auto";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-lg font-bold text-zinc-900 transition-colors hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
          >
            논문집필 도우미
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <Link
            href="/versions"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            논문 버전관리
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <span className="text-sm text-zinc-400 dark:text-zinc-500">상세</span>
        </div>
        <UserMenu />
      </header>

      {/* 본문 */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
            <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
              버전을 불러오고 있습니다...
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {version && (
          <>
            {/* 메타 정보 */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  isAuto
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                }`}
              >
                {isAuto ? "자동 저장" : "수동 저장"}
              </span>
              <span>{formatDate(version.created_at)}</span>
            </div>

            {/* 내용 */}
            <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              {renderContent(version.content)}
            </section>

            {/* 액션 버튼 */}
            <div className="flex flex-wrap gap-3">
              {!isAuto && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-950"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  {deleting ? "삭제 중..." : "이 버전 삭제"}
                </button>
              )}
            </div>

            {/* 뒤로가기 */}
            <div className="pt-4">
              <Link
                href="/versions"
                className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                목록으로 돌아가기
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
