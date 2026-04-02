import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Hero */}
      <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-24 text-center">
        <span className="mb-4 rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-400">
          한국 연구자를 위한 올인원 플랫폼
        </span>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          논문집필 도우미
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-400 sm:text-lg">
          AI 기반 논문 수집·설문·버전관리·건강검진 —
          <br className="hidden sm:block" />
          연구 전 과정을 한 곳에서.
        </p>

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-3 rounded-2xl bg-white px-7 py-3.5 text-sm font-semibold text-slate-800 shadow-lg transition hover:bg-slate-100 active:scale-95"
          >
            <GoogleIcon />
            Google로 무료 시작하기
          </button>
        </form>

        <form
          className="mt-3"
          action={async () => {
            "use server";
            await signIn("kakao", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-3 rounded-2xl bg-[#FEE500] px-7 py-3.5 text-sm font-semibold text-[#3C1E1E] shadow-lg transition hover:bg-yellow-300 active:scale-95"
          >
            <KakaoIcon />
            카카오로 시작하기
          </button>
        </form>

        <p className="mt-3 text-xs text-slate-500">
          신용카드 불필요 · 무료 플랜 영구 제공
        </p>
      </section>

      {/* Features */}
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

      {/* Pricing */}
      <section className="border-t border-slate-700 bg-slate-900 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-2xl font-bold">플랜 비교</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="px-5 py-3 text-left text-slate-400 font-normal">기능</th>
                  <th className="px-5 py-3 text-center text-slate-400 font-normal">무료</th>
                  <th className="px-5 py-3 text-center font-semibold text-blue-400">
                    Basic<br /><span className="text-xs font-normal text-slate-400">₩9,900/월</span>
                  </th>
                  <th className="px-5 py-3 text-center font-semibold text-violet-400">
                    Pro<br /><span className="text-xs font-normal text-slate-400">₩29,900/월</span>
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

      {/* CTA */}
      <section className="border-t border-slate-700 px-6 py-16 text-center">
        <p className="mb-6 text-slate-400">이미 계정이 있으신가요?</p>
        <div className="flex flex-col items-center gap-3">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="rounded-2xl border border-slate-600 bg-slate-800 px-6 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
            >
              로그인하기
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("kakao", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-3 rounded-2xl bg-[#FEE500] px-6 py-3 text-sm font-medium text-[#3C1E1E] transition hover:bg-yellow-300 active:scale-95"
            >
              <KakaoIcon />
              카카오로 로그인
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

const FEATURES = [
  {
    icon: "📄",
    title: "논문 자동 수집",
    desc: "arXiv · Semantic Scholar에서 AI가 관련 논문을 자동으로 수집하고 임베딩합니다.",
  },
  {
    icon: "🔍",
    title: "논문 건강검진",
    desc: "작성한 논문을 Claude AI가 구조·명료성·독창성 점수로 분석하고 개선 방향을 제시합니다.",
  },
  {
    icon: "📚",
    title: "참고문헌 관리",
    desc: "BibTeX 내보내기, 북마크에서 자동 import, 컬렉션과 태그로 체계적으로 관리합니다.",
  },
];

const PRICING_ROWS = [
  { label: "research 세션 / 월", free: "3회", basic: "30회", pro: "무제한" },
  { label: "설문문항 자동 생성",  free: "✗",   basic: "✓",    pro: "✓" },
  { label: "버전 기록",           free: "✓",   basic: "✓",    pro: "✓" },
  { label: "논문 건강검진",       free: "✗",   basic: "✗",    pro: "✓" },
  { label: "AI 리랭킹",          free: "✗",   basic: "✗",    pro: "✓" },
  { label: "공유 카드 생성",      free: "✓",   basic: "✓",    pro: "✓" },
];

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#3C1E1E"
        d="M9 1.5C4.86 1.5 1.5 4.14 1.5 7.41c0 2.1 1.35 3.93 3.39 4.98l-.87 3.18a.28.28 0 0 0 .42.3L8.1 13.5c.3.03.6.06.9.06 4.14 0 7.5-2.64 7.5-5.91S13.14 1.5 9 1.5z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
