"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSharedNote, type SharedNote, ApiError } from "@/lib/api";

// ────────────────────────────────────────────────────────────────────────────
// Paper list (read-only)
// ────────────────────────────────────────────────────────────────────────────

function PaperList({ papers }: { papers: SharedNote["papers"] }) {
  if (papers.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-slate-700 dark:text-slate-300">
        관련 논문
      </h2>
      <div className="space-y-3">
        {papers.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
              {p.title}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {p.authors.slice(0, 3).join(", ")}
              {p.authors.length > 3 ? " 외" : ""}
              {p.year ? ` · ${p.year}` : ""}
              {" · "}
              <span className="capitalize">{p.source.replace("_", " ")}</span>
            </p>
            {p.abstract && (
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
                {p.abstract}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main shared note page
// ────────────────────────────────────────────────────────────────────────────

export default function SharedNotePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<SharedNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!token) return;
    getSharedNote(token)
      .then(setData)
      .catch((err) => {
        // 404 / expired / revoked
        if (err instanceof ApiError && (err.status === 404 || err.status === 410)) {
          setInvalid(true);
        } else {
          setInvalid(true);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-blue-600">논문집필 도우미</span>
          </div>
          <Link
            href="/"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            무료로 시작하기 →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-8 w-1/2 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
            <div className="mt-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-slate-100 dark:bg-slate-700" style={{ width: `${85 - i * 5}%` }} />
              ))}
            </div>
          </div>
        )}

        {/* Invalid / expired token */}
        {!loading && invalid && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center dark:border-slate-700 dark:bg-slate-900">
            <span className="mb-4 text-5xl">🔗</span>
            <h1 className="text-xl font-bold text-slate-700 dark:text-slate-200">
              이 링크는 유효하지 않습니다
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              링크가 만료되었거나 공유가 해제되었습니다.
            </p>
            <Link
              href="/"
              className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              논문집필 도우미 시작하기
            </Link>
          </div>
        )}

        {/* Note content */}
        {!loading && data && (
          <>
            {/* Meta */}
            <div className="mb-6">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                공유된 연구 노트
                {data.owner_name && (
                  <> · <span className="font-medium">{data.owner_name}</span></>
                )}
                {" · "}
                {new Date(data.note.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>

            {/* Note body */}
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {data.note.content}
              </pre>
            </article>

            {/* Related papers */}
            <PaperList papers={data.papers} />

            {/* CTA */}
            <div className="mt-12 rounded-2xl bg-blue-50 p-6 text-center dark:bg-blue-950/30">
              <p className="font-semibold text-blue-800 dark:text-blue-300">
                논문집필 도우미로 더 스마트하게 연구하세요
              </p>
              <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                AI 기반 논문 수집, 설문 생성, 버전 관리를 무료로 시작하세요.
              </p>
              <Link
                href="/"
                className="mt-4 inline-block rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                무료로 시작하기 →
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
