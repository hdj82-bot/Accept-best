"use client";

import { useMemo, useState } from "react";
import { usePaymentHistory } from "@/lib/hooks";
import { SkeletonTableRows } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import StatCard from "./StatCard";
import type { Plan } from "@/lib/api";

const PLAN_LABELS: Record<Plan, string> = {
  free: "무료",
  basic: "베이직",
  pro: "프로",
  admin: "관리자",
};

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "완료",
  failed: "실패",
  cancelled: "취소",
};

type StatusFilter = "all" | "paid" | "failed" | "cancelled";

/**
 * 결제 내역 탭.
 *
 * 참고: 백엔드 `/admin/payments` 엔드포인트가 없어 현재는 로그인한 관리자
 * 계정의 결제 내역(`/payment/history`)을 표시합니다. 전사 결제 집계가
 * 필요하면 별도의 관리자 전용 엔드포인트 추가가 필요합니다.
 */
export default function PaymentsTab() {
  const { data: payments, error, isLoading } = usePaymentHistory();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { filtered, totalPaid, totalRevenue, totalCount } = useMemo(() => {
    if (!payments)
      return { filtered: [], totalPaid: 0, totalRevenue: 0, totalCount: 0 };
    const f =
      statusFilter === "all"
        ? payments
        : payments.filter((p) => p.status === statusFilter);
    const paid = payments.filter((p) => p.status === "paid");
    return {
      filtered: f,
      totalPaid: paid.length,
      totalRevenue: paid.reduce((acc, p) => acc + p.amount, 0),
      totalCount: payments.length,
    };
  }, [payments, statusFilter]);

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        tone="error"
        title="결제 내역을 불러올 수 없습니다"
        description="백엔드 연결 또는 권한을 확인해 주세요."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 안내 */}
      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <strong className="font-semibold">알림:</strong> 현재는 관리자 본인의 결제
        내역을 표시합니다. 전사 결제 내역 조회는 백엔드
        <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 font-mono dark:bg-amber-900/60">
          /admin/payments
        </code>
        엔드포인트 추가 후 연결됩니다.
      </div>

      {/* 요약 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="총 결제 건수"
          value={totalPaid.toLocaleString("ko-KR")}
          sublabel={`전체 ${totalCount.toLocaleString("ko-KR")}건 중 완료`}
          icon="💳"
          loading={isLoading}
        />
        <StatCard
          label="누적 매출"
          value={`${totalRevenue.toLocaleString("ko-KR")}원`}
          sublabel="완료된 결제 합계"
          icon="💰"
          loading={isLoading}
        />
        <StatCard
          label="실패/취소"
          value={(totalCount - totalPaid).toLocaleString("ko-KR")}
          sublabel="미완료 결제"
          icon="⚠️"
          loading={isLoading}
        />
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="payment-status"
          className="text-xs font-medium text-slate-600 dark:text-slate-400"
        >
          상태 필터
        </label>
        <select
          id="payment-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">전체</option>
          <option value="paid">완료</option>
          <option value="failed">실패</option>
          <option value="cancelled">취소</option>
        </select>
        <p
          className="ml-auto text-xs text-slate-500 dark:text-slate-400"
          aria-live="polite"
        >
          {payments ? `${filtered.length}건 표시` : ""}
        </p>
      </div>

      {/* 테이블 */}
      {isLoading ? (
        <SkeletonTableRows rows={5} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="💳"
          title={
            totalCount === 0 ? "결제 내역이 없습니다" : "필터 결과 없음"
          }
          description={
            totalCount === 0
              ? "첫 결제가 발생하면 여기에 표시됩니다."
              : "다른 상태 필터를 시도해 보세요."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-sm" aria-label="결제 내역">
            <caption className="sr-only">
              총 {filtered.length}건의 결제 내역
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                <th className="px-4 py-3">주문번호</th>
                <th className="px-4 py-3">플랜</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">결제일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {p.merchant_uid}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {PLAN_LABELS[p.plan] ?? p.plan}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">
                    {p.amount.toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[p.status] ?? ""}`}
                    >
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {new Date(p.created_at).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
