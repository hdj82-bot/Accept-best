import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import UserMenu from "@/components/UserMenu";
import RecentSearches from "@/components/RecentSearches";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          논문집필 도우미
        </h1>
        <UserMenu />
      </header>

      {/* 메인 콘텐츠 */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-8">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            안녕하세요, {session.user?.name ?? session.user?.email}님
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            오늘도 좋은 연구 되세요.
          </p>
        </div>

        {/* 기능 카드 */}
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            기능
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DashboardCard
              title="논문 검색"
              description="arXiv·Semantic Scholar에서 논문을 검색하고 수집합니다."
              href="/papers"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              }
            />
            <DashboardCard
              title="설문문항 생성"
              description="논문 기반 설문문항을 AI가 자동으로 생성합니다."
              disabled
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                </svg>
              }
            />
            <DashboardCard
              title="논문 건강검진"
              description="작성 중인 논문의 완성도를 AI가 진단합니다."
              disabled
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              }
            />
            <DashboardCard
              title="연구 노트"
              description="AI 기반 연구 노트를 작성하고 초안으로 변환합니다."
              disabled
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              }
            />
          </div>
        </section>

        {/* 최근 검색 */}
        <RecentSearches />
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
  disabled,
  icon,
}: {
  title: string;
  description: string;
  href?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const content = (
    <>
      <div className="mb-3 flex items-center gap-2">
        {icon && (
          <span className={disabled ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-700 dark:text-zinc-300"}>
            {icon}
          </span>
        )}
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      {disabled && (
        <span className="mt-3 inline-block rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Coming Soon
        </span>
      )}
    </>
  );

  const className = `rounded-xl border p-5 ${
    disabled
      ? "border-zinc-200 bg-zinc-100/50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50"
      : "border-zinc-200 bg-white transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
  }`;

  if (href && !disabled) {
    return (
      <Link href={href} className={`block ${className}`}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
