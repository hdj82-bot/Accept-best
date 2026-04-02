"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
      <p className="text-5xl">⚠️</p>
      <h1 className="mt-4 text-xl font-bold text-slate-700 dark:text-slate-200">
        오류가 발생했습니다
      </h1>
      {error.message && (
        <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {error.message}
        </p>
      )}
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          다시 시도
        </button>
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          대시보드로 이동
        </Link>
      </div>
    </main>
  );
}
