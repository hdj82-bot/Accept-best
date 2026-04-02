"use client";

import { useEffect, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { getMe, updateMe, cancelPlan, type User } from "@/lib/api";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Toast
// ────────────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3_500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${
        type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {message}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Plan label helpers
// ────────────────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: "무료",
  basic: "Basic",
  pro: "Pro",
  admin: "관리자",
};

// ────────────────────────────────────────────────────────────────────────────
// Main content
// ────────────────────────────────────────────────────────────────────────────

function SettingsContent() {
  const [user, setUser] = useState<User | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") =>
      setToast({ message, type }),
    []
  );

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setNameInput(u.name ?? "");
      })
      .catch(() => null);
  }, []);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setSavingName(true);
    try {
      const updated = await updateMe({ name: nameInput.trim() });
      setUser(updated);
      showToast("이름이 저장되었습니다.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "저장 실패", "error");
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelPlan = async () => {
    if (
      !confirm(
        "구독을 해지하시겠습니까? 만료일까지는 계속 이용 가능합니다."
      )
    )
      return;
    setCancelling(true);
    try {
      await cancelPlan();
      setUser((u) => (u ? { ...u, plan: "free", plan_expires_at: null } : u));
      showToast("구독이 해지되었습니다.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "해지 실패", "error");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ← 대시보드
          </Link>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            계정 설정
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 py-8 space-y-6">
        {/* ── Section 1: Profile ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
            프로필
          </h2>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                이름
              </label>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="이름을 입력하세요"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                이메일
              </label>
              <input
                value={user?.email ?? ""}
                readOnly
                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingName || !nameInput.trim()}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {savingName ? "저장 중…" : "저장"}
            </button>
          </form>
        </section>

        {/* ── Section 2: Subscription ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
            구독
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                현재 플랜:{" "}
                <span className="font-bold">
                  {PLAN_LABELS[user?.plan ?? "free"] ?? user?.plan}
                </span>
              </p>
              {user?.plan_expires_at && (
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  만료일:{" "}
                  {new Date(user.plan_expires_at).toLocaleDateString("ko-KR")}
                </p>
              )}
            </div>

            {user?.plan === "free" ? (
              <Link
                href="/billing"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                업그레이드
              </Link>
            ) : user?.plan !== "admin" ? (
              <button
                onClick={handleCancelPlan}
                disabled={cancelling}
                className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                {cancelling ? "처리 중…" : "구독 취소"}
              </button>
            ) : null}
          </div>
        </section>

        {/* ── Section 3: Account ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
            계정
          </h2>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            로그아웃
          </button>
        </section>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </main>
  );
}
