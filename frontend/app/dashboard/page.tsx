"use client";

import dynamic from "next/dynamic";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import UsageIndicator from "@/components/UsageIndicator";
import EmptyState from "@/components/EmptyState";
import { SkeletonText, SkeletonCard } from "@/components/Skeleton";
import { useUser, useNotes, useSearchHistory } from "@/lib/hooks";
import { useLocale, formatDate } from "@/lib/i18n";

const Onboarding = dynamic(() => import("@/components/Onboarding"), {
  ssr: false,
});

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: user } = useUser();
  const { data: allNotes, isLoading: notesLoading, error: notesError } = useNotes();
  const { data: allHistory } = useSearchHistory();
  const { t, locale } = useLocale();

  const notes = (allNotes ?? []).slice(0, 5);
  const searchHistory = (allHistory ?? []).slice(0, 3);

  const QUICK_LINKS = [
    { href: "/research",     icon: "📄", label: t("dashboard.links.researchNotes") },
    { href: "/bookmarks",    icon: "🤍", label: t("dashboard.links.bookmarks") },
    { href: "/collections",  icon: "📁", label: t("dashboard.links.collections") },
    { href: "/survey",       icon: "❓", label: t("dashboard.links.survey") },
    { href: "/checkup",      icon: "🔍", label: t("dashboard.links.healthCheck") },
    { href: "/versions",     icon: "📝", label: t("dashboard.links.versions") },
    { href: "/refs",         icon: "📚", label: t("dashboard.links.refs") },
    { href: "/gap-analysis", icon: "🔬", label: t("dashboard.links.gapAnalysis") },
    { href: "/settings",     icon: "⚙️", label: t("dashboard.links.settings") },
  ];

  return (
    <>
      <Onboarding auto />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t("common.appName")}
            </h1>
            <div className="flex items-center gap-3">
              {user?.plan === "free" && (
                <Link
                  href="/billing"
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  {t("dashboard.upgradeplan")}
                </Link>
              )}
              {user?.plan === "admin" && (
                <Link
                  href="/admin"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  {t("common.admin")}
                </Link>
              )}
              <span
                className="hidden text-sm text-slate-600 sm:inline dark:text-slate-300"
              >
                {session?.user?.email}
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t("common.logout")}
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left column */}
            <div className="space-y-8 lg:col-span-2">
              {/* Greeting */}
              <div>
                {session ? (
                  <>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {t("dashboard.greeting", {
                        name: session?.user?.name ?? t("dashboard.greetingDefault"),
                      })}
                    </h2>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {t("dashboard.subtitle")}
                    </p>
                  </>
                ) : (
                  <SkeletonText lines={2} className="max-w-md" />
                )}
              </div>

              {/* New research CTA */}
              <button
                type="button"
                onClick={() => router.push("/research")}
                className="flex w-full items-center justify-between rounded-2xl bg-blue-600 px-6 py-5 text-white shadow-md transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                aria-label={t("dashboard.newResearch")}
              >
                <div className="text-left">
                  <p className="text-lg font-semibold">{t("dashboard.newResearch")}</p>
                  <p className="mt-0.5 text-sm text-blue-100">
                    {t("dashboard.newResearchDesc")}
                  </p>
                </div>
                <span className="text-3xl" aria-hidden="true">→</span>
              </button>

              {/* Recent notes */}
              <section aria-labelledby="recent-notes-heading">
                <div className="mb-3 flex items-center justify-between">
                  <h3 id="recent-notes-heading" className="font-semibold text-slate-800 dark:text-slate-200">
                    {t("dashboard.recentNotes")}
                  </h3>
                  <Link href="/research" className="text-xs text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400">
                    {t("common.viewAll")}
                  </Link>
                </div>

                {notesLoading ? (
                  <div className="space-y-3">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </div>
                ) : notesError ? (
                  <EmptyState icon="⚠️" tone="error" title={t("dashboard.notesLoadError")} description={t("dashboard.notesLoadErrorDesc")} />
                ) : notes.length === 0 ? (
                  <EmptyState icon="📝" title={t("dashboard.noNotes")} description={t("dashboard.noNotesDesc")} action={{ label: t("dashboard.createNote"), href: "/research" }} />
                ) : (
                  <ul className="space-y-3" aria-label={t("dashboard.recentNotes")}>
                    {notes.map((note) => (
                      <li key={note.id}>
                        <Link
                          href={`/research/${note.id}`}
                          className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500"
                        >
                          <p className="line-clamp-2 text-sm text-slate-800 dark:text-slate-200">
                            {note.content || t("dashboard.emptyNote")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(note.created_at, locale)}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Right column */}
            <aside className="space-y-6" aria-label="sidebar">
              <UsageIndicator plan={user?.plan ?? "free"} />

              <section
                aria-labelledby="recent-searches-heading"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 id="recent-searches-heading" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {t("dashboard.recentSearches")}
                  </h3>
                  <Link href="/research" className="text-xs text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400">
                    {t("common.more")}
                  </Link>
                </div>
                {searchHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("dashboard.noSearchHistory")}</p>
                ) : (
                  <ul className="space-y-1">
                    {searchHistory.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => router.push(`/research?q=${encodeURIComponent(item.query)}`)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <span className="text-xs text-slate-400" aria-hidden="true">🕐</span>
                          <span className="truncate">{item.query}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                aria-labelledby="quicklinks-heading"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <h3 id="quicklinks-heading" className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t("dashboard.quickLinks")}
                </h3>
                <nav aria-label={t("dashboard.quickLinks")}>
                  <ul className="space-y-1">
                    {QUICK_LINKS.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <span aria-hidden="true">{link.icon}</span>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
