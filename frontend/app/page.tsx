import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import {
  LandingHero,
  LandingFeatures,
  LandingPricing,
  LandingCTA,
  LandingLanguageSwitcher,
} from "./_components/LandingContent";

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  // Server actions for auth — cannot be in client components
  const googleHeroForm = (
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
        <span data-i18n="landing.startWithGoogle">Google로 무료 시작하기</span>
      </button>
    </form>
  );

  const kakaoHeroForm = (
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
        <span data-i18n="landing.startWithKakao">카카오로 시작하기</span>
      </button>
    </form>
  );

  const googleCTAForm = (
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
        <span data-i18n="common.login">로그인하기</span>
      </button>
    </form>
  );

  const kakaoCTAForm = (
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
        <span data-i18n="landing.loginWithKakao">카카오로 로그인</span>
      </button>
    </form>
  );

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <LandingLanguageSwitcher />
      <LandingHero googleForm={googleHeroForm} kakaoForm={kakaoHeroForm} />
      <LandingFeatures />
      <LandingPricing />
      <LandingCTA googleForm={googleCTAForm} kakaoForm={kakaoCTAForm} />
    </main>
  );
}

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
