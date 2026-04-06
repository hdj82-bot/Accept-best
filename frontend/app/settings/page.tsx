"use client";

import { useEffect, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useToast } from "@/components/Toast";
import { getMe, updateMe, cancelPlan, type User } from "@/lib/api";
import { useLocale, formatDate } from "@/lib/i18n";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}

const PLAN_LABELS: Record<string, Record<string, string>> = {
  ko: { free: "무료", basic: "Basic", pro: "Pro", admin: "관리자" },
  en: { free: "Free", basic: "Basic", pro: "Pro", admin: "Admin" },
};

function SettingsContent() {
  const [user, setUser] = useState<User | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();
  const { t, locale } = useLocale();

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
      toast(t("settings.nameSaved"), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelPlan = async () => {
    if (!confirm(t("settings.cancelConfirm"))) return;
    setCancelling(true);
    try {
      await cancelPlan();
      setUser((u) => (u ? { ...u, plan: "free", plan_expires_at: null } : u));
      toast(t("settings.cancelled"), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setCancelling(false);
    }
  };

  const planLabels = PLAN_LABELS[locale] ?? PLAN_LABELS.ko;

  return (
    <main className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-slate-200"
          >
            {t("common.backToDashboard")}
          </Link>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t("settings.title")}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 py-8 space-y-6">
        {/* Profile */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
            {t("settings.profile")}
          </h2>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t("settings.name")}
              </label>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={t("settings.namePlaceholder")}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t("settings.email")}
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
              {savingName ? t("common.saving") : t("common.save")}
            </button>
          </form>
        </section>

        {/* Language */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
            {t("settings.language")}
          </h2>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            {t("settings.languageDesc")}
          </p>
          <LanguageSwitcher />
        </section>

        {/* Subscription */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
            {t("settings.subscription")}
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {t("settings.currentPlan")}{" "}
                <span className="font-bold">
                  {planLabels[user?.plan ?? "free"] ?? user?.plan}
                </span>
              </p>
              {user?.plan_expires_at && (
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  {t("settings.expiresAt")} {formatDate(user.plan_expires_at, locale)}
                </p>
              )}
            </div>

            {user?.plan === "free" ? (
              <Link
                href="/billing"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t("common.upgrade")}
              </Link>
            ) : user?.plan !== "admin" ? (
              <button
                onClick={handleCancelPlan}
                disabled={cancelling}
                className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                {cancelling ? t("settings.cancelling") : t("settings.cancelSubscription")}
              </button>
            ) : null}
          </div>
        </section>

        {/* Account */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-base font-semibold text-slate-700 dark:text-slate-300">
            {t("settings.account")}
          </h2>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("common.logout")}
          </button>
        </section>
      </div>
    </main>
  );
}
