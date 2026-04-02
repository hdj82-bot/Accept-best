"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUsage, type MonthlyUsage, type Plan, PLAN_LIMITS } from "@/lib/api";

interface UsageIndicatorProps {
  plan: Plan;
}

interface BarProps {
  label: string;
  used: number;
  limit: number;
}

function UsageBar({ label, used, limit }: BarProps) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min((used / limit) * 100, 100);
  const exhausted = !unlimited && used >= limit;

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className={exhausted ? "font-semibold text-red-600" : ""}>
          {unlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              exhausted ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Displays this month's usage vs plan limits.
 * Shows an upgrade banner when any free-plan quota is exhausted.
 *
 * Props:
 *   plan — current user plan ("free" | "basic" | "pro")
 */
export default function UsageIndicator({ plan }: UsageIndicatorProps) {
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getUsage()
      .then(setUsage)
      .catch(() => setError(true));
  }, []);

  const limits = PLAN_LIMITS[plan];
  const isFreePlanExhausted =
    plan === "free" &&
    usage !== null &&
    (usage.research_count >= limits.research ||
      usage.survey_count >= limits.survey ||
      usage.summary_count >= limits.summary);

  if (error) return null; // fail silently — don't block the page

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">이번 달 사용량</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            plan === "pro"
              ? "bg-violet-100 text-violet-700"
              : plan === "basic"
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {plan === "free" ? "무료" : plan === "basic" ? "Basic" : "Pro"}
        </span>
      </div>

      {usage ? (
        <div className="space-y-2.5">
          <UsageBar label="논문 수집" used={usage.research_count} limit={limits.research} />
          <UsageBar label="설문 생성" used={usage.survey_count}   limit={limits.survey} />
          <UsageBar label="AI 요약"   used={usage.summary_count}  limit={limits.summary} />
        </div>
      ) : (
        // Loading skeleton
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      )}

      {isFreePlanExhausted && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-800">이번 달 무료 한도를 소진했습니다.</p>
          <p className="mt-0.5 text-amber-700">
            더 많은 기능을 사용하려면 플랜을 업그레이드하세요.
          </p>
          <Link
            href="/pricing"
            className="mt-2 inline-block rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
          >
            플랜 업그레이드 →
          </Link>
        </div>
      )}
    </div>
  );
}
