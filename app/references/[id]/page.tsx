"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import ReferenceForm from "@/components/ReferenceForm";
import { getReference, deleteReference, type Reference, ApiError } from "@/lib/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "날짜 정보 없음";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ReferenceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  const [reference, setReference] = useState<Reference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  function fetchReference() {
    const token = (session as any)?.accessToken as string | undefined;
    if (!token || !params.id) return;

    setLoading(true);
    setError(null);
    getReference(params.id, token)
      .then(setReference)
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("참고문헌을 불러오는 중 오류가 발생했습니다.");
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchReference();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, params.id]);

  async function handleDelete() {
    if (!reference) return;
    const token = (session as any)?.accessToken as string | undefined;
    if (!token) return;

    setDeleting(true);
    try {
      await deleteReference(reference.id, token);
      router.push("/references");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("삭제 중 오류가 발생했습니다.");
      }
      setDeleting(false);
    }
  }

  async function handleCopyCitation() {
    if (!reference?.citation_text) return;
    try {
      await navigator.clipboard.writeText(reference.citation_text);
    } catch {
      const input = document.createElement("input");
      input.value = reference.citation_text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
            href="/references"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            참고문헌 관리
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
              참고문헌을 불러오고 있습니다...
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {reference && (
          <>
            {/* 메타 */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              {reference.year && <span>{reference.year}년</span>}
              {reference.journal && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span className="italic">{reference.journal}</span>
                </>
              )}
              {reference.doi && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <span className="font-mono text-xs">{reference.doi}</span>
                </>
              )}
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <span>{formatDate(reference.created_at)}</span>
            </div>

            {/* 인용 텍스트 */}
            {reference.citation_text && (
              <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    인용 텍스트
                  </h2>
                  <button
                    onClick={handleCopyCitation}
                    className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900"
                  >
                    {copied ? "복사됨!" : "복사"}
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-blue-900 dark:text-blue-200">
                  {reference.citation_text}
                </p>
              </section>
            )}

            {/* 편집 폼 */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                편집
              </h2>
              <ReferenceForm
                referenceId={reference.id}
                initial={{
                  title: reference.title,
                  authors: reference.authors,
                  journal: reference.journal,
                  year: reference.year,
                  doi: reference.doi,
                  citation_text: reference.citation_text,
                  memo: reference.memo,
                }}
                onSaved={fetchReference}
              />
            </section>

            {/* 삭제 */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-950"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                {deleting ? "삭제 중..." : "참고문헌 삭제"}
              </button>
            </div>

            {/* 뒤로가기 */}
            <div className="pt-4">
              <Link
                href="/references"
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
