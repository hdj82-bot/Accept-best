"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import VersionList from "@/components/VersionList";
import { saveVersion, ApiError } from "@/lib/api";

export default function VersionsPage() {
  const { data: session } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleManualSave() {
    const token = session?.accessToken;
    if (!token) {
      setError("로그인이 필요합니다.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await saveVersion({}, "manual", token);
      setMessage("수동 버전이 저장되었습니다.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("버전 저장 중 오류가 발생했습니다.");
      }
    } finally {
      setSaving(false);
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
            논문 버전관리
          </span>
        </div>
        <UserMenu />
      </header>

      {/* 메인 */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
        {/* 수동 저장 버튼 */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <button
              onClick={handleManualSave}
              disabled={saving}
              className="shrink-0 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "저장 중..." : "수동 버전 저장"}
            </button>
          </div>

          {message && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
            </div>
          }
        >
          <VersionList refreshKey={refreshKey} />
        </Suspense>
      </main>
    </div>
  );
}
