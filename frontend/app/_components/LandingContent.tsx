"use client";

import { useLocale } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/**
 * 랜딩 페이지 클라이언트 컨텐츠.
 * Server component (page.tsx) 에서 form + server action 은 유지하고,
 * i18n이 필요한 텍스트만 이 컴포넌트에서 렌더링.
 */

export function LandingTexts() {
  const { t } = useLocale();

  return {
    badge: t("landing.badge"),
    title: t("landing.title"),
    subtitle: t("landing.subtitle"),
    startWithGoogle: t("landing.startWithGoogle"),
    startWithKakao: t("landing.startWithKakao"),
    noCreditCard: t("landing.noCreditCard"),
    alreadyHaveAccount: t("landing.alreadyHaveAccount"),
    login: t("common.login"),
    loginWithKakao: t("landing.loginWithKakao"),
    planComparison: t("landing.planComparison"),
    feature: t("landing.feature"),
    free: t("landing.free"),
  };
}

export function LandingHero({
  googleForm,
  kakaoForm,
}: {
  googleForm: React.ReactNode;
  kakaoForm: React.ReactNode;
}) {
  const { t } = useLocale();

  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-24 text-center">
      <span className="mb-4 rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-400">
        {t("landing.badge")}
      </span>
      <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        {t("landing.title")}
      </h1>
      <p className="mt-4 max-w-xl text-base text-slate-400 sm:text-lg whitespace-pre-line">
        {t("landing.subtitle")}
      </p>

      {googleForm}
      {kakaoForm}

      <p className="mt-3 text-xs text-slate-500">
        {t("landing.noCreditCard")}
      </p>
    </section>
  );
}

export function LandingFeatures() {
  const { t } = useLocale();

  const FEATURES = [
    {
      icon: "📄",
      title: t("landing.features.autoCollect"),
      desc: t("landing.features.autoCollectDesc"),
    },
    {
      icon: "🔍",
      title: t("landing.features.healthCheck"),
      desc: t("landing.features.healthCheckDesc"),
    },
    {
      icon: "📚",
      title: t("landing.features.refManage"),
      desc: t("landing.features.refManageDesc"),
    },
  ];

  return (
    <section className="mx-auto max-w-4xl px-6 pb-20">
      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5"
          >
            <span className="text-2xl">{f.icon}</span>
            <h3 className="mt-3 font-semibold text-slate-100">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LandingPricing() {
  const { t } = useLocale();

  const PRICING_ROWS = [
    { label: t("landing.pricing.sessions"),      free: "3",  basic: "30",  pro: "∞" },
    { label: t("landing.pricing.surveyGen"),     free: "✗",  basic: "✓",   pro: "✓" },
    { label: t("landing.pricing.versionHistory"),free: "✓",  basic: "✓",   pro: "✓" },
    { label: t("landing.pricing.healthCheck"),   free: "✗",  basic: "✗",   pro: "✓" },
    { label: t("landing.pricing.aiReranking"),   free: "✗",  basic: "✗",   pro: "✓" },
    { label: t("landing.pricing.shareCard"),     free: "✓",  basic: "✓",   pro: "✓" },
  ];

  return (
    <section className="border-t border-slate-700 bg-slate-900 px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-10 text-center text-2xl font-bold">{t("landing.planComparison")}</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800">
                <th className="px-5 py-3 text-left text-slate-400 font-normal">{t("landing.feature")}</th>
                <th className="px-5 py-3 text-center text-slate-400 font-normal">{t("landing.free")}</th>
                <th className="px-5 py-3 text-center font-semibold text-blue-400">
                  Basic<br /><span className="text-xs font-normal text-slate-400">₩9,900/mo</span>
                </th>
                <th className="px-5 py-3 text-center font-semibold text-violet-400">
                  Pro<br /><span className="text-xs font-normal text-slate-400">₩29,900/mo</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {PRICING_ROWS.map((row, i) => (
                <tr key={i} className="border-b border-slate-800">
                  <td className="px-5 py-3 text-slate-300">{row.label}</td>
                  <td className="px-5 py-3 text-center text-slate-400">{row.free}</td>
                  <td className="px-5 py-3 text-center text-slate-200">{row.basic}</td>
                  <td className="px-5 py-3 text-center text-slate-200">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function LandingCTA({
  googleForm,
  kakaoForm,
}: {
  googleForm: React.ReactNode;
  kakaoForm: React.ReactNode;
}) {
  const { t } = useLocale();

  return (
    <section className="border-t border-slate-700 px-6 py-16 text-center">
      <p className="mb-6 text-slate-400">{t("landing.alreadyHaveAccount")}</p>
      <div className="flex flex-col items-center gap-3">
        {googleForm}
        {kakaoForm}
      </div>
    </section>
  );
}

export function LandingLanguageSwitcher() {
  return (
    <div className="absolute right-6 top-6 z-10">
      <LanguageSwitcher />
    </div>
  );
}
