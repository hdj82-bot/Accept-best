"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/hooks";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

// 코드 스플리팅: 무거운 탭 컨텐츠는 필요할 때만 로드
const OverviewTab = dynamic(() => import("./_components/OverviewTab"), {
  loading: () => <TabLoading />,
});
const UsersTab = dynamic(() => import("./_components/UsersTab"), {
  loading: () => <TabLoading />,
});
const UsageTab = dynamic(() => import("./_components/UsageTab"), {
  loading: () => <TabLoading />,
});
const PaymentsTab = dynamic(() => import("./_components/PaymentsTab"), {
  loading: () => <TabLoading />,
});

function TabLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton height={120} />
      <Skeleton height={200} />
    </div>
  );
}

// ── Admin guard ────────────────────────────────────────────────────────────

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const { data: user, error, isLoading } = useUser();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
      return;
    }
    if (user && user.plan !== "admin") {
      router.replace("/dashboard");
    }
  }, [status, user, router]);

  if (status === "loading" || isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
          aria-hidden="true"
        />
        <span className="sr-only">권한 확인 중</span>
      </div>
    );
  }

  if (error || !user) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <EmptyState
          icon="🚫"
          tone="error"
          title="접근이 제한되었습니다"
          description="세션이 만료되었거나 권한이 없습니다."
          action={{ label: "로그인으로", href: "/" }}
        />
      </main>
    );
  }

  if (user.plan !== "admin") {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <EmptyState
          icon="🔒"
          title="관리자 전용 페이지"
          description="이 페이지는 관리자만 접근할 수 있습니다."
          action={{ label: "대시보드로", href: "/dashboard" }}
        />
      </main>
    );
  }

  return <>{children}</>;
}

// ── Admin 메인 ─────────────────────────────────────────────────────────────

type Tab = "overview" | "users" | "usage" | "payments";

const TABS: Array<{ id: Tab; label: string; icon: string; desc: string }> = [
  { id: "overview", label: "개요", icon: "📊", desc: "KPI 및 플랜 분포" },
  { id: "users", label: "유저", icon: "👥", desc: "검색/관리" },
  { id: "usage", label: "사용량", icon: "📡", desc: "API 호출 추적" },
  { id: "payments", label: "결제", icon: "💳", desc: "결제 내역" },
];

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}

function AdminContent() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-slate-500 transition hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← 대시보드
            </Link>
            <span className="text-slate-300" aria-hidden="true">
              /
            </span>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              관리자 대시보드
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* 탭 네비게이션 */}
        <nav
          aria-label="관리자 섹션"
          role="tablist"
          className="mb-6 flex flex-wrap gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        >
          {TABS.map(({ id, label, icon, desc }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={active}
                aria-controls={`panel-${id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const idx = TABS.findIndex((t) => t.id === id);
                    const next =
                      e.key === "ArrowRight"
                        ? (idx + 1) % TABS.length
                        : (idx - 1 + TABS.length) % TABS.length;
                    setTab(TABS[next].id);
                    const btn = document.getElementById(`tab-${TABS[next].id}`);
                    btn?.focus();
                  }
                }}
                className={`flex min-w-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <span aria-hidden="true">{icon}</span>
                <span className="flex flex-col items-start leading-tight">
                  <span>{label}</span>
                  <span
                    className={`text-[10px] ${
                      active ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {desc}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* 탭 패널 */}
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          tabIndex={0}
          className="focus:outline-none"
        >
          {tab === "overview" && <OverviewTab />}
          {tab === "users" && <UsersTab />}
          {tab === "usage" && <UsageTab />}
          {tab === "payments" && <PaymentsTab />}
        </div>
      </div>
    </main>
  );
}
