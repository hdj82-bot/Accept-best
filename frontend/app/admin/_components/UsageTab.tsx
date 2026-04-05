"use client";

import { useMemo, useState } from "react";
import { useAdminStats, useAdminUsers } from "@/lib/hooks";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import StatCard from "./StatCard";

type UsageKind = "research" | "survey" | "summary" | "total";

const KIND_LABELS: Record<UsageKind, string> = {
  research: "논문 수집",
  survey: "설문 생성",
  summary: "요약",
  total: "전체",
};

/**
 * API 사용량 모니터링 탭.
 * - 최근 7일 일별 사용량 (전체)
 * - 유저별 월간 사용량 랭킹 (Top 10)
 * - 카테고리별 필터링 (수집/설문/요약/전체)
 */
export default function UsageTab() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useAdminStats();
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const [kind, setKind] = useState<UsageKind>("total");

  const ranking = useMemo(() => {
    if (!users) return [];
    return [...users]
      .map((u) => {
        const counts = u.monthly_usage;
        const total =
          counts.research_count + counts.survey_count + counts.summary_count;
        const v =
          kind === "total"
            ? total
            : kind === "research"
              ? counts.research_count
              : kind === "survey"
                ? counts.survey_count
                : counts.summary_count;
        return { ...u, usage_value: v, usage_total: total };
      })
      .filter((u) => u.usage_value > 0)
      .sort((a, b) => b.usage_value - a.usage_value)
      .slice(0, 10);
  }, [users, kind]);

  const totalCalls =
    stats?.daily_usage?.reduce((acc, d) => acc + d.count, 0) ?? 0;
  const peakDay =
    stats?.daily_usage?.reduce(
      (acc, d) => (d.count > acc.count ? d : acc),
      { date: "", count: 0 },
    );

  const totalResearchCalls =
    users?.reduce((a, u) => a + u.monthly_usage.research_count, 0) ?? 0;
  const totalSurveyCalls =
    users?.reduce((a, u) => a + u.monthly_usage.survey_count, 0) ?? 0;
  const totalSummaryCalls =
    users?.reduce((a, u) => a + u.monthly_usage.summary_count, 0) ?? 0;
  const monthlyGrand = totalResearchCalls + totalSurveyCalls + totalSummaryCalls;

  if (statsError) {
    return (
      <EmptyState
        icon="⚠️"
        tone="error"
        title="사용량 통계를 불러올 수 없습니다"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="7일 총 호출"
          value={totalCalls.toLocaleString("ko-KR")}
          sublabel="모든 API 합계"
          icon="📡"
          loading={statsLoading}
        />
        <StatCard
          label="피크 사용일"
          value={peakDay?.count ? peakDay.count.toLocaleString("ko-KR") : "-"}
          sublabel={peakDay?.date || ""}
          icon="📈"
          loading={statsLoading}
        />
        <StatCard
          label="이번 달 총 호출"
          value={monthlyGrand.toLocaleString("ko-KR")}
          sublabel="전 유저 합계"
          icon="🔢"
          loading={usersLoading}
        />
        <StatCard
          label="활성 유저 수"
          value={(ranking.length > 0
            ? users?.filter(
                (u) =>
                  u.monthly_usage.research_count +
                    u.monthly_usage.survey_count +
                    u.monthly_usage.summary_count >
                  0,
              ).length ?? 0
            : 0
          ).toLocaleString("ko-KR")}
          sublabel="이번 달 1회 이상 호출"
          icon="👤"
          loading={usersLoading}
        />
      </div>

      {/* 카테고리별 사용량 */}
      <section
        aria-labelledby="category-usage-heading"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <h3
          id="category-usage-heading"
          className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          카테고리별 호출 분포 (이번 달)
        </h3>
        {usersLoading ? (
          <Skeleton height={80} />
        ) : (
          <div className="space-y-3">
            {(
              [
                { label: "논문 수집", value: totalResearchCalls, color: "bg-blue-500" },
                { label: "설문 생성", value: totalSurveyCalls, color: "bg-violet-500" },
                { label: "요약", value: totalSummaryCalls, color: "bg-emerald-500" },
              ] as const
            ).map(({ label, value, color }) => {
              const pct = monthlyGrand
                ? Math.round((value / monthlyGrand) * 100)
                : 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-medium">{label}</span>
                    <span>
                      {value.toLocaleString("ko-KR")}회 ({pct}%)
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${label} 비율`}
                    className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  >
                    <div
                      className={`h-full ${color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Top 유저 랭킹 */}
      <section
        aria-labelledby="top-users-heading"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3
            id="top-users-heading"
            className="text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            Top 10 사용자 (이번 달)
          </h3>
          <div role="radiogroup" aria-label="사용량 카테고리" className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(Object.keys(KIND_LABELS) as UsageKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  kind === k
                    ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>

        {usersLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={40} />
            ))}
          </div>
        ) : ranking.length === 0 ? (
          <EmptyState
            icon="📊"
            title="사용 내역이 없습니다"
            description="이번 달에 아직 API 호출이 없습니다."
          />
        ) : (
          <ol className="space-y-2" aria-label="사용량 랭킹">
            {ranking.map((u, i) => {
              const topMax = ranking[0].usage_value || 1;
              const pct = Math.round((u.usage_value / topMax) * 100);
              return (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    aria-label={`${i + 1}위`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {u.email}
                    </p>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {u.usage_value.toLocaleString("ko-KR")}회
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
