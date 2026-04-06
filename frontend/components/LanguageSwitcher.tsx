"use client";

import { useLocale, LOCALES, type Locale } from "@/lib/i18n";

const LABELS: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};

/**
 * 언어 전환 드롭다운.
 * - GlobalNav, Settings 등에서 사용
 * - 변경 즉시 localStorage + <html lang> 반영
 */
export default function LanguageSwitcher({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t("language.switchLabel")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("language.switchLabel")}
        className={`appearance-none rounded-lg border border-slate-200 bg-white text-slate-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 ${
          compact
            ? "px-2 py-1 pr-6 text-xs"
            : "px-3 py-1.5 pr-7 text-sm"
        }`}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {compact ? l.toUpperCase() : LABELS[l]}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-1.5 text-[10px] text-slate-400"
        aria-hidden="true"
      >
        ▾
      </span>
    </label>
  );
}
