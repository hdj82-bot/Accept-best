import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import UserMenu from "@/components/UserMenu";

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
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          안녕하세요, {session.user?.name ?? session.user?.email}님
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400">
          대시보드 기능은 다음 스프린트에서 구현됩니다.
        </p>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <DashboardCard
            title="논문 검색"
            description="arXiv·Semantic Scholar에서 논문을 검색하고 수집합니다."
            href="/papers"
          />
          <DashboardCard
            title="설문문항 생성"
            description="논문 기반 설문문항을 AI가 자동으로 생성합니다."
            href="/survey"
          />
          <DashboardCard
            title="논문 건강검진"
            description="작성 중인 논문의 완성도를 AI가 진단합니다."
            href="/diagnosis"
          />
          <DashboardCard
            title="논문 버전관리"
            description="논문의 버전을 관리하고 변경 이력을 추적합니다."
            href="/versions"
          />
          <DashboardCard
            title="연구 노트"
            description="AI 기반 연구 노트를 작성하고 초안으로 변환합니다."
            href="/notes"
          />
          <DashboardCard
            title="참고문헌 관리"
            description="참고문헌을 수동 추가하거나 논문에서 자동 추출합니다."
            href="/references"
          />
          <DashboardCard
            title="연구 공백 발견"
            description="여러 논문을 분석하여 연구 공백과 후속 연구를 제안합니다."
            href="/research-gaps"
          />
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
  disabled,
}: {
  title: string;
  description: string;
  href?: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h3>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
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
