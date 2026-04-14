"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import ReferenceForm from "@/components/ReferenceForm";
import ReferenceList from "@/components/ReferenceList";
import { extractReferences, ApiError } from "@/lib/api";

export default function ReferencesPage() {
  const { data: session } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);

  // 자동 추출
  const [extractPaperId, setExtractPaperId] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = extractPaperId.trim();
    if (!trimmed) return;

    const token = (session as any)?.accessToken as string | undefined;
    if (!token) {
      setExtractError("로그인이 필요합니다.");
      return;
    }

    setExtracting(true);
    setExtractError(null);
    setExtractMessage(null);

    try {
      const result = await extractReferences(trimmed, token);
      setExtractMessage(result.message);
      setExtractPaperId("");
    } catch (err) {
      if (err instanceof ApiError) {
        setExtractError(err.message);
      } else {
        setExtractError("참고문헌 추출 중 오류가 발생했습니다.");
      }
    } finally {
      setExtracting(false);
    }
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
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            참고문헌 관리
          </span>
        </div>
        <UserMenu />
      </header>

      {/* 메인 */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
        {/* 액션 버튼 영역 */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {showForm ? "폼 닫기" : "수동 추가"}
          </button>
        </div>

        {/* 수동 추가 폼 */}
        {showForm && (
          <ReferenceForm onSaved={() => setRefreshKey((k) => k + 1)} />
        )}

        {/* 자동 추출 */}
        <div className="flex flex-col gap-3">
          <form onSubmit={handleExtract} className="flex w-full gap-3">
            <input
              type="text"
              value={extractPaperId}
              onChange={(e) => setExtractPaperId(e.target.value)}
              placeholder="논문 ID를 입력하여 참고문헌 자동 추출"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
            />
            <button
              type="submit"
              disabled={extracting || !extractPaperId.trim()}
              className="shrink-0 rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {extracting ? "추출 중..." : "자동 추출"}
            </button>
          </form>

          {extractMessage && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
              {extractMessage}
            </div>
          )}

          {extractError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              {extractError}
            </div>
          )}
        </div>

        {/* 목록 */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
            </div>
          }
        >
          <ReferenceList refreshKey={refreshKey} />
        </Suspense>
      </main>
    </div>
  );
}
