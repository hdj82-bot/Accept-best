"use client";

import { useAdminStats, useAdminUsers } from "@/lib/hooks";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import StatCard from "./StatCard";
import type { Plan } from "@/lib/api";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-400",
  basic: "bg-blue-500",
  pro: "bg-violet-500",
  admin: "bg-rose-500",
};

const PLAN_LABELS: Record<string, string> = {
  free: "무료",
  basic: "베이직",
  pro: "프로",
  admin: "관리자",
};

/**
 * 개요 탭: KPI 카드 + 플랜 분포 + 7일 사용량 차트.
 */
export default function OverviewTab() {
  const { data: stats, error: statsError, isLoading: statsLoading } = useAdminStats();
  const { data: users } = useAdminUsers();

  const totalUsage = stats?.daily_usage?.reduce((acc, d) => acc + d.count, 0) ?? 0;
  const avgDaily = stats?.daily_usage?.length
    ? Math.round(totalUsage / stats.daily_usage.length)
    : 0;

  // 신규 가입자 (최근 7일)
  const newThisWeek = users
    ? users.filter((u) => {
        const created = new Date(u.created_at).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return created >= sevenDaysAgo;
      }).length
    : 0;

  const activeUsers = users
    ? users.filter(
        (u) =>
          u.monthly_usage.research_count +
            u.monthly_usage.survey_count +
            u.monthly_usage.summary_count >
          0,
      ).length
    : 0;

  if (statsError) {
    return (
      <EmptyState
        icon="⚠️"
        tone="error"
        title="통계를 불러올 수 없습니다"
        description="잠시 후 다시 시도해 주세요."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="총 가입자"
          value={stats?.total_users?.toLocaleString("ko-KR") ?? 0}
          sublabel="전체"
          icon="👥"
          loading={statsLoading}
        />
        <StatCard
          label="활성 사용자"
          value={activeUsers.toLocaleString("ko-KR")}
          sublabel="이번 달 API 호출 1회 이상"
          icon="✨"
          loading={!users}
        />
        <StatCard
          label="신규 가입 (7일)"
          value={newThisWeek.toLocaleString("ko-KR")}
          sublabel="최근 일주일"
          icon="🆕"
          loading={!users}
        />
        <StatCard
          label="일평균 API 호출"
          value={avgDaily.toLocaleString("ko-KR")}
          sublabel={`7일 총 ${totalUsage.toLocaleString("ko-KR")}회`}
          icon="📡"
          loading={statsLoading}
        />
      </div>

      {/* 플랜 분포 + 7일 사용량 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="plan-dist-heading"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <h3
            id="plan-dist-heading"
            className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            플랜 분포
          </h3>
          {statsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height={24} />
              ))}
            </div>
          ) : stats && stats.total_users > 0 ? (
            <PlanDistribution
              dist={stats.plan_distribution}
              total={stats.total_users}
            />
          ) : (
            <EmptyState
              icon="📊"
              title="데이터가 없습니다"
              description="가입자가 생기면 여기에 표시됩니다."
            />
          )}
        </section>

        <section
          aria-labelledby="daily-usage-heading"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <h3
            id="daily-usage-heading"
            className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            최근 7일 API 사용량
          </h3>
          {statsLoading ? (
            <Skeleton height={140} />
          ) : stats && stats.daily_usage.length > 0 ? (
            <BarChart data={stats.daily_usage} />
          ) : (
            <EmptyState
              icon="📈"
              title="사용량 데이터 없음"
              description="API 호출이 기록되면 여기에 표시됩니다."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function PlanDistribution({
  dist,
  total,
}: {
  dist: Record<string, number>;
  total: number;
}) {
  const entries = Object.entries(dist) as Array<[Plan, number]>;
  return (
    <div className="space-y-3" role="list">
      {entries.map(([plan, count]) => {
        const pct = total ? Math.round((count / total) * 100) : 0;
        const label = PLAN_LABELS[plan] ?? plan;
        return (
          <div key={plan} role="listitem">
            <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="font-medium">{label}</span>
              <span aria-label={`${label} 플랜: ${count}명, ${pct}퍼센트`}>
                {count}명 ({pct}%)
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label} 플랜 비율`}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  PLAN_COLORS[plan] ?? "bg-slate-300"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div
      className="flex h-32 items-end gap-1.5"
      role="img"
      aria-label={`최근 ${data.length}일 API 사용량 막대그래프`}
    >
      {data.map((d) => {
        const pct = Math.round((d.count / max) * 100);
        return (
          <div
            key={d.date}
            className="group flex flex-1 flex-col items-center gap-1"
            title={`${d.date}: ${d.count}회`}
          >
            <span className="text-[10px] text-slate-400">{d.count}</span>
            <div
              className="w-full rounded-t bg-blue-400 transition-all group-hover:bg-blue-500"
              style={{ height: `${pct}%`, minHeight: "2px" }}
            />
            <span className="text-[9px] text-slate-400">{d.date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}
