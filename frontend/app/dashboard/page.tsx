"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import UsageIndicator from "@/components/UsageIndicator";
import { useUser, useNotes, useSearchHistory } from "@/lib/hooks";

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
  const { data: allNotes, isLoading: notesLoading } = useNotes();
  const { data: allHistory } = useSearchHistory();

  const notes = (allNotes ?? []).slice(0, 5);
  const searchHistory = (allHistory ?? []).slice(0, 3);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800">논문집필 도우미</h1>
          <div className="flex items-center gap-3">
            {user?.plan === "free" && (
              <Link
                href="/billing"
                className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                플랜 업그레이드 ↑
              </Link>
            )}
            <span className="text-sm text-slate-600">{session?.user?.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-8">
            {/* Greeting */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800">
                안녕하세요, {session?.user?.name ?? "연구자"}님
              </h2>
              <p className="mt-1 text-slate-500">오늘도 좋은 연구 되세요.</p>
            </div>

            {/* New research CTA */}
            <button
              onClick={() => router.push("/research")}
              className="flex w-full items-center justify-between rounded-2xl bg-blue-600 px-6 py-5 text-white shadow-md transition hover:bg-blue-700"
            >
              <div>
                <p className="font-semibold text-lg">새 연구 시작</p>
                <p className="mt-0.5 text-sm text-blue-100">
                  키워드로 논문을 수집하고 노트를 작성하세요
                </p>
              </div>
              <span className="text-3xl">→</span>
            </button>

            {/* Recent notes */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">최근 연구 노트</h3>
                <Link
                  href="/research"
                  className="text-xs text-blue-600 hover:underline"
                >
                  전체 보기
                </Link>
              </div>

              {notesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-xl bg-slate-100"
                    />
                  ))}
                </div>
              ) : notes.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-400">
                  아직 작성한 노트가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <Link
                      key={note.id}
                      href={`/research/${note.id}`}
                      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300"
                    >
                      <p className="text-sm text-slate-800 line-clamp-2">
                        {note.content || "(빈 노트)"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(note.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-6">
            <UsageIndicator plan={user?.plan ?? "free"} />

            {/* Recent searches widget */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">최근 검색어</p>
                <Link
                  href="/research"
                  className="text-xs text-blue-600 hover:underline"
                >
                  더보기
                </Link>
              </div>
              {searchHistory.length === 0 ? (
                <p className="text-xs text-slate-400">검색 기록이 없습니다.</p>
              ) : (
                <div className="space-y-1">
                  {searchHistory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() =>
                        router.push(
                          `/research?q=${encodeURIComponent(item.query)}`,
                        )
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      <span className="text-slate-400 text-xs">🕐</span>
                      <span className="truncate">{item.query}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-medium text-slate-700">바로가기</p>
              <nav className="space-y-1">
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                  >
                    <span>{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

const QUICK_LINKS = [
  { href: "/research",    icon: "📄", label: "논문 수집 · 노트" },
  { href: "/bookmarks",   icon: "🤍", label: "내 북마크" },
  { href: "/collections", icon: "📁", label: "컬렉션 · 태그" },
  { href: "/survey",      icon: "❓", label: "설문문항 생성" },
  { href: "/checkup",     icon: "🔍", label: "논문 건강검진" },
  { href: "/versions",    icon: "📝", label: "버전 기록" },
  { href: "/refs",         icon: "📚", label: "참고문헌 관리" },
  { href: "/gap-analysis", icon: "🔬", label: "연구 공백 발견" },
  { href: "/settings",    icon: "⚙️",  label: "계정 설정" },
];
