"use client";

import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import BookmarkButton from "@/components/BookmarkButton";
import EmptyState from "@/components/EmptyState";
import { SkeletonCard } from "@/components/Skeleton";
import { useBookmarks, invalidate } from "@/lib/hooks";

export default function BookmarksPage() {
  return (
    <AuthGuard>
      <BookmarksContent />
    </AuthGuard>
  );
}

function BookmarksContent() {
  const { data: bookmarks, isLoading, error } = useBookmarks();

  const handleRemove = () => {
    invalidate("bookmarks");
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ← 대시보드
          </Link>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            내 북마크
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {isLoading ? (
          <div className="space-y-4" role="status" aria-busy="true">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <EmptyState
            icon="⚠️"
            tone="error"
            title="북마크를 불러올 수 없습니다"
            description="네트워크를 확인하고 다시 시도해 주세요."
          />
        ) : !bookmarks || bookmarks.length === 0 ? (
          <EmptyState
            icon="🤍"
            title="북마크한 논문이 없습니다"
            description="논문 검색 결과에서 하트 아이콘을 눌러 저장하세요."
            action={{ label: "논문 검색하러 가기", href: "/research" }}
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
              총 {bookmarks.length}편의 북마크된 논문
            </p>
            <ul className="space-y-4" aria-label="북마크 목록">
              {bookmarks.map((bm) => {
                const p = bm.paper;
                const score = p.similarity_score;
                const scoreColor =
                  score === null
                    ? "text-slate-400"
                    : score >= 0.85
                      ? "text-emerald-600"
                      : score >= 0.7
                        ? "text-amber-600"
                        : "text-slate-500";

                return (
                  <li
                    key={bm.id}
                    className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="absolute right-4 top-4">
                      <BookmarkButton
                        paperId={p.id}
                        isBookmarked
                        onChange={(next) => {
                          if (!next) handleRemove();
                        }}
                      />
                    </div>

                    <div className="pr-10">
                      <div className="mb-1 flex items-start gap-2">
                        <h2 className="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
                          {p.title}
                        </h2>
                        {score !== null && (
                          <span
                            className={`shrink-0 text-xs font-medium ${scoreColor}`}
                            aria-label={`유사도 ${(score * 100).toFixed(0)}%`}
                          >
                            {(score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>

                      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                        {p.authors.slice(0, 3).join(", ")}
                        {p.authors.length > 3 ? " 외" : ""}
                        {p.year ? ` · ${p.year}` : ""}
                        {" · "}
                        <span className="capitalize">{p.source.replace("_", " ")}</span>
                      </p>

                      {p.abstract && (
                        <p className="text-xs leading-relaxed text-slate-600 line-clamp-3 dark:text-slate-300">
                          {p.abstract}
                        </p>
                      )}

                      <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
                        저장: {new Date(bm.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
