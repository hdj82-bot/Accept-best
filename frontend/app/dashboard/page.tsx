"use client";

import dynamic from "next/dynamic";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import UsageIndicator from "@/components/UsageIndicator";
import EmptyState from "@/components/EmptyState";
import { SkeletonText, SkeletonCard } from "@/components/Skeleton";
import { useUser, useNotes, useSearchHistory } from "@/lib/hooks";

// 신규 유저 전용 — 번들 사이즈 최적화를 위해 dynamic import
const Onboarding = dynamic(() => import("@/components/Onboarding"), {
  ssr: false,
});

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: user } = useUser();
  const { data: allNotes, isLoading: notesLoading, error: notesError } = useNotes();
  const { data: allHistory } = useSearchHistory();

  const notes = (allNotes ?? []).slice(0, 5);
  const searchHistory = (allHistory ?? []).slice(0, 3);

  return (
    <>
      <Onboarding auto />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              논문집필 도우미
            </h1>
            <div className="flex items-center gap-3">
              {user?.plan === "free" && (
                <Link
                  href="/billing"
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  플랜 업그레이드 ↑
                </Link>
              )}
              {user?.plan === "admin" && (
                <Link
                  href="/admin"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  관리자 ⚙
                </Link>
              )}
              <span
                className="hidden text-sm text-slate-600 sm:inline dark:text-slate-300"
                aria-label={`로그인 계정: ${session?.user?.email ?? ""}`}
              >
                {session?.user?.email}
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* ── Left column ── */}
            <div className="space-y-8 lg:col-span-2">
              {/* Greeting */}
              <div>
                {session ? (
                  <>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      안녕하세요, {session?.user?.name ?? "연구자"}님
                    </h2>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      오늘도 좋은 연구 되세요.
                    </p>
                  </>
                ) : (
                  <SkeletonText lines={2} className="max-w-md" />
                )}
              </div>

              {/* New research CTA */}
              <button
                type="button"
                onClick={() => router.push("/research")}
                className="flex w-full items-center justify-between rounded-2xl bg-blue-600 px-6 py-5 text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                aria-label="새 연구 시작하기 — 연구 페이지로 이동"
              >
                <div className="text-left">
                  <p className="text-lg font-semibold">새 연구 시작</p>
                  <p className="mt-0.5 text-sm text-blue-100">
                    키워드로 논문을 수집하고 노트를 작성하세요
                  </p>
                </div>
                <span className="text-3xl" aria-hidden="true">→</span>
              </button>

              {/* Recent notes */}
              <section aria-labelledby="recent-notes-heading">
                <div className="mb-3 flex items-center justify-between">
                  <h3
                    id="recent-notes-heading"
                    className="font-semibold text-slate-800 dark:text-slate-200"
                  >
                    최근 연구 노트
                  </h3>
                  <Link
                    href="/research"
                    className="text-xs text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400"
                  >
                    전체 보기
                  </Link>
                </div>

                {notesLoading ? (
                  <div className="space-y-3">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </div>
                ) : notesError ? (
                  <EmptyState
                    icon="⚠️"
                    tone="error"
                    title="노트를 불러오지 못했습니다"
                    description="네트워크를 확인하고 다시 시도해 주세요."
                  />
                ) : notes.length === 0 ? (
                  <EmptyState
                    icon="📝"
                    title="아직 작성한 노트가 없습니다"
                    description="첫 연구 노트를 만들어 보세요."
                    action={{ label: "새 노트 만들기", href: "/research" }}
                  />
                ) : (
                  <ul className="space-y-3" aria-label="최근 연구 노트 목록">
                    {notes.map((note) => (
                      <li key={note.id}>
                        <Link
                          href={`/research/${note.id}`}
                          className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500"
                        >
                          <p className="line-clamp-2 text-sm text-slate-800 dark:text-slate-200">
                            {note.content || "(빈 노트)"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {new Date(note.created_at).toLocaleDateString(
                              "ko-KR",
                            )}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* ── Right column ── */}
            <aside className="space-y-6" aria-label="사이드바">
              <UsageIndicator plan={user?.plan ?? "free"} />

              {/* Recent searches widget */}
              <section
                aria-labelledby="recent-searches-heading"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3
                    id="recent-searches-heading"
                    className="text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    최근 검색어
                  </h3>
                  <Link
                    href="/research"
                    className="text-xs text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400"
                  >
                    더보기
                  </Link>
                </div>
                {searchHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    검색 기록이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {searchHistory.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/research?q=${encodeURIComponent(item.query)}`,
                            )
                          }
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <span
                            className="text-xs text-slate-400"
                            aria-hidden="true"
                          >
                            🕐
                          </span>
                          <span className="truncate">{item.query}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Quick links */}
              <section
                aria-labelledby="quicklinks-heading"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <h3
                  id="quicklinks-heading"
                  className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  바로가기
                </h3>
                <nav aria-label="바로가기">
                  <ul className="space-y-1">
                    {QUICK_LINKS.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <span aria-hidden="true">{link.icon}</span>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

const QUICK_LINKS = [
  { href: "/research",     icon: "📄", label: "논문 수집 · 노트" },
  { href: "/bookmarks",    icon: "🤍", label: "내 북마크" },
  { href: "/collections",  icon: "📁", label: "컬렉션 · 태그" },
  { href: "/survey",       icon: "❓", label: "설문문항 생성" },
  { href: "/checkup",      icon: "🔍", label: "논문 건강검진" },
  { href: "/versions",     icon: "📝", label: "버전 기록" },
  { href: "/refs",         icon: "📚", label: "참고문헌 관리" },
  { href: "/gap-analysis", icon: "🔬", label: "연구 공백 발견" },
  { href: "/settings",     icon: "⚙️", label: "계정 설정" },
];
