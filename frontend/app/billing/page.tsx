"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import UsageIndicator from "@/components/UsageIndicator";
import {
  getMe,
  getCurrentBilling,
  getPlans,
  cancelPlan,
  preparePayment,
  completePayment,
  type User,
  type CurrentBilling,
  type BillingPlan,
  type Plan,
} from "@/lib/api";

// PortOne (아임포트) SDK type
declare global {
  interface Window {
    IMP?: {
      init: (merchantId: string) => void;
      request_pay: (
        params: Record<string, unknown>,
        callback: (rsp: { success: boolean; imp_uid?: string; merchant_uid?: string; error_msg?: string }) => void
      ) => void;
    };
  }
}

const IMP_MERCHANT_ID = process.env.NEXT_PUBLIC_IMP_MERCHANT_ID ?? "";

export default function BillingPage() {
  return (
    <AuthGuard>
      <BillingContent />
    </AuthGuard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Toast
// ────────────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDismiss }: {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4_000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${
        type === "success"
          ? "bg-emerald-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {message}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Fallback plan data (used if API unavailable)
// ────────────────────────────────────────────────────────────────────────────

const FALLBACK_PLANS: BillingPlan[] = [
  {
    id: "free",
    name: "무료",
    price_monthly: 0,
    features: [
      "논문 수집 월 3회",
      "설문 생성 월 3회",
      "AI 요약 월 10회",
      "노트 저장 무제한",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    price_monthly: 9900,
    features: [
      "논문 수집 월 20회",
      "설문 생성 월 20회",
      "AI 요약 월 100회",
      "PDF 내보내기",
      "버전 히스토리 30일",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price_monthly: 29900,
    features: [
      "논문 수집 무제한",
      "설문 생성 무제한",
      "AI 요약 무제한",
      "PDF 내보내기",
      "버전 히스토리 무제한",
      "우선 지원",
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Plan card
// ────────────────────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: BillingPlan;
  isCurrent: boolean;
  expiresAt: string | null;
  onUpgrade: (plan: Plan) => void;
  onCancel: () => void;
  upgrading: boolean;
  cancelling: boolean;
}

function PlanCard({
  plan,
  isCurrent,
  expiresAt,
  onUpgrade,
  onCancel,
  upgrading,
  cancelling,
}: PlanCardProps) {
  const isPro = plan.id === "pro";
  const isFree = plan.id === "free";

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 p-6 transition ${
        isCurrent
          ? isPro
            ? "border-violet-500 shadow-lg shadow-violet-100"
            : "border-blue-500 shadow-lg shadow-blue-100"
          : "border-slate-200"
      } ${isPro ? "bg-gradient-to-b from-violet-50 to-white" : "bg-white"}`}
    >
      {/* Badge */}
      <div className="mb-4 flex items-center justify-between">
        <h2
          className={`text-lg font-bold ${
            isPro ? "text-violet-700" : "text-slate-800"
          }`}
        >
          {plan.name}
        </h2>
        {isCurrent && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              isPro
                ? "bg-violet-100 text-violet-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            현재 플랜
          </span>
        )}
      </div>

      {/* Price */}
      <p className="mb-6">
        {plan.price_monthly === 0 ? (
          <span className="text-3xl font-bold text-slate-800">무료</span>
        ) : (
          <>
            <span className="text-3xl font-bold text-slate-800">
              ₩{plan.price_monthly.toLocaleString("ko-KR")}
            </span>
            <span className="text-sm text-slate-500"> / 월</span>
          </>
        )}
      </p>

      {/* Features */}
      <ul className="mb-6 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
            <span className="text-emerald-500">✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* Expiry */}
      {isCurrent && expiresAt && (
        <p className="mb-3 text-xs text-slate-400">
          만료일: {new Date(expiresAt).toLocaleDateString("ko-KR")}
        </p>
      )}

      {/* Action button */}
      {isCurrent ? (
        !isFree && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="w-full rounded-xl border border-slate-300 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelling ? "처리 중…" : "구독 해지"}
          </button>
        )
      ) : isFree ? null : (
        <button
          onClick={() => onUpgrade(plan.id as Plan)}
          disabled={upgrading}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
            isPro
              ? "bg-violet-600 hover:bg-violet-700"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {upgrading ? "처리 중…" : `${plan.name} 업그레이드`}
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main content
// ────────────────────────────────────────────────────────────────────────────

function BillingContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<CurrentBilling | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>(FALLBACK_PLANS);
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    getMe().then(setUser).catch(() => null);
    getCurrentBilling().then(setBilling).catch(() => null);
    getPlans().then(setPlans).catch(() => null); // falls back to FALLBACK_PLANS
  }, []);

  const handleUpgrade = async (plan: Plan) => {
    setUpgrading(true);
    try {
      // Step 1 – prepare (creates merchant_uid + amount on server)
      const { merchant_uid, amount } = await preparePayment(plan, 1);

      // Step 2 – mock mode when USE_FIXTURES is set (dev only)
      const useMock = process.env.NEXT_PUBLIC_USE_FIXTURES === "true";
      if (useMock) {
        const res = await completePayment("imp_mock_" + Date.now(), merchant_uid);
        if (res.success) {
          setUser((u) => u ? { ...u, plan } : u);
          setBilling((b) => b ? { ...b, plan, expires_at: res.expires_at } : b);
          showToast("플랜이 업그레이드되었습니다.", "success");
          setTimeout(() => router.push("/dashboard"), 1500);
        }
        setUpgrading(false);
        return;
      }

      // Step 3 – PortOne SDK
      if (!window.IMP) {
        showToast("결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", "error");
        setUpgrading(false);
        return;
      }
      window.IMP.init(IMP_MERCHANT_ID);

      const planLabels: Record<string, string> = { basic: "Basic", pro: "Pro" };
      window.IMP.request_pay(
        {
          pg: "html5_inicis",
          pay_method: "card",
          merchant_uid,
          amount,
          name: `논문집필 도우미 ${planLabels[plan] ?? plan} 플랜`,
          m_redirect_url: window.location.href,
        },
        async (rsp) => {
          if (!rsp.success || !rsp.imp_uid || !rsp.merchant_uid) {
            showToast(rsp.error_msg ?? "결제가 취소되었습니다.", "error");
            setUpgrading(false);
            return;
          }
          try {
            // Step 4 – verify on server
            const res = await completePayment(rsp.imp_uid, rsp.merchant_uid);
            if (res.success) {
              setUser((u) => u ? { ...u, plan } : u);
              setBilling((b) => b ? { ...b, plan, expires_at: res.expires_at } : b);
              showToast("플랜이 업그레이드되었습니다.", "success");
              setTimeout(() => router.push("/dashboard"), 1500);
            } else {
              showToast("결제 검증에 실패했습니다.", "error");
            }
          } catch (err) {
            showToast(err instanceof Error ? err.message : "결제 검증 실패", "error");
          } finally {
            setUpgrading(false);
          }
        }
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "결제 준비 실패", "error");
      setUpgrading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("구독을 해지하시겠습니까? 만료일까지는 계속 이용 가능합니다.")) return;
    setCancelling(true);
    try {
      await cancelPlan();
      setUser((u) => u ? { ...u, plan: "free" } : u);
      setBilling((b) => b ? { ...b, plan: "free", expires_at: null } : b);
      showToast("구독이 해지되었습니다.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "해지 실패", "error");
    } finally {
      setCancelling(false);
    }
  };

  const currentPlan = (billing?.plan ?? user?.plan ?? "free") as Plan;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
              ← 대시보드
            </Link>
            <h1 className="text-lg font-semibold text-slate-800">플랜 & 결제</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        {/* Usage indicator at top */}
        <UsageIndicator plan={currentPlan} />

        {/* Plan cards */}
        <div>
          <h2 className="mb-6 text-xl font-bold text-slate-800">플랜 선택</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {plans
              .filter((p) => p.id !== "admin")
              .map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrent={currentPlan === plan.id}
                  expiresAt={billing?.expires_at ?? null}
                  onUpgrade={handleUpgrade}
                  onCancel={handleCancel}
                  upgrading={upgrading}
                  cancelling={cancelling}
                />
              ))}
          </div>
        </div>
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
