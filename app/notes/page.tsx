"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import NoteEditor from "@/components/NoteEditor";
import NoteList from "@/components/NoteList";

export default function NotesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

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
            연구 노트
          </span>
        </div>
        <UserMenu />
      </header>

      {/* 메인 */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
        <NoteEditor onSaved={() => setRefreshKey((k) => k + 1)} />
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
            </div>
          }
        >
          <NoteList refreshKey={refreshKey} />
        </Suspense>
      </main>
    </div>
  );
}
