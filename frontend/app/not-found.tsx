import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
      <p className="text-7xl font-bold text-slate-200 dark:text-slate-800">404</p>
      <h1 className="mt-4 text-xl font-bold text-slate-700 dark:text-slate-200">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        대시보드로 이동
      </Link>
    </main>
  );
}
