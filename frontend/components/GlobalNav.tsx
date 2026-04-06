"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/lib/i18n";

/**
 * Persistent bottom navigation bar — only rendered when authenticated.
 * Mobile/tablet only (hidden ≥ lg). Includes ThemeToggle + LanguageSwitcher.
 */
export default function GlobalNav() {
  const { status } = useSession();
  const pathname = usePathname();
  const { t } = useLocale();

  if (status !== "authenticated" || pathname === "/") return null;

  const NAV_LINKS = [
    { href: "/dashboard",   label: t("nav.home"),        icon: "🏠" },
    { href: "/research",    label: t("nav.research"),    icon: "📄" },
    { href: "/bookmarks",   label: t("nav.bookmarks"),   icon: "🤍" },
    { href: "/collections", label: t("nav.collections"), icon: "📁" },
    { href: "/billing",     label: t("nav.billing"),     icon: "💳" },
    { href: "/settings",    label: t("nav.settings"),    icon: "⚙️" },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 lg:hidden">
      <div className="flex items-stretch">
        {NAV_LINKS.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${
                active
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}

        {/* Theme toggle + Language switcher */}
        <div className="flex flex-col items-center justify-center gap-1 px-2">
          <ThemeToggle />
          <LanguageSwitcher compact />
        </div>
      </div>
    </nav>
  );
}
