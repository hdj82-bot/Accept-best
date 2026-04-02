"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getMe,
  getAdminStats,
  getAdminUsers,
  deleteAdminUser,
  type AdminStats,
  type AdminUser,
  type Plan,
} from "@/lib/api";

// ────────────────────────────────────────────────────────────────────────────
// Admin guard — plan must be "admin"
// ────────────────────────────────────────────────────────────────────────────

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/"); return; }
    if (status === "authenticated") {
      getMe()
        .then((u) => {
          if (u.plan === "admin") setAllowed(true);
          else router.replace("/dashboard");
        })
        .catch(() => router.replace("/dashboard"));
    }
  }, [status, router]);

  if (status === "loading" || allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}

// ────────────────────────────────────────────────────────────────────────────
// Mini bar chart (7-day usage)
// ────────────────────────────────────────────────────────────────────────────

function BarChart({ data }: { data: AdminStats["daily_usage"] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-28 items-end gap-1.5">
      {data.map((d) => {
        const pct = Math.round((d.count / max) * 100);
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-slate-400">{d.count}</span>
            <div
              className="w-full rounded-t bg-blue-400 transition-all"
              style={{ height: `${pct}%`, minHeight: "2px" }}
            />
            <span className="text-[9px] text-slate-400">
              {d.date.slice(5)} {/* MM-DD */}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Plan distribution (horizontal bars)
// ────────────────────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  free:  "bg-slate-400",
  basic: "bg-blue-500",
  pro:   "bg-violet-500",
  admin: "bg-rose-500",
};

function PlanDistribution({ dist, total }: { dist: Record<string, number>; total: number }) {
  return (
    <div className="space-y-2">
      {Object.entries(dist).map(([plan, count]) => {
        const pct = total ? Math.round((count / total) * 100) : 0;
        return (
          <div key={plan}>
            <div className="mb-1 flex justify-between text-xs text-slate-600">
              <span className="capitalize font-medium">{plan}</span>
              <span>{count}명 ({pct}%)</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${PLAN_COLORS[plan] ?? "bg-slate-300"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stats tab
// ────────────────────────────────────────────────────────────────────────────

function StatsTab({ stats }: { stats: AdminStats | null }) {
  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">총 가입자</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">
            {stats.total_users.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs text-slate-500">플랜 분포</p>
          <PlanDistribution dist={stats.plan_distribution} total={stats.total_users} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs text-slate-500">최근 7일 API 사용량</p>
          <BarChart data={stats.daily_usage} />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Users tab
// ────────────────────────────────────────────────────────────────────────────

const PLAN_BADGE: Record<Plan, string> = {
  free:  "bg-slate-100 text-slate-600",
  basic: "bg-blue-100 text-blue-700",
  pro:   "bg-violet-100 text-violet-700",
  admin: "bg-rose-100 text-rose-700",
};

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    getAdminUsers()
      .then(setUsers)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`${email} 계정을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`)) return;
    setDeleting(id);
    try {
      await deleteAdminUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
            <th className="px-4 py-3">이메일</th>
            <th className="px-4 py-3">플랜</th>
            <th className="px-4 py-3">수집</th>
            <th className="px-4 py-3">설문</th>
            <th className="px-4 py-3">요약</th>
            <th className="px-4 py-3">가입일</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{u.email}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PLAN_BADGE[u.plan]}`}>
                  {u.plan}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">{u.monthly_usage.research_count}</td>
              <td className="px-4 py-3 text-slate-600">{u.monthly_usage.survey_count}</td>
              <td className="px-4 py-3 text-slate-600">{u.monthly_usage.summary_count}</td>
              <td className="px-4 py-3 text-slate-500">
                {new Date(u.created_at).toLocaleDateString("ko-KR")}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleDelete(u.id, u.email)}
                  disabled={deleting === u.id}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {deleting === u.id ? "…" : "삭제"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">유저가 없습니다.</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Admin page
// ────────────────────────────────────────────────────────────────────────────

type Tab = "stats" | "users";

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}

function AdminContent() {
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    getAdminStats().then(setStats).catch(() => null);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
              ← 대시보드
            </Link>
            <h1 className="text-lg font-semibold text-slate-800">관리자</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
          {(
            [
              { id: "stats", label: "통계" },
              { id: "users", label: "유저" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition ${
                tab === id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        {tab === "stats" && <StatsTab stats={stats} />}
        {tab === "users" && <UsersTab />}
      </div>
    </main>
  );
}
