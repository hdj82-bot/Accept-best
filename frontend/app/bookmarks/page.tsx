"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import BookmarkButton from "@/components/BookmarkButton";
import {
  getBookmarks,
  type Bookmark,
} from "@/lib/api";

export default function BookmarksPage() {
  return (
    <AuthGuard>
      <BookmarksContent />
    </AuthGuard>
  );
}

function BookmarksContent() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBookmarks()
      .then(setBookmarks)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = (paperId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.paper_id !== paperId));
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
            ← 대시보드
          </Link>
          <h1 className="text-lg font-semibold text-slate-800">내 북마크</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <span className="mb-3 text-4xl">🤍</span>
            <p className="font-semibold text-slate-600">북마크한 논문이 없습니다</p>
            <p className="mt-1 text-sm text-slate-400">
              논문 검색 결과에서 하트 아이콘을 눌러 저장하세요.
            </p>
            <Link
              href="/research"
              className="mt-5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              논문 검색하러 가기
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              총 {bookmarks.length}편의 북마크된 논문
            </p>
            <div className="space-y-4">
              {bookmarks.map((bm) => {
                const p = bm.paper;
                const score = p.similarity_score;
                const scoreColor =
                  score === null ? "text-slate-400"
                    : score >= 0.85 ? "text-emerald-600"
                    : score >= 0.70 ? "text-amber-600"
                    : "text-slate-500";

                return (
                  <div
                    key={bm.id}
                    className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    {/* Bookmark remove button */}
                    <div className="absolute right-4 top-4">
                      <BookmarkButton
                        paperId={p.id}
                        isBookmarked
                        onChange={(next) => { if (!next) handleRemove(p.id); }}
                      />
                    </div>

                    <div className="pr-10">
                      <div className="mb-1 flex items-start gap-2">
                        <h2 className="text-sm font-semibold leading-snug text-slate-800">
                          {p.title}
                        </h2>
                        {score !== null && (
                          <span className={`shrink-0 text-xs font-medium ${scoreColor}`}>
                            {(score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>

                      <p className="mb-2 text-xs text-slate-500">
                        {p.authors.slice(0, 3).join(", ")}
                        {p.authors.length > 3 ? " 외" : ""}
                        {p.year ? ` · ${p.year}` : ""}
                        {" · "}
                        <span className="capitalize">{p.source.replace("_", " ")}</span>
                      </p>

                      {p.abstract && (
                        <p className="text-xs leading-relaxed text-slate-600 line-clamp-3">
                          {p.abstract}
                        </p>
                      )}

                      <p className="mt-3 text-[10px] text-slate-400">
                        저장: {new Date(bm.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
