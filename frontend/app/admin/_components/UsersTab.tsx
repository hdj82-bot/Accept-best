"use client";

import { useMemo, useState } from "react";
import { deleteAdminUser, type AdminUser, type Plan } from "@/lib/api";
import { useAdminUsers, invalidateMany } from "@/lib/hooks";
import { SkeletonTableRows } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";

const PLAN_BADGE: Record<Plan, string> = {
  free: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  basic: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  pro: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  admin: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

const PLAN_LABELS: Record<Plan, string> = {
  free: "무료",
  basic: "베이직",
  pro: "프로",
  admin: "관리자",
};

type SortKey = "email" | "plan" | "usage" | "created_at";
type SortDir = "asc" | "desc";
type PlanFilter = Plan | "all";

/**
 * 유저 탭: 검색/필터/정렬 가능한 유저 목록 + 삭제.
 */
export default function UsersTab() {
  const { data: users, error, isLoading } = useAdminUsers();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    let result = users.filter((u) => {
      if (planFilter !== "all" && u.plan !== planFilter) return false;
      if (!q) return true;
      return u.email.toLowerCase().includes(q);
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "plan":
          cmp = a.plan.localeCompare(b.plan);
          break;
        case "usage": {
          const usageA =
            a.monthly_usage.research_count +
            a.monthly_usage.survey_count +
            a.monthly_usage.summary_count;
          const usageB =
            b.monthly_usage.research_count +
            b.monthly_usage.survey_count +
            b.monthly_usage.summary_count;
          cmp = usageA - usageB;
          break;
        }
        case "created_at":
          cmp =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [users, query, planFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created_at" || key === "usage" ? "desc" : "asc");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteAdminUser(toDelete.id);
      await invalidateMany(["adminUsers", "adminStats"]);
      toast(`${toDelete.email} 삭제됨`, "success");
      setToDelete(null);
    } catch {
      toast("삭제 실패. 다시 시도해 주세요.", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        tone="error"
        title="유저 목록을 불러올 수 없습니다"
        description="권한이 있는지, 네트워크 상태를 확인해 주세요."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 검색 & 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <label htmlFor="user-search" className="sr-only">
            이메일 검색
          </label>
          <input
            id="user-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이메일로 검색…"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 pr-9 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          >
            🔍
          </span>
        </div>
        <div>
          <label htmlFor="plan-filter" className="sr-only">
            플랜 필터
          </label>
          <select
            id="plan-filter"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">모든 플랜</option>
            <option value="free">무료</option>
            <option value="basic">베이직</option>
            <option value="pro">프로</option>
            <option value="admin">관리자</option>
          </select>
        </div>
        <p
          className="ml-auto text-xs text-slate-500 dark:text-slate-400"
          aria-live="polite"
        >
          {users ? `${filtered.length.toLocaleString("ko-KR")} / ${users.length.toLocaleString("ko-KR")}명` : ""}
        </p>
      </div>

      {/* 테이블 */}
      {isLoading ? (
        <SkeletonTableRows rows={6} columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={query || planFilter !== "all" ? "검색 결과 없음" : "유저가 없습니다"}
          description={
            query || planFilter !== "all"
              ? "다른 검색어나 필터를 시도해 보세요."
              : undefined
          }
          action={
            query || planFilter !== "all"
              ? {
                  label: "필터 초기화",
                  onClick: () => {
                    setQuery("");
                    setPlanFilter("all");
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-sm" role="table" aria-label="유저 목록">
            <caption className="sr-only">
              전체 {filtered.length}명의 사용자 목록
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                <SortableTh sortKey="email" current={sortKey} dir={sortDir} onClick={toggleSort}>
                  이메일
                </SortableTh>
                <SortableTh sortKey="plan" current={sortKey} dir={sortDir} onClick={toggleSort}>
                  플랜
                </SortableTh>
                <SortableTh sortKey="usage" current={sortKey} dir={sortDir} onClick={toggleSort}>
                  월간 사용
                </SortableTh>
                <SortableTh sortKey="created_at" current={sortKey} dir={sortDir} onClick={toggleSort}>
                  가입일
                </SortableTh>
                <th className="px-4 py-3">
                  <span className="sr-only">동작</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((u) => {
                const usageTotal =
                  u.monthly_usage.research_count +
                  u.monthly_usage.survey_count +
                  u.monthly_usage.summary_count;
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PLAN_BADGE[u.plan]}`}
                      >
                        {PLAN_LABELS[u.plan]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {usageTotal.toLocaleString("ko-KR")}회
                        </span>
                        <span className="text-[11px] text-slate-400">
                          수집 {u.monthly_usage.research_count} · 설문 {u.monthly_usage.survey_count} · 요약 {u.monthly_usage.summary_count}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {new Date(u.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setToDelete(u)}
                        disabled={u.plan === "admin"}
                        aria-label={`${u.email} 삭제`}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      <Modal
        open={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        title="계정 삭제 확인"
        description="이 작업은 되돌릴 수 없습니다."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setToDelete(null)}
              disabled={deleting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
            >
              {deleting ? "삭제 중…" : "삭제"}
            </button>
          </>
        }
      >
        <p>
          <strong className="font-semibold">{toDelete?.email}</strong> 계정을
          삭제하시겠습니까?
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          해당 유저의 모든 노트, 북마크, 결제 내역이 영구 삭제됩니다.
        </p>
      </Modal>
    </div>
  );
}

function SortableTh({
  sortKey,
  current,
  dir,
  onClick,
  children,
}: {
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
  children: React.ReactNode;
}) {
  const active = current === sortKey;
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide transition hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-100"
      >
        {children}
        <span className="text-[10px]" aria-hidden="true">
          {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}
