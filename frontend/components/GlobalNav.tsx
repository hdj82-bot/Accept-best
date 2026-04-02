"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/dashboard",   label: "홈",     icon: "🏠" },
  { href: "/research",    label: "연구",   icon: "📄" },
  { href: "/bookmarks",   label: "북마크", icon: "🤍" },
  { href: "/collections", label: "컬렉션", icon: "📁" },
  { href: "/billing",     label: "플랜",   icon: "💳" },
];

/**
 * Persistent bottom navigation bar — only rendered when authenticated.
 * Mobile/tablet only (hidden ≥ lg). Includes ThemeToggle.
 */
export default function GlobalNav() {
  const { status } = useSession();
  const pathname = usePathname();

  if (status !== "authenticated" || pathname === "/") return null;

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
              {label}
            </Link>
          );
        })}

        {/* Theme toggle slot */}
        <div className="flex flex-col items-center justify-center px-3">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
